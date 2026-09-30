"""Tests for tools/build_maps.py.

How this can break (the tests below are derived from this list):
 1. mercY mixes degrees and radians or flips its sign: every pin lands in the wrong place, or the
    map is drawn upside down.
 2. k is taken from the wrong span, so the map is not 1000 units wide or its aspect lies
    (St. Petersburg squashed to fit, Pulkovo pulled north).
 3. The bbox misses a place or the ~0.8 km margin: VDNKh, Sevkabel or Pulkovo sit on the frame
    or off the map.
 4. Douglas-Peucker drops a path's endpoints (merged ways stop meeting, rings open up) or keeps
    collinear points (the size budget goes on straight roads).
 5. The projection written into the JSON is not the spec formula over its own bbox, so pins the
    app projects from it drift off the streets.
 6. A file is over 450 KB (the service worker precaches it over roaming data), is not valid JSON,
    lost a layer to a failed query, or carries a `d` that is not a path (nan, None, stray tokens)
    which the browser drops silently.
"""
import json
import math
import re
import unittest
from pathlib import Path

from osm import geometry

DATA = Path(__file__).resolve().parent.parent / "app" / "data"
CITIES = ("moscow", "spb")
BUDGET_BYTES = 450_000
# 0.8 km is >= 54 map units in both cities (Moscow ~14.6 m/unit, St. Petersburg ~8.9 m/unit).
MIN_EDGE_UNITS = 40
PATH_D = re.compile(r"M[MLlZz0-9. \-]*")
HEX = re.compile(r"#[0-9A-F]{6}")


def spec_merc_y(lat):
    """mercY exactly as the spec writes it: ln(tan(pi/4 + lat*pi/360)) * 180/pi."""
    return math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * 180 / math.pi


def load_map(city):
    path = DATA / f"map-{city}.json"
    return path, json.loads(path.read_text(encoding="utf-8"))


class ProjectionTest(unittest.TestCase):
    # Half a degree wide and a degree tall, so k from the wrong span shows.
    BBOX = [30.0, 59.0, 30.5, 60.0]
    K = 1000 / 0.5

    def test_merc_y_matches_epsg3857_at_60_north(self):
        # EPSG:3857 northing of 60 N is 8,399,737.89 m on the 6,378,137 m sphere.
        self.assertAlmostEqual(geometry.merc_y(60), math.degrees(8_399_737.89 / 6_378_137), places=5)
        self.assertAlmostEqual(geometry.merc_y(0), 0.0, places=9)

    def test_known_point_projects_to_the_spec_coordinates(self):
        proj = geometry.Projection.for_bbox(self.BBOX)
        x, y = proj(30.25, 59.5)
        self.assertAlmostEqual(x, 500.0, places=6)
        self.assertAlmostEqual(y, (spec_merc_y(60) - spec_merc_y(59.5)) * self.K, places=6)

    def test_bbox_corners_map_to_zero_width_and_height(self):
        proj = geometry.Projection.for_bbox(self.BBOX)
        self.assertEqual(proj.width, 1000)
        self.assertEqual((proj.lon0, proj.lat0), (30.0, 60.0))
        self.assertAlmostEqual(proj.height, (spec_merc_y(60) - spec_merc_y(59)) * self.K, places=6)
        x0, y0 = proj(30.0, 60.0)
        x1, y1 = proj(30.5, 59.0)
        self.assertAlmostEqual(x0, 0.0, places=9)
        self.assertAlmostEqual(y0, 0.0, places=9)
        self.assertAlmostEqual(x1, 1000.0, places=6)
        self.assertAlmostEqual(y1, proj.height, places=6)


class DouglasPeuckerTest(unittest.TestCase):
    def test_keeps_endpoints_and_drops_collinear_points(self):
        line = [(0, 0), (1, 0), (2, 0), (3, 0)]
        self.assertEqual(geometry.douglas_peucker(line, 0.5), [(0, 0), (3, 0)])

    def test_keeps_a_corner_beyond_tolerance_and_drops_points_within_it(self):
        line = [(0, 0), (1, 0), (2, 5), (3, 0), (4, 0)]
        self.assertEqual(geometry.douglas_peucker(line, 1.0), [(0, 0), (2, 5), (4, 0)])


class OutputTest(unittest.TestCase):
    def test_every_trip_place_with_coordinates_projects_inside_its_map(self):
        places = json.loads((DATA / "trip.json").read_text(encoding="utf-8"))["places"]
        for city in CITIES:
            _, doc = load_map(city)
            proj = doc["projection"]
            located = [p for p in places.values()
                       if p["city"] == city and p["lat"] is not None and p["lon"] is not None]
            self.assertTrue(located, city)
            for place in located:
                x = (place["lon"] - proj["lon0"]) * proj["k"]
                y = (spec_merc_y(proj["lat0"]) - spec_merc_y(place["lat"])) * proj["k"]
                with self.subTest(place=place["id"]):
                    self.assertGreaterEqual(x, MIN_EDGE_UNITS)
                    self.assertLessEqual(x, doc["width"] - MIN_EDGE_UNITS)
                    self.assertGreaterEqual(y, MIN_EDGE_UNITS)
                    self.assertLessEqual(y, doc["height"] - MIN_EDGE_UNITS)

    def test_output_parses_stays_under_budget_and_carries_every_layer(self):
        for city in CITIES:
            path, doc = load_map(city)
            with self.subTest(city=city):
                self.assertLessEqual(path.stat().st_size, BUDGET_BYTES)
                self.assertEqual(doc["city"], city)
                self.assertEqual(doc["width"], 1000)
                self.assertIn("OpenStreetMap", doc["attribution"])
                west, south, east, north = doc["bbox"]
                proj = doc["projection"]
                self.assertEqual((proj["lon0"], proj["lat0"]), (west, north))
                self.assertAlmostEqual((east - west) * proj["k"], 1000, delta=0.05)
                self.assertAlmostEqual((spec_merc_y(north) - spec_merc_y(south)) * proj["k"],
                                       doc["height"], delta=0.1)
                layers = doc["layers"]
                groups = {
                    "water.areas": layers["water"]["areas"], "water.lines": layers["water"]["lines"],
                    "parks": layers["parks"], "roads.major": layers["roads"]["major"],
                    "roads.minor": layers["roads"]["minor"], "rail": layers["rail"],
                    "metro": [line["d"] for line in layers["metro"]],
                    "landmarks": [mark["d"] for mark in layers["landmarks"]],
                }
                for name, paths in groups.items():
                    self.assertTrue(paths, name)
                    for d in paths:
                        self.assertTrue(PATH_D.fullmatch(d), f"{name}: {d[:60]}")
                for line in layers["metro"]:
                    self.assertRegex(line["colour"], HEX, line["name"])
                self.assertTrue(layers["stations"])
                self.assertTrue(layers["labels"])



def stop_at(proj, place, lon, lat, wikidata=None, names=(), footprint=None):
    from osm import features
    return {"place": place, "point": proj(lon, lat), "wikidata": wikidata, "footprint": footprint,
            "names": [features._words(name) for name in names]}


class PoiTest(unittest.TestCase):
    """A notable place shows once, in a name a Turkish reader can read, the best known first (lowest tier) so they
    show from the farthest zoom and win the space for labels; a place that IS a trip stop is marked with the stop's id
    (the page hides it while that stop has a pin), and a mere neighbour of a stop is not."""

    def test_pois_skip_repeats_and_nameless_places(self):
        from osm import features
        proj = geometry.Projection.for_bbox((37.60, 55.74, 37.64, 55.76))
        elements = [
            {"type": "node", "lat": 55.7539, "lon": 37.6209, "tags": {"name": "Red Square", "wikidata": "Q1", "tourism": "attraction"}},
            {"type": "way", "center": {"lat": 55.7510, "lon": 37.6180}, "tags": {"name": "Бо", "wikidata": "Q2", "amenity": "theatre"}},
            {"type": "way", "center": {"lat": 55.7511, "lon": 37.6181}, "tags": {"name": "Бо (dup)", "wikidata": "Q2", "amenity": "theatre"}},
            {"type": "node", "lat": 55.7550, "lon": 37.6150, "tags": {"name": "Храм", "wikidata": "Q3", "amenity": "place_of_worship"}},
            {"type": "node", "lat": 55.7555, "lon": 37.6190, "tags": {"name": "Музей", "wikidata": "Q4", "tourism": "museum"}},
            {"type": "node", "lat": 55.7560, "lon": 37.6230, "tags": {"wikidata": "Q5", "tourism": "museum"}},
            {"type": "node", "lat": 55.7490, "lon": 37.6300, "tags": {"name": "Памятник", "wikidata": "Q6", "historic": "monument"}},
        ]
        pois = features.poi_features(elements, proj, [])
        self.assertEqual([(p["name"], p["kind"]) for p in pois], [
            ("Red Square", "sight"), ("Памятник", "historic"), ("Музей", "museum"), ("Бо", "theatre"), ("Храм", "church")])

    def test_a_place_that_is_a_stop_is_marked_and_its_neighbours_are_not(self):
        from osm import features
        proj = geometry.Projection.for_bbox((37.60, 55.74, 37.64, 55.76))
        corners = [proj(37.617, 55.751), proj(37.625, 55.751), proj(37.625, 55.756), proj(37.617, 55.756)]
        footprint = [(corners + corners[:1], True)]
        stops = [stop_at(proj, "msk-06", 37.6208, 55.7539, "Q1", ["Red Square", "Красная площадь"], footprint),
                 stop_at(proj, "msk-45", 37.6100, 55.7450, None, ["Novodevichy Convent & Pond"]),
                 stop_at(proj, "spb-23", 37.6300, 55.7420, None, ["Mariinsky Theatre"])]
        node = lambda qid, lat, lon, **tags: {"type": "node", "lat": lat, "lon": lon, "tags": {"wikidata": qid, **tags}}
        elements = [
            node("Q1", 55.7600, 37.6300, name="Красная площадь", **{"name:en": "Square by id"}, tourism="attraction"),
            node("Q2", 55.7538, 37.6195, name="Мавзолей", **{"name:en": "Lenin's Mausoleum"}, historic="monument"),
            node("Q3", 55.7540, 37.6240, name="Красная площадь", **{"name:en": "Red Square"}, tourism="attraction"),
            node("Q4", 55.7458, 37.6100, name="Новодевичий", **{"name:en": "Novodevichy Convent"}, tourism="attraction"),
            node("Q5", 55.7452, 37.6102, name="Смоленский собор", **{"name:en": "Smolensky Cathedral"}, building="cathedral"),
            node("Q6", 55.7580, 37.6300, name="Красная площадь", **{"name:en": "Far namesake"}, tourism="attraction"),
            node("Q7", 55.7429, 37.6300, name="Мариинский-2", **{"name:en": "Mariinsky II"}, amenity="theatre"),
        ]
        marked = {p["name"]: p.get("stop") for p in features.poi_features(elements, proj, stops)}
        self.assertEqual(marked, {
            "Square by id": "msk-06",  # the stop's wikidata id, whatever the distance
            "Red Square": "msk-06",  # another id, but the stop's own name inside its footprint
            "Far namesake": None,  # the same Russian name, outside the footprint and 300 m
            "Lenin's Mausoleum": None,  # 50 m from the pin but another place
            "Novodevichy Convent": "msk-45",  # "Novodevichy Convent" is in "Novodevichy Convent & Pond"
            "Smolensky Cathedral": None,  # inside the convent, still a place of its own
            "Mariinsky II": None,  # the new stage, 100 m off: "II" is a word, so the name is not the stop's
        })

    def test_the_best_known_places_come_first_and_take_the_lowest_tiers(self):
        from unittest import mock
        from osm import features
        proj = geometry.Projection.for_bbox((37.60, 55.74, 37.64, 55.76))
        langs = lambda n: {f"name:{code}": "x" for code in ("de", "fr", "es", "it", "ja", "pl", "uk", "zh")[:n]}
        place = lambda qid, name, n, **tags: {"type": "node", "lat": 55.75, "lon": 37.61 + int(qid[1:]) / 1000,
                                             "tags": {"name": name, "wikidata": qid, **langs(n), **tags}}
        elements = [
            place("Q1", "Храм", 0, amenity="place_of_worship"),
            place("Q2", "Большой театр", 8, amenity="theatre", **{"name:en": "The Bolshoi Theatre"}),
            place("Q3", "Музей", 3, tourism="museum", **{"name:tr": "Müze", "name:en": "Museum"}),
            place("Q4", "Памятник", 3, historic="monument", **{"name:etymology:wikidata": "Q9"}),
        ]
        with mock.patch.object(features, "POI_TIERS", (1, 3)):
            pois = features.poi_features(elements, proj, [])
        self.assertEqual([(p["name"], p["lang"], p["tier"]) for p in pois], [
            ("Bolshoi Theatre", "en", 1),  # 9 languages, "The" dropped
            ("Müze", "tr", 2),  # 5 languages beat 3; Turkish before English
            ("Памятник", "ru", 2),  # a name:etymology tag is no language
            ("Храм", "ru", 3),
        ])


class StationNamesTest(unittest.TestCase):
    """Each station is named once, readably: an interchange's platforms share one label, set under the lowest of them,
    while two stations that only share a name keep their own."""

    def test_interchange_platforms_merge_and_distant_namesakes_do_not(self):
        from osm import features
        proj = geometry.Projection.for_bbox((37.55, 55.70, 37.70, 55.80))
        station = (lambda lat, lon, name, en=None: {"type": "node", "lat": lat, "lon": lon, "tags": {
            "railway": "station", "station": "subway", "name": name, **({"name:en": en} if en else {})}})
        elements = [
            station(55.7520, 37.6100, "Арбатская", "Arbatskaya"),
            station(55.7524, 37.6108, "Арбатская", "Arbatskaya"),  # the other line's platform, ~60 m away
            station(55.7800, 37.6800, "Арбатская"),  # a namesake several km off
            station(55.7600, 37.6200, "Театральная", "Teatralnaya"),
            {"type": "node", "lat": 55.7600, "lon": 37.6300, "tags": {"railway": "station", "name": "Тверская"}},
        ]
        names = features.station_names(elements, proj)
        self.assertEqual([(n["name"], n["lang"]) for n in names],
                         [("Arbatskaya", "en"), ("Teatralnaya", "en"), ("Арбатская", "ru")])
        self.assertAlmostEqual(names[0]["x"], (proj(37.6100, 55.7520)[0] + proj(37.6108, 55.7524)[0]) / 2, delta=0.2)
        self.assertAlmostEqual(names[0]["y"], proj(37.6100, 55.7520)[1], delta=0.2,
                               msg="the name hangs under the lower platform, clear of both dots")


if __name__ == "__main__":
    unittest.main()
