"""Tests for tools/build_trip.py.

How this can break (the tests below are derived from this list):
 1. "Jan 01" parsed into 2026, or the CSV BOM glued to the header -> wrong/unordered dates.
 2. Weekday index off by one -> wrong Turkish day names.
 3. Quoted CSV cells split on commas, trimmed or re-encoded -> plan text not verbatim.
 4. Visit date/slot not matched to the CSV row -> a stop silently dropped or put in the wrong slot.
 5. Ids sorted as plain strings or spb before msk -> stops out of CSV order.
 6. A free slot emitted as null or without "places".
 7. Transit day given Moscow's city/sun times, or "from" missing / leaking to other days.
 8. An uyarilar key that resolves to nothing silently ignored instead of failing the build.
 9. not_found places given photos/coordinates; w/h not the real webp size; upscaled or
    distorted photos; missing detail/thumb files.
10. Sun: longitude sign, Julian-day half-day slip or double timezone shift -> minutes to hours off.
11. Credit: "www." kept, wrong separator, Wikimedia author/license dropped.
12. Schema drift from the shape the UI thread codes against.
13. One place visited twice on one date (two slots): the UI keys ticks and panel ids by
    date + place, so ticking one ticks both and one toggle opens the other's panel.
14. A warning level outside the UI's set: the flag silently renders with a fallback look.
15. A stop without a name, or a coordinate that is a bool, NaN, infinity or a string: a traceback,
    broken map links, or NaN written into trip.json (invalid JSON, the app cannot load its data).
16. version hashing only part of the object: a change to verifiedOn or the slots keeps the old
    version and generatedAt.
Expected values come from the inputs, so adding places (replacement venues) keeps this suite green.
"""
import csv
import datetime as dt
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

from PIL import Image

import build_trip as bt

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "plan" / "Russia_Plan_Basic.csv"
PLACES_PATH = ROOT / "mekanlar" / "mekanlar.json"
WARNINGS_PATH = ROOT / "plan" / "uyarilar.json"
TRIP_JSON = ROOT / "app" / "data" / "trip.json"
SCRIPT = Path(__file__).resolve().parent / "build_trip.py"

SLOT_KEYS = ["work", "afternoon", "evening"]
WEEKDAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
MONTHS = {"Dec": (2026, 12), "Jan": (2027, 1)}
MOSCOW = (55.7558, 37.6173)
SPB = (59.9343, 30.3351)


def iso_from_plan_date(text):
    month, day = text.split()
    year, month_no = MONTHS[month]
    return dt.date(year, month_no, int(day)).isoformat()


def raw_places():
    return json.loads(PLACES_PATH.read_text(encoding="utf-8"))["places"]


def minutes(hhmm):
    hours, mins = hhmm.split(":")
    return int(hours) * 60 + int(mins)


def plan_rows():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.reader(handle))[1:]


def csv_order_key(place_id):
    """Plan order: every Moscow stop before St. Petersburg, then by number."""
    prefix, number = place_id.split("-")
    return (0 if prefix == "msk" else 1, int(number))


def unused_place_id(prefix):
    numbers = [int(p["id"].split("-")[1]) for p in raw_places() if p["id"].startswith(prefix + "-")]
    return f"{prefix}-{max(numbers, default=0) + 1:02d}"


def unvisited_key(place):
    visited = {iso_from_plan_date(v["date"]) for v in place["visits"]}
    date = next(iso_from_plan_date(row[0]) for row in plan_rows() if iso_from_plan_date(row[0]) not in visited)
    return f"{date}|{place['id']}"


def temp_root(test, mutate_places=None, mutate_warnings=None):
    """A project root holding copies of the real inputs, changed by the given mutators."""
    tmp = Path(tempfile.mkdtemp(prefix="build_trip_test_"))
    test.addCleanup(shutil.rmtree, tmp)
    (tmp / "plan").mkdir()
    (tmp / "mekanlar").mkdir()
    shutil.copy(CSV_PATH, tmp / "plan" / CSV_PATH.name)
    for source, mutate in ((PLACES_PATH, mutate_places), (WARNINGS_PATH, mutate_warnings)):
        data = json.loads(source.read_text(encoding="utf-8"))
        if mutate:
            mutate(data)
        # Python writes NaN/Infinity literals here, which is how such values would reach the build.
        (tmp / source.parent.name / source.name).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return tmp


class TripDataTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.trip = bt.build_trip(ROOT, lambda place_id, n: (960, 640))
        cls.days = cls.trip["days"]
        cls.by_date = {day["date"]: day for day in cls.days}

    def slot(self, date, key):
        return next(s for s in self.by_date[date]["slots"] if s["key"] == key)


class DaysTest(TripDataTestCase):
    def test_27_consecutive_days_from_dec_19_to_jan_14(self):
        dates = [dt.date.fromisoformat(day["date"]) for day in self.days]
        self.assertEqual(len(dates), 27)
        self.assertEqual(dates[0], dt.date(2026, 12, 19))
        self.assertEqual(dates[-1], dt.date(2027, 1, 14))
        for prev, cur in zip(dates, dates[1:]):
            self.assertEqual(cur - prev, dt.timedelta(days=1))
        self.assertEqual([day["n"] for day in self.days], list(range(1, 28)))

    def test_turkish_weekdays(self):
        self.assertEqual(self.by_date["2026-12-19"]["weekday"], "Cumartesi")
        self.assertEqual(self.by_date["2027-01-01"]["weekday"], "Cuma")
        for i, day in enumerate(self.days):
            self.assertEqual(day["weekday"], WEEKDAYS_TR[(5 + i) % 7], day["date"])

    def test_cities_and_the_single_transit_day(self):
        for day in self.days:
            with self.subTest(date=day["date"]):
                if day["date"] == "2027-01-04":
                    self.assertEqual((day["city"], day["transit"], day["from"]), ("spb", True, "moscow"))
                else:
                    expected_city = "moscow" if day["date"] < "2027-01-04" else "spb"
                    self.assertEqual((day["city"], day["transit"]), (expected_city, False))
                    self.assertNotIn("from", day)

    def test_every_csv_cell_is_a_verbatim_slot_plan_in_slot_order(self):
        with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))[1:]
        self.assertEqual(len(rows), 27)
        for day, row in zip(self.days, rows):
            self.assertEqual(day["date"], iso_from_plan_date(row[0]))
            self.assertEqual([s["key"] for s in day["slots"]], SLOT_KEYS)
            self.assertEqual([s["plan"] for s in day["slots"]], row[2:5])
        self.assertEqual(self.slot("2026-12-20", "afternoon")["plan"], "Red Square, St. Basil’s Cathedral, GUM")
        self.assertEqual(self.slot("2026-12-19", "evening")["plan"], "Dinner at Varenichnaya №1, beers at Kamchatka")


class VisitJoinTest(TripDataTestCase):
    def test_every_visit_lands_in_exactly_its_day_and_slot(self):
        expected = Counter()
        for place in raw_places():
            for visit in place["visits"]:
                expected[(iso_from_plan_date(visit["date"]), visit["slot"], place["id"])] += 1
        placed = Counter()
        for day in self.days:
            for slot in day["slots"]:
                for place_id in slot["places"]:
                    placed[(day["date"], slot["key"], place_id)] += 1
        self.assertEqual(set(expected.values()), {1})
        self.assertEqual(placed, expected)

    def test_slot_places_follow_csv_order(self):
        multi = 0
        for day in self.days:
            for slot in day["slots"]:
                self.assertEqual(slot["places"], sorted(slot["places"], key=csv_order_key), (day["date"], slot["key"]))
                multi += len(slot["places"]) > 1
        self.assertGreater(multi, 0, "no slot with several stops: the order check proved nothing")

    def test_free_slots_keep_an_empty_list(self):
        visited = {(iso_from_plan_date(v["date"]), v["slot"]) for p in raw_places() for v in p["visits"]}
        expected = sorted((d["date"], key) for d in self.days for key in SLOT_KEYS if (d["date"], key) not in visited)
        empty = sorted((d["date"], s["key"]) for d in self.days for s in d["slots"] if s["places"] == [])
        self.assertEqual(empty, expected)


class WarningsTest(TripDataTestCase):
    def test_all_warning_keys_resolve_and_come_through(self):
        raw = json.loads(WARNINGS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(set(raw["place"]) - set(self.trip["places"]), set())
        for place_id, place in self.trip["places"].items():
            self.assertEqual(place["short"], raw["place"].get(place_id), place_id)
        self.assertEqual(self.trip["visitWarnings"], raw["visit"])

    def test_unresolvable_keys_raise_with_the_bad_key(self):
        entry = {"level": "info", "text": "x"}
        place = raw_places()[0]
        first_date = iso_from_plan_date(plan_rows()[0][0])
        cases = {
            "unknown place": ("place", unused_place_id("msk")),
            "unknown place in visit": ("visit", f"{first_date}|{unused_place_id('msk')}"),
            "place not visited that date": ("visit", unvisited_key(place)),
            "date outside the trip": ("visit", f"2027-02-01|{place['id']}"),
            "malformed visit key": ("visit", place["id"]),
        }
        for label, (section, key) in cases.items():
            with self.subTest(label):
                root = temp_root(self, mutate_warnings=lambda w: w[section].update({key: entry}))
                with self.assertRaises(bt.BuildError) as caught:
                    bt.build_trip(root, lambda place_id, n: (1, 1))
                self.assertIn(key, str(caught.exception))

    def test_cli_exits_nonzero_and_writes_nothing_on_unknown_key(self):
        key = unused_place_id("spb")
        root = temp_root(self, mutate_warnings=lambda w: w["place"].update({key: {"level": "info", "text": "x"}}))
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(root)], capture_output=True, text=True, timeout=120
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(key, result.stderr)
        self.assertFalse((root / "app").exists())


class PhotoCreditTest(TripDataTestCase):
    def test_bing_credit_is_page_host_without_www(self):
        image = {"source": "bing", "page_url": "https://www.timeout.ru/msk/place/stars-coffee"}
        self.assertEqual(bt.photo_credit(image), "timeout.ru")

    def test_wikimedia_credit_lists_author_and_license(self):
        image = {"source": "wikimedia", "page_url": "https://commons.wikimedia.org/wiki/File:x.jpg",
                 "author": "Денис  Пономарев", "license": "CC BY-SA 4.0"}
        self.assertEqual(bt.photo_credit(image), "Wikimedia Commons · Денис Пономарев · CC BY-SA 4.0")

    def test_every_photo_links_its_source_page(self):
        for place in raw_places():
            photos = self.trip["places"][place["id"]]["photos"]
            expected = [image["page_url"] for image in place["images"]] if place["status"] != "not_found" else []
            self.assertEqual([photo["page"] for photo in photos], expected, place["id"])


class SchemaShapeTest(TripDataTestCase):
    def test_top_level_day_place_and_photo_keys(self):
        self.assertEqual(
            list(self.trip),
            ["version", "generatedAt", "verifiedOn", "timezone", "utcOffsetHours", "dayRolloverHour",
             "slots", "cities", "days", "places", "visitWarnings"],
        )
        self.assertRegex(self.trip["version"], r"^[0-9a-f]{12}$")
        self.assertRegex(self.trip["generatedAt"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        self.assertEqual(
            (self.trip["verifiedOn"], self.trip["timezone"], self.trip["utcOffsetHours"], self.trip["dayRolloverHour"]),
            ("2026-09-30", "Europe/Moscow", 3, 5),
        )
        self.assertEqual(self.trip["slots"], [
            {"key": "work", "label": "Çalışma", "start": "08:00", "end": "16:00"},
            {"key": "afternoon", "label": "Gezi", "start": "16:00", "end": "19:30"},
            {"key": "evening", "label": "Akşam", "start": "19:30", "end": "05:00"},
        ])
        self.assertEqual(self.trip["cities"], {
            "moscow": {"label": "Moskova", "local": "Москва"},
            "spb": {"label": "St. Petersburg", "local": "Санкт-Петербург"},
        })
        day_keys = ["n", "date", "weekday", "city", "transit", "sunrise", "sunset", "slots"]
        for day in self.days:
            expected = day_keys[:5] + ["from"] + day_keys[5:] if day["transit"] else day_keys
            self.assertEqual(list(day), expected, day["date"])
            for slot in day["slots"]:
                self.assertEqual(list(slot), ["key", "plan", "places"])
        place_keys = ["id", "name", "local", "nameEn", "branch", "category", "city", "status", "short",
                      "statusNote", "notes", "address", "lat", "lon", "website", "stops", "photos"]
        self.assertEqual(set(self.trip["places"]), {p["id"] for p in raw_places()})
        for place_id, place in self.trip["places"].items():
            self.assertEqual(list(place), place_keys, place_id)
            self.assertEqual(place["city"], "moscow" if place_id.startswith("msk-") else "spb")
            for photo in place["photos"]:
                self.assertEqual(list(photo), ["src", "thumb", "w", "h", "credit", "page"])
        raw_stops = {p["id"]: p.get("stops") for p in raw_places()}
        for place_id, stops in raw_stops.items():
            expected = [{"name": s["name"], "lat": s["lat"], "lon": s["lon"]} for s in stops] if stops else None
            self.assertEqual(self.trip["places"][place_id]["stops"], expected, place_id)


class RejectionTest(unittest.TestCase):
    """Data the UI would mis-render stops the build with a BuildError naming the culprit."""

    def assertRejected(self, needle, **mutators):
        with self.assertRaises(bt.BuildError) as caught:
            bt.build_trip(temp_root(self, **mutators), lambda place_id, n: (1, 1))
        self.assertIn(needle, str(caught.exception))

    def test_one_place_twice_on_one_date(self):
        place = raw_places()[0]
        visit = place["visits"][0]
        other_slot = next(key for key in SLOT_KEYS if key != visit["slot"])

        def add_visit(data):
            data["places"][0]["visits"].append({**visit, "slot": other_slot})
        self.assertRejected(place["id"], mutate_places=add_visit)

    def test_warning_level_outside_the_ui_set(self):
        warnings = json.loads(WARNINGS_PATH.read_text(encoding="utf-8"))
        for section in ("place", "visit"):
            key = next(iter(warnings[section]))
            for level in ("danger", "", ["warn"], None):
                with self.subTest(section=section, level=level):
                    def set_level(data, section=section, key=key, level=level):
                        data[section][key] = {"level": level, "text": "x"}
                    self.assertRejected(key, mutate_warnings=set_level)

    def test_bad_stops(self):
        place_id = raw_places()[0]["id"]
        good = {"name": "Floating Bridge", "lat": 55.749503, "lon": 37.629405}
        cases = {
            "empty name": [{**good, "name": " "}],
            "missing name": [{"lat": good["lat"], "lon": good["lon"]}],
            "bool lat": [{**good, "lat": True}],
            "NaN lat": [{**good, "lat": float("nan")}],
            "infinite lon": [{**good, "lon": float("inf")}],
            "string lon": [{**good, "lon": "37.629405"}],
            "stops not a list": good,
            "stop not an object": ["Floating Bridge"],
        }
        for label, stops in cases.items():
            with self.subTest(label):
                def set_stops(data, stops=stops):
                    data["places"][0]["stops"] = stops
                self.assertRejected(place_id, mutate_places=set_stops)

    def test_place_coordinates_must_be_finite_reals(self):
        place = next(p for p in raw_places() if p["status"] != "not_found")
        index = raw_places().index(place)
        for key, value in (("lat", True), ("lon", float("nan")), ("lat", float("-inf")), ("lon", None)):
            with self.subTest(key=key, value=value):
                def set_coordinate(data, key=key, value=value):
                    data["places"][index][key] = value
                self.assertRejected(place["id"], mutate_places=set_coordinate)


class TripJsonTest(unittest.TestCase):
    def test_nan_never_reaches_trip_json(self):
        tmp = Path(tempfile.mkdtemp(prefix="build_trip_test_"))
        self.addCleanup(shutil.rmtree, tmp)
        with self.assertRaises(bt.BuildError):
            bt.write_trip_json(tmp / "trip.json", {"version": "v", "generatedAt": "g", "lat": float("nan")})
        self.assertFalse((tmp / "trip.json").exists())

    def test_version_covers_every_field_but_generated_at(self):
        inputs = bt.load_inputs(ROOT)
        size = lambda place_id, n: (960, 640)  # noqa: E731
        base = bt.assemble(inputs, size, "2026-10-01T00:00:00Z")["version"]
        self.assertEqual(bt.assemble(inputs, size, "2026-11-01T00:00:00Z")["version"], base)
        relabelled = [{**slot, "label": slot["label"] + "!"} for slot in bt.SLOTS]
        for name, value in (("VERIFIED_ON", "2026-10-15"), ("SLOTS", relabelled), ("DAY_ROLLOVER_HOUR", 4)):
            with self.subTest(name), mock.patch.object(bt, name, value):
                self.assertNotEqual(bt.assemble(inputs, size, "2026-10-01T00:00:00Z")["version"], base)


class SunTimesTest(TripDataTestCase):
    # Published table: timeanddate.com, fetched 2026-09-30 through https://r.jina.ai/ (a direct
    # curl gets a Cloudflare challenge):
    #   https://www.timeanddate.com/sun/russia/moscow?month=12&year=2026
    #   https://www.timeanddate.com/sun/russia/moscow?month=1&year=2027
    #   https://www.timeanddate.com/sun/@498817?month=1&year=2027   (Saint Petersburg)
    REFERENCE = [
        ("2026-12-19", MOSCOW, "08:56", "15:56"),
        ("2026-12-25", MOSCOW, "08:58", "16:00"),
        ("2027-01-03", MOSCOW, "08:58", "16:09"),
        ("2027-01-04", SPB, "09:58", "16:08"),
        ("2027-01-09", SPB, "09:54", "16:17"),
        ("2027-01-14", SPB, "09:47", "16:28"),
    ]
    TOLERANCE_MIN = 2

    def assertNear(self, actual, expected, label):
        self.assertLessEqual(abs(minutes(actual) - minutes(expected)), self.TOLERANCE_MIN, f"{label}: {actual} vs {expected}")

    def test_noaa_function_matches_published_table(self):
        for date, (lat, lon), rise, set_ in self.REFERENCE:
            sunrise, sunset = bt.sun_times(dt.date.fromisoformat(date), lat, lon, 3)
            self.assertNear(sunrise, rise, f"{date} sunrise")
            self.assertNear(sunset, set_, f"{date} sunset")

    def test_day_entries_use_the_days_city(self):
        for date, _, rise, set_ in self.REFERENCE:
            day = self.by_date[date]
            self.assertNear(day["sunrise"], rise, f"{date} sunrise")
            self.assertNear(day["sunset"], set_, f"{date} sunset")


class BuiltArtifactsTest(unittest.TestCase):
    """Checks the files a real `python3 tools/build_trip.py` run left in app/."""

    @classmethod
    def setUpClass(cls):
        if not TRIP_JSON.is_file():
            raise AssertionError(f"{TRIP_JSON} missing: run `python3 tools/build_trip.py` first")
        cls.trip = json.loads(TRIP_JSON.read_text(encoding="utf-8"))
        cls.raw = {place["id"]: place for place in raw_places()}

    def test_found_places_have_three_existing_photos_with_real_sizes(self):
        self.assertEqual(set(self.trip["places"]), set(self.raw))
        for place_id, place in self.trip["places"].items():
            raw = self.raw[place_id]
            if raw["status"] == "not_found":
                continue
            self.assertEqual(len(place["photos"]), 3, place_id)
            for n, (photo, image) in enumerate(zip(place["photos"], raw["images"]), start=1):
                with self.subTest(photo=f"{place_id}-{n}"):
                    self.assertEqual((photo["src"], photo["thumb"]), (f"img/{place_id}-{n}.webp", f"img/{place_id}-{n}-t.webp"))
                    with Image.open(ROOT / "mekanlar" / raw["folder"] / image["file"]) as source:
                        src_w, src_h = source.size
                    with Image.open(ROOT / "app" / photo["src"]) as detail:
                        self.assertEqual(detail.format, "WEBP")
                        self.assertEqual((photo["w"], photo["h"]), detail.size)
                    self.assertEqual(max(photo["w"], photo["h"]), min(960, max(src_w, src_h)))
                    self.assertAlmostEqual(photo["w"] / photo["h"], src_w / src_h, delta=0.01)
                    with Image.open(ROOT / "app" / photo["thumb"]) as thumb:
                        self.assertEqual(thumb.format, "WEBP")
                        self.assertEqual(max(thumb.size), min(360, max(src_w, src_h)))

    def test_not_found_places_have_no_photos_or_coordinates(self):
        not_found = sorted(pid for pid, raw in self.raw.items() if raw["status"] == "not_found")
        if not not_found:
            self.skipTest("no not_found place in mekanlar.json")
        for place_id in not_found:
            place = self.trip["places"][place_id]
            self.assertEqual(place["photos"], [])
            self.assertEqual((place["lat"], place["lon"], place["address"]), (None, None, None))


if __name__ == "__main__":
    unittest.main()
