#!/usr/bin/env python3
"""Build the offline vector base maps app/data/map-moscow.json and app/data/map-spb.json.

The app has no network in Russia, so the map is drawn at build time from OpenStreetMap data
(Overpass API) and shipped as SVG path strings in a local Web Mercator space 1000 units wide:
x = (lon - lon0) * k, y = (mercY(lat0) - mercY(lat)) * k, lon0/lat0 being the bbox west/north
edges. Outer rings wind clockwise on screen and holes the other way, so the SVG default
(nonzero) fill rule keeps islands and courtyards open.

Raw Overpass responses are cached (`--cache`), so reruns never hit the servers; `--offline`
turns a cache miss into an error.

    python3 tools/build_maps.py [--city moscow|spb] [--cache DIR] [--offline]
"""
import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from osm.config import (
    ATTRIBUTION, BUDGET_BYTES, BuildError, CITIES, DATA, DEFAULT_CACHE, ROOT, SOURCES, TOLERANCE,
    TOLERANCE_STEPS, TRIP,
)
from osm.features import (
    _words, landmark_features, landmark_targets, metro_features, park_features, poi_features, rail_features,
    road_features, station_features, station_names, water_features,
)
from osm.geometry import Projection, city_bbox, encode
from osm.labels import label_features
from osm.overpass import Overpass, overpass_queries
from osm.shapes import render_lines, render_polygons


def load_wikidata():
    """place id -> wikidata id from the research file."""
    if not SOURCES.is_file():
        print(f"build_maps: {SOURCES} is missing; only the fixed landmarks will be drawn", file=sys.stderr)
        return {}
    places = json.loads(SOURCES.read_text(encoding="utf-8")).get("places", [])
    return {p["id"]: p["wikidata"] for p in places if p.get("id") and p.get("wikidata")}


def extract_features(city, places, proj, osm, targets):
    water_areas, water_lines, rivers = water_features(osm["water"], proj)
    parks = park_features(osm["parks"], proj)
    metro = metro_features(osm["metro"], proj)
    marks, missing = landmark_features(osm["landmarks"], targets, proj)
    here = {pid: p for pid, p in sorted(places.items())
            if p.get("city") == city and p.get("lat") is not None and p.get("lon") is not None}
    located = [proj(p["lon"], p["lat"]) for p in here.values()]
    focus = (sum(x for x, _ in located) / len(located), sum(y for _, y in located) / len(located))
    qids = {t["place"]: t["wikidata"] for t in targets if t["place"]}
    footprints = {mark["place"]: mark["feature"] for mark in marks if mark["place"]}
    stops = [{"place": pid, "point": point, "wikidata": qids.get(pid), "footprint": footprints.get(pid),
              "names": [_words(p[key]) for key in ("name", "local", "nameEn") if p.get(key)]}
             for (pid, p), point in zip(here.items(), located)]
    return {
        "water_areas": water_areas, "water_lines": water_lines, "parks": [f for _, f, _ in parks],
        **road_features(osm["roads"], proj), "rail": rail_features(osm["rail"], proj),
        "metro": metro, "stations": station_features(osm["metro"], proj, metro),
        "station_names": station_names(osm["metro"], proj),
        "landmarks": marks, "missing": missing, "pois": poi_features(osm["pois"], proj, stops),
        "labels": label_features(city, rivers, parks, osm["places"], proj, focus,
                                 json.dumps(places, ensure_ascii=False)),
    }


def render_city(city, bbox, proj, features, factor):
    rect = proj.frame()
    tol = {name: value * factor for name, value in TOLERANCE.items()}
    stats = defaultdict(lambda: [0, 0])

    def paths(group, shapes, closed):
        stats[group][0] += len(shapes)
        stats[group][1] += sum(map(len, shapes))
        return [encode(shapes, closed)] if shapes else []

    def polygons(group, feats, tolerance):
        return paths(group, render_polygons(feats, rect, tolerance), True)

    def lines(group, polylines, tolerance):
        return paths(group, render_lines(polylines, rect, tolerance), False)

    metro = [{"ref": line["ref"], "name": line["name"], "colour": line["colour"], "d": d[0]}
             for line in features["metro"] if (d := lines("metro", line["tracks"], tol["metro"]))]
    landmarks = [{"place": mark["place"], "name": mark["name"], "d": d[0]}
                 for mark in features["landmarks"]
                 if (d := polygons("landmarks", [mark["feature"]], tol["landmarks"]))]
    layers = {
        "water": {"areas": polygons("water.areas", features["water_areas"], tol["water_area"]),
                  "lines": lines("water.lines", features["water_lines"], tol["water_line"])},
        "parks": polygons("parks", features["parks"], tol["parks"]),
        "roads": {"major": lines("roads.major", features["major"], tol["major"]),
                  "minor": lines("roads.minor", features["minor"], tol["minor"])},
        "rail": lines("rail", features["rail"], tol["rail"]),
        "metro": metro,
        "stations": features["stations"],
        "stationNames": features["station_names"],
        "landmarks": landmarks,
        "labels": features["labels"],
        "pois": features["pois"],
    }
    doc = {"city": city, "bbox": bbox, "projection": {"lon0": proj.lon0, "lat0": proj.lat0, "k": proj.k},
           "width": proj.width, "height": round(proj.height, 1), "layers": layers, "attribution": ATTRIBUTION}
    return doc, dict(stats)


def build_city(city, places, wikidata, client):
    bbox = city_bbox(places, city)
    proj = Projection.for_bbox(bbox)
    targets = landmark_targets(places, wikidata, city)
    print(f"{city}: bbox {bbox}, {proj.width} x {proj.height:.1f} units", file=sys.stderr)
    osm = {name: client.fetch(f"{city}-{name}", query) for name, query in overpass_queries(bbox, targets).items()}
    features = extract_features(city, places, proj, osm, targets)
    for factor in TOLERANCE_STEPS:
        doc, stats = render_city(city, bbox, proj, features, factor)
        blob = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(blob) <= BUDGET_BYTES:
            break
        print(f"  {city}: {len(blob):,} bytes is over budget at tolerance x{factor}", file=sys.stderr)
    else:
        raise BuildError(f"{city}: still {len(blob):,} bytes at tolerance x{factor}")
    target = DATA / f"map-{city}.json"
    tmp = target.with_name(f".{target.name}.tmp")
    tmp.write_bytes(blob)
    os.replace(tmp, target)
    report(target, len(blob), factor, stats, doc["layers"], features["missing"])


def report(target, size, factor, stats, layers, missing):
    print(f"{os.path.relpath(target, ROOT)}: {size:,} bytes ({size / 1024:.0f} KiB), tolerance x{factor:g}")
    for group, (subpaths, points) in stats.items():
        print(f"  {group:<12} {subpaths:>6} subpaths {points:>7} points")
    unplaced = sum(1 for s in layers["stations"] if s["line"] is None)
    print(f"  metro lines {len(layers['metro'])}, stations {len(layers['stations'])} ({unplaced} without a line), "
          f"landmarks {len(layers['landmarks'])}, labels {len(layers['labels'])}, "
          f"places {len(layers['pois'])}, station names {len(layers['stationNames'])}")
    for target_place in missing:
        print(f"  no footprint: {target_place['place'] or '-'} {target_place['name']} ({target_place['wikidata']})")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build the offline vector base maps from OpenStreetMap.")
    parser.add_argument("--city", choices=CITIES, action="append", help="build only this city (repeatable)")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE,
                        help=f"raw Overpass cache (default {DEFAULT_CACHE})")
    parser.add_argument("--offline", action="store_true", help="fail on a cache miss instead of querying Overpass")
    args = parser.parse_args(argv)
    try:
        places = json.loads(TRIP.read_text(encoding="utf-8"))["places"]
        wikidata = load_wikidata()
        client = Overpass(args.cache, args.offline)
        for city in args.city or CITIES:
            build_city(city, places, wikidata, client)
    except (BuildError, OSError, ValueError, KeyError) as exc:
        print(f"build_maps: ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
