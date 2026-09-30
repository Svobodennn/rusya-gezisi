"""The map layers: water, parks, roads, rail, metro lines and stations, landmark footprints."""
import math
import re
from collections import Counter, defaultdict

from .config import (
    CSS_COLOURS, EXTRA_LANDMARKS, FLOWING, MAJOR, NOT_WATER, PARK_MIN_M2, POND_MIN_M2, RAIL_SKIP_USAGE,
    STATION_REACH_M, STATION_TIE_M, TWIN_M,
)
from .geometry import douglas_peucker
from .labels import _inside
from .shapes import (
    _coords, chain_directed, drop_twins, element_rings, feature_area_m2, merge_lines, project_line,
    project_rings, sea_rings,
)


def _keep_water(tags, feature, proj):
    if tags.get("waterway") == "riverbank" or tags.get("water") in FLOWING:
        return True
    return tags.get("water") not in NOT_WATER and feature_area_m2(feature, proj) >= POND_MIN_M2


def water_features(elements, proj):
    """(area features, centre lines, centre lines by river name). The sea comes from the
    coastline: OSM has no polygon for the Gulf of Finland."""
    areas, lines, named, coast = [], [], defaultdict(list), []
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] == "way" and tags.get("natural") == "coastline":
            coast.append((el["nodes"], project_line(_coords(el.get("geometry")), proj)))
        elif el["type"] == "way" and tags.get("waterway") in ("river", "canal"):
            if tags.get("tunnel", "no") == "no":  # culverted rivers (Neglinnaya) stay off the map
                line = project_line(_coords(el.get("geometry")), proj)
                lines.append(line)
                named[re.sub(r"^(река|р\.)\s+", "", tags.get("name") or "")].append(line)
        else:
            feature = project_rings(element_rings(el), proj)
            if feature and _keep_water(tags, feature, proj):
                areas.append(feature)
    # Coastline is clipped to the exact frame the query covered: a chain ends only where the next
    # way lies wholly outside it, so every run starts and ends on that frame.
    sea = sea_rings(chain_directed(coast), proj.frame(0))
    if sea:
        areas.append(sea)
    return areas, merge_lines(lines), {name: merge_lines(group) for name, group in named.items()}


def park_features(elements, proj):
    features = ((el.get("tags", {}), project_rings(element_rings(el), proj)) for el in elements)
    return [(tags, feature, area) for tags, feature in features
            if feature and (area := feature_area_m2(feature, proj)) >= PARK_MIN_M2]


def road_features(elements, proj):
    classes = {"major": [], "minor": []}
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] == "way" and tags.get("area") != "yes":
            road_class = "major" if tags.get("highway") in MAJOR else "minor"
            classes[road_class].append(project_line(_coords(el.get("geometry")), proj))
    return {road_class: merge_lines(lines) for road_class, lines in classes.items()}


def rail_features(elements, proj):
    """Running lines only: yards, sidings, spurs and industrial track are left out."""
    tracks = [project_line(_coords(el.get("geometry")), proj) for el in elements
              if el["type"] == "way" and "service" not in el.get("tags", {})
              and el.get("tags", {}).get("usage") not in RAIL_SKIP_USAGE]
    return merge_lines(drop_twins([[track] for track in tracks], TWIN_M / proj.m_per_unit))


def _hex(colour):
    value = (colour or "").strip().lower()
    value = CSS_COLOURS.get(value, value.lstrip("#"))
    if re.fullmatch(r"[0-9A-Fa-f]{3}", value):
        value = "".join(c * 2 for c in value)
    return "#" + value.upper() if re.fullmatch(r"[0-9A-Fa-f]{6}", value) else None


def _line_name(name):
    """'Сокольническая линия: А → Б' names one direction; keep the line part."""
    return name.split(":")[0].strip() if re.search(r"→|=>|->", name) else name.strip()


def _ref_order(line):
    number = re.match(r"\d+", line["ref"])
    return (int(number.group()) if number else 1_000, line["ref"])


def metro_features(elements, proj):
    """One entry per line (route master): ref, name, colour, merged tracks and stop positions."""
    routes, master_of = [], {}
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] == "relation" and tags.get("route") == "subway":
            routes.append(el)
        elif el["type"] == "relation" and tags.get("route_master") == "subway":
            master_of.update((m["ref"], el) for m in el.get("members", ()) if m["type"] == "relation")
    lines = {}
    for route in routes:
        master = master_of.get(route["id"])
        tags, mtags = route.get("tags", {}), master.get("tags", {}) if master else {}
        key = master["id"] if master else tags.get("ref") or tags.get("name")
        line = lines.setdefault(key, {
            "ref": mtags.get("ref") or tags.get("ref") or "",
            "name": _line_name(mtags.get("name") or tags.get("name") or ""),
            "colour": _hex(mtags.get("colour")), "colours": Counter(), "routes": [], "stops": []})
        line["colours"].update(filter(None, [_hex(tags.get("colour"))]))
        track = []
        for m in route.get("members", ()):
            role = m.get("role", "")
            if m["type"] == "way" and role in ("", "forward", "backward"):
                track.append(project_line(_coords(m.get("geometry")), proj))
            elif m["type"] == "node" and role.startswith("stop") and "lat" in m:
                line["stops"].append(proj(m["lon"], m["lat"]))
        line["routes"].append(track)
    for line in lines.values():
        # Route relations carry curated hex colours; masters often say "blue" or "#ff00ff".
        colours = line.pop("colours")
        line["colour"] = colours.most_common(1)[0][0] if colours else line["colour"] or "#808080"
        line["tracks"] = merge_lines(drop_twins(line.pop("routes"), TWIN_M / proj.m_per_unit))
    return sorted(lines.values(), key=_ref_order)


def _line_distances(point, lines, reach):
    """[(distance, ref)] within reach, nearest first: to stop positions, or to tracks when no line
    stops within reach."""
    for index in (1, 2):
        ranks = sorted((min((math.dist(point, p) for p in line[index]), default=math.inf), line[0])
                       for line in lines)
        ranks = [(dist, ref) for dist, ref in ranks if dist <= reach]
        if ranks:
            return ranks
    return []


def station_features(elements, proj, metro):
    """Each station takes the line whose stops are nearest. At a cross-platform interchange two
    lines tie on distance; the station's own colour tag breaks the tie, read in the vocabulary
    the untied stations establish (stations say "orange", their line says "#F07E23")."""
    reach, tie = STATION_REACH_M / proj.m_per_unit, STATION_TIE_M / proj.m_per_unit
    lines = [(line["ref"], line["stops"], [p for t in line["tracks"] for p in douglas_peucker(t, 2.0)])
             for line in metro]
    found = []
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] != "node" or tags.get("station") != "subway" or not tags.get("name"):
            continue
        point = proj(el["lon"], el["lat"])
        if _inside(point, proj.frame(0)):
            found.append((tags["name"], point, _hex(tags.get("colour")), _line_distances(point, lines, reach)))
    votes = defaultdict(Counter)
    for _, _, colour, ranks in found:
        if colour and ranks and (len(ranks) == 1 or ranks[1][0] - ranks[0][0] > tie):
            votes[colour][ranks[0][1]] += 1
    stations = []
    for name, (x, y), colour, ranks in found:
        tied = [ref for dist, ref in ranks if dist - ranks[0][0] <= tie]
        line = max(tied, key=lambda ref: votes[colour][ref]) if tied else None
        stations.append({"name": name, "x": round(x, 1), "y": round(y, 1), "line": line})
    return sorted(stations, key=lambda s: (s["name"], s["x"]))


def landmark_targets(places, wikidata, city):
    targets = {}
    for pid, place in sorted(places.items()):
        qid = place.get("wikidata") or wikidata.get(pid)
        if place.get("city") == city and qid:
            targets.setdefault(qid, {"place": pid, "wikidata": qid, "name": place.get("local") or place.get("name"),
                                     "osm_name": None})
    for qid, osm_name in EXTRA_LANDMARKS[city]:
        targets.setdefault(qid, {"place": None, "wikidata": qid, "name": osm_name})["osm_name"] = osm_name
    return list(targets.values())


def landmark_features(elements, targets, proj):
    """The largest polygon carrying each target's wikidata id (else its OSM name)."""
    candidates = defaultdict(list)
    for el in elements:
        feature = project_rings(element_rings(el), proj)
        if feature:
            tags = el.get("tags", {})
            entry = (feature_area_m2(feature, proj), tags.get("name"), feature)
            candidates["wikidata", tags.get("wikidata")].append(entry)
            if tags.get("name"):
                candidates["name", tags["name"]].append(entry)
    marks, missing = [], []
    for target in targets:
        found = candidates.get(("wikidata", target["wikidata"])) or candidates.get(("name", target["osm_name"]))
        if not found:
            missing.append(target)
            continue
        _, osm_name, feature = max(found, key=lambda entry: entry[0])
        marks.append({"place": target["place"], "name": osm_name or target["name"], "feature": feature})
    return marks, missing
