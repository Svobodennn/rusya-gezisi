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


if __name__ == "__main__":
    unittest.main()
