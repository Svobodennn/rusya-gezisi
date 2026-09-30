"""The map layers: water, parks, roads, rail, metro lines and stations, landmark footprints, notable places."""
import math
import re
from collections import Counter, defaultdict

from .config import (
    CSS_COLOURS, EXTRA_LANDMARKS, FLOWING, MAJOR, NOT_WATER, PARK_MIN_M2, POI_LIMIT, POI_SAME_NAME_M, POI_TIERS,
    POND_MIN_M2, RAIL_SKIP_USAGE, STATION_MERGE_M, STATION_REACH_M, STATION_TIE_M, TWIN_M,
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


def readable_name(tags):
    """(name, language) a Turkish reader can read: the Turkish name, else the English one without a leading
    "The", else the Russian name on the sign."""
    for key, lang in (("name:tr", "tr"), ("name:en", "en")):
        value = (tags.get(key) or "").strip()
        if value:
            return (value[4:] if value.startswith("The ") else value), lang
    return tags["name"], "ru"


def station_names(elements, proj):
    """One readable name per station: platforms that share a Russian name within STATION_MERGE_M (the halves of an
    interchange) take a single label, anchored under the lowest of them so it hangs clear of every platform dot."""
    merge = STATION_MERGE_M / proj.m_per_unit
    groups = []
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] != "node" or tags.get("station") != "subway" or not tags.get("name"):
            continue
        point = proj(el["lon"], el["lat"])
        if not _inside(point, proj.frame(0)):
            continue
        home = next((g for g in groups if g["key"] == tags["name"]
                     and any(math.dist(point, p) < merge for p in g["points"])), None)
        if home:
            home["points"].append(point)
        else:
            groups.append({"key": tags["name"], "label": readable_name(tags), "points": [point]})
    names = [{"name": g["label"][0], "lang": g["label"][1],
              "x": round(sum(x for x, _ in g["points"]) / len(g["points"]), 1),
              "y": round(max(y for _, y in g["points"]), 1)} for g in groups]
    return sorted(names, key=lambda s: (s["name"], s["x"]))


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


def _poi_kind(tags):
    if tags.get("tourism") in ("museum", "gallery"):
        return "museum"
    if tags.get("amenity") in ("theatre", "arts_centre", "concert_hall", "planetarium"):
        return "theatre"
    if tags.get("amenity") == "place_of_worship" or tags.get("building") in ("cathedral", "church"):
        return "church"
    if tags.get("historic") or tags.get("building") == "palace":
        return "historic"
    return "sight"


POI_ORDER = ("sight", "historic", "museum", "theatre", "church")
NAME_TAG = re.compile(r"name:[a-z]{2,3}(-[A-Za-z]+)?")


def _renown(tags):
    """How widely known a place is: the number of languages OSM gives its name in (the Bolshoi 47, a parish church 0)."""
    return sum(1 for key in tags if NAME_TAG.fullmatch(key))


def _contains(feature, point):
    """Even-odd over every ring: inside an outer ring and outside its holes."""
    x, y = point
    inside = False
    for ring, _ in feature:
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
            if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
                inside = not inside
    return inside


NAME_KEYS = ("name", "name:en", "name:tr", "name:ru")


def _words(text):
    """The words that tell a name apart: fillers ("of", "st", "the") drop out, numbers and numerals ("II") stay."""
    return frozenset(w for w in re.findall(r"\w+", text.casefold())
                     if (len(w) > 2 or w.isdigit() or re.fullmatch(r"[ivxlc]+", w)) and w not in ("the", "and"))


def _same_name(tags, stop):
    """Some name of the place is contained, word for word, in some name of the stop ("Novodevichy Convent" in
    "Novodevichy Convent & Pond"); a place that only shares words ("Peter and Paul Cathedral") is another place."""
    places = [_words(tags[key]) for key in NAME_KEYS if tags.get(key)]
    return any(words and words <= theirs for words in places for theirs in stop["names"])


def _stop_of(qid, tags, point, stops, proj):
    """The trip stop a notable place is: the same wikidata id, else, in the stop's footprint or near its pin, the same
    place under another id (by name). Neighbours stay places of their own, the Mausoleum on Red Square, VDNKh's
    pavilions, the Fabergé Museum beside a lunch stop: a dot right under a pin is covered by it anyway, and names keep
    clear of pins on the page."""
    same = next((stop["place"] for stop in stops if qid and qid == stop["wikidata"]), None)
    return same or next((stop["place"] for stop in stops if _same_name(tags, stop) and (
        math.dist(point, stop["point"]) < POI_SAME_NAME_M / proj.m_per_unit
        or (stop["footprint"] and _contains(stop["footprint"], point)))), None)


def poi_features(elements, proj, stops):
    """Notable places, each wikidata id once: readable name, kind, tier, position, and the trip stop it is, if any.

    stops: [{"place", "point", "wikidata", "footprint", "names"}]. A place that is a stop keeps its entry with its id,
    so the page hides it only while that stop has a pin and still shows it on the other days. The best known come
    first and get the lowest tier, so the page shows and labels them from the farthest zoom and they win the space
    when names would collide; sights and history before churches among equals."""
    seen, found = set(), []
    for el in elements:
        tags = el.get("tags", {})
        name, qid = tags.get("name"), tags.get("wikidata")
        centre = el.get("center") or (el if "lat" in el and "lon" in el else None)
        if not name or not qid or qid in seen or not centre:
            continue
        point = proj(centre["lon"], centre["lat"])
        if not _inside(point, proj.frame(0)):
            continue
        seen.add(qid)
        label, lang = readable_name(tags)
        found.append((-_renown(tags), POI_ORDER.index(_poi_kind(tags)), label, lang, point,
                      _stop_of(qid, tags, point, stops, proj)))
    found.sort(key=lambda entry: entry[:3])
    return [{"name": label, "lang": lang, "kind": POI_ORDER[kind], "tier": _tier(i),
             "x": round(point[0], 1), "y": round(point[1], 1), **({"stop": stop} if stop else {})}
            for i, (_, kind, label, lang, point, stop) in enumerate(found[:POI_LIMIT])]


def _tier(index):
    return 1 if index < POI_TIERS[0] else 2 if index < POI_TIERS[1] else 3
