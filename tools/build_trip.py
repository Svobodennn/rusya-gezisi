#!/usr/bin/env python3
"""Build the offline trip app's data: app/data/trip.json and app/img/*.webp.

Usage: python3 tools/build_trip.py [--root DIR]

Reads plan/Russia_Plan_Basic.csv, plan/uyarilar.json and mekanlar/mekanlar.json (+ photos),
never modifies them. Idempotent: unchanged images and JSON are not rewritten. Never deletes
anything; files in app/img/ that the build does not produce are reported as orphans.
Any input that would otherwise be silently dropped fails the build (exit 1).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageOps

VERIFIED_ON = "2026-09-30"
RESIZED_ON = "2026-09-30"
TIMEZONE = "Europe/Moscow"
UTC_OFFSET_HOURS = 3
DAY_ROLLOVER_HOUR = 5
SLOTS = [
    {"key": "work", "label": "Çalışma", "start": "08:00", "end": "16:00"},
    {"key": "afternoon", "label": "Gezi", "start": "16:00", "end": "19:30"},
    {"key": "evening", "label": "Akşam", "start": "19:30", "end": "05:00"},
]
SLOT_KEYS = tuple(slot["key"] for slot in SLOTS)
CITIES = {
    "moscow": {"label": "Moskova", "local": "Москва"},
    "spb": {"label": "St. Petersburg", "local": "Санкт-Петербург"},
}
CITY_COORDS = {"moscow": (55.7558, 37.6173), "spb": (59.9343, 30.3351)}
PLAN_CITIES = {"Moscow": "moscow", "St. Pete": "spb"}
PLAN_TRANSIT = "Transit"
PLAN_HEADER = ["Date", "City", "Workspace / Cafe (08:00 - 16:00)",
               "Afternoon Activity (16:00 - 19:30)", "Evening / Nightlife (19:30+)"]
PLAN_MONTHS = {"Dec": (2026, 12), "Jan": (2027, 1)}
PLACE_PREFIXES = {"msk": "moscow", "spb": "spb"}
PLACE_CITY_NAMES = {"Moscow": "moscow", "St. Petersburg": "spb"}
PLACE_STATUSES = {"open", "closed", "moved", "not_found"}
# The warning looks the UI draws; anything else would render with a silent fallback.
WARNING_LEVELS = {"warn", "info", "moved", "closed", "not_found"}
PHOTO_SOURCES = {"bing", "wikimedia"}
PHOTOS_PER_PLACE = 3
WEEKDAYS_TR = ("Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar")
SUNRISE_ZENITH_DEG = 90.833
WEBP_METHOD = 6
DEFAULT_EMBED_TOOL = str(Path.home() / ".claude-personal/plugins/cache/impeccable/impeccable/4.2.0"
                         / "skills/impeccable/scripts/impeccable")


class BuildError(Exception):
    """Input or output problem that must stop the build."""


@dataclass(frozen=True)
class Variant:
    suffix: str
    long_side: int
    quality: int


VARIANTS = (Variant("", 960, 62), Variant("-t", 360, 58))


@dataclass(frozen=True)
class Inputs:
    plan: list
    places: list
    slot_places: dict
    place_short: dict
    visit_warnings: dict


# ---------- plan CSV ----------

def parse_plan_date(text: str) -> dt.date:
    parts = text.split()
    if len(parts) != 2 or parts[0] not in PLAN_MONTHS or not parts[1].isdigit():
        raise BuildError(f"unrecognised plan date {text!r} (expected e.g. 'Dec 19' or 'Jan 04')")
    year, month = PLAN_MONTHS[parts[0]]
    try:
        return dt.date(year, month, int(parts[1]))
    except ValueError as exc:
        raise BuildError(f"invalid plan date {text!r}: {exc}") from exc


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BuildError(f"{path.name}: cannot read JSON: {exc}") from exc


def load_plan(path: Path) -> list:
    try:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = [row for row in csv.reader(handle) if row]
    except (OSError, ValueError, csv.Error) as exc:
        raise BuildError(f"{path.name}: cannot read the plan: {exc}") from exc
    if not rows or rows[0] != PLAN_HEADER:
        raise BuildError(f"{path.name}: unexpected header {rows[0] if rows else None!r}")
    plan = []
    for line_no, row in enumerate(rows[1:], start=2):
        if len(row) != 2 + len(SLOT_KEYS):
            raise BuildError(f"{path.name}:{line_no}: expected {2 + len(SLOT_KEYS)} cells, got {len(row)}")
        if row[1] != PLAN_TRANSIT and row[1] not in PLAN_CITIES:
            raise BuildError(f"{path.name}:{line_no}: unknown city {row[1]!r}")
        plan.append({"date": parse_plan_date(row[0]), "city": row[1], "cells": row[2:]})
    for prev, cur in zip(plan, plan[1:]):
        if cur["date"] - prev["date"] != dt.timedelta(days=1):
            raise BuildError(f"{path.name}: {cur['date']} does not follow {prev['date']}")
    return plan


def day_city(plan: list, index: int) -> tuple:
    """(city, from_city); a transit day belongs to the city it arrives in."""
    city = plan[index]["city"]
    if city != PLAN_TRANSIT:
        return PLAN_CITIES[city], None
    prev_city = plan[index - 1]["city"] if index > 0 else None
    next_city = plan[index + 1]["city"] if index + 1 < len(plan) else None
    if prev_city not in PLAN_CITIES or next_city not in PLAN_CITIES:
        raise BuildError(f"transit day {plan[index]['date']} needs a city day on both sides")
    return PLAN_CITIES[next_city], PLAN_CITIES[prev_city]


# ---------- places ----------

def place_sort_key(place_id: str) -> tuple:
    prefix, number = place_id.split("-")
    return list(PLACE_PREFIXES).index(prefix), int(number)


def text_or_none(value):
    return value if isinstance(value, str) and value.strip() else None


def one_of(value, allowed) -> bool:
    """Membership that cannot raise on unhashable JSON values (lists, objects)."""
    return isinstance(value, str) and value in allowed


def is_coordinate(value) -> bool:
    # bool is an int subclass, and json.loads accepts NaN/Infinity, which json.dumps(allow_nan=False) rejects.
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def check_stops(pid: str, stops) -> list:
    if stops is None:
        return []
    if not isinstance(stops, list):
        return [f"{pid}: stops must be a list"]
    return [f"{pid} stop {n}: needs a non-empty name and finite numeric lat/lon"
            for n, stop in enumerate(stops, start=1)
            if not isinstance(stop, dict) or not text_or_none(stop.get("name"))
            or not all(is_coordinate(stop.get(k)) for k in ("lat", "lon"))]


def check_place(place) -> list:
    if not isinstance(place, dict):
        return [f"place entry is not an object: {place!r:.60}"]
    pid = place.get("id")
    if not isinstance(pid, str) or not re.fullmatch(r"(msk|spb)-\d+", pid):
        return [f"bad place id {pid!r}"]
    problems = [f"{pid}: missing {key}" for key in ("name", "category") if not text_or_none(place.get(key))]
    if not one_of(place.get("status"), PLACE_STATUSES):
        problems.append(f"{pid}: unknown status {place.get('status')!r}")
    if not one_of(place.get("city"), PLACE_CITY_NAMES) \
            or PLACE_CITY_NAMES[place["city"]] != PLACE_PREFIXES[pid.split("-")[0]]:
        problems.append(f"{pid}: city {place.get('city')!r} contradicts the id prefix")
    visits = place.get("visits")
    if not isinstance(visits, list) or not visits:
        problems.append(f"{pid}: no visits")
    elif not all(isinstance(visit, dict) for visit in visits):
        problems.append(f"{pid}: every visit must be an object")
    problems += check_stops(pid, place.get("stops"))
    if place.get("status") == "not_found":
        return problems
    images = place.get("images")
    if not text_or_none(place.get("folder")) or not isinstance(images, list) or len(images) != PHOTOS_PER_PLACE:
        problems.append(f"{pid}: a found place needs a folder and {PHOTOS_PER_PLACE} images")
    else:
        for n, image in enumerate(images, start=1):
            image = image if isinstance(image, dict) else {}
            missing = [k for k in ("file", "page_url", "image_url") if not text_or_none(image.get(k))]
            if missing or not one_of(image.get("source"), PHOTO_SOURCES):
                problems.append(f"{pid} photo {n}: missing {missing} or unknown source {image.get('source')!r}")
    if not all(is_coordinate(place.get(k)) for k in ("lat", "lon")):
        problems.append(f"{pid}: a found place needs finite numeric lat/lon")
    return problems


def load_places(path: Path) -> list:
    data = read_json(path)
    places = data.get("places") if isinstance(data, dict) else None
    if not isinstance(places, list):
        raise BuildError(f"{path.name}: expected an object with a 'places' list")
    problems = [problem for place in places for problem in check_place(place)]
    ids = [place["id"] for place in places if isinstance(place, dict) and isinstance(place.get("id"), str)]
    problems += [f"duplicate place id {pid}" for pid in sorted(set(ids), key=str) if ids.count(pid) > 1]
    if problems:
        raise BuildError(f"{path.name}:\n  " + "\n  ".join(problems))
    return sorted(places, key=lambda place: place_sort_key(place["id"]))


def index_visits(places: list, plan: list) -> dict:
    day_numbers = {row["date"]: n for n, row in enumerate(plan, start=1)}
    slot_places = {(row["date"], key): [] for row in plan for key in SLOT_KEYS}
    slot_of_visit = {}
    problems = []
    for place in places:
        pid = place["id"]
        for visit in place["visits"]:
            try:
                date = parse_plan_date(str(visit.get("date")))
            except BuildError as exc:
                problems.append(f"{pid}: {exc}")
                continue
            slot = visit.get("slot")
            target = slot_places.get((date, slot)) if one_of(slot, SLOT_KEYS) else None
            if target is None:
                problems.append(f"{pid}: visit {visit.get('date')} / {slot!r} matches no plan day and slot")
            elif visit.get("day") is not None and visit["day"] != day_numbers[date]:
                problems.append(f"{pid}: visit {visit.get('date')} says day {visit['day']}, the plan says {day_numbers[date]}")
            elif (date, pid) in slot_of_visit:
                # The UI keys ticks and detail panels by date + place, so two visits on one date would share them.
                problems.append(f"{pid}: two visits on {visit.get('date')} ({slot_of_visit[(date, pid)]} and {slot}); "
                                "a place can appear once per day")
            else:
                slot_of_visit[(date, pid)] = slot
                target.append(pid)
    if problems:
        raise BuildError("mekanlar.json visits do not match the plan:\n  " + "\n  ".join(problems))
    return {key: sorted(ids, key=place_sort_key) for key, ids in slot_places.items()}


# ---------- warnings ----------

def warning_problem(entry) -> str | None:
    if not isinstance(entry, dict) or not text_or_none(entry.get("text")):
        return "needs an object with a non-empty 'text'"
    if not one_of(entry.get("level"), WARNING_LEVELS):
        return f"level {entry.get('level')!r} is not one of {', '.join(sorted(WARNING_LEVELS))}"
    return None


def resolve_visit_key(key: str, places_by_id: dict) -> str | None:
    """Returns a problem description, or None when the key names a real visit."""
    date_text, sep, pid = key.partition("|")
    try:
        date = dt.date.fromisoformat(date_text)
    except ValueError:
        date = None
    if not sep or date is None or date.isoformat() != date_text:
        return "key must look like YYYY-MM-DD|placeId"
    if pid not in places_by_id:
        return f"no place {pid!r}"
    visit_dates = {parse_plan_date(str(v.get("date"))) for v in places_by_id[pid]["visits"]}
    return None if date in visit_dates else f"{pid} has no visit on {date_text}"


def load_warnings(path: Path, places: list) -> tuple:
    data = read_json(path)
    if not isinstance(data, dict):
        raise BuildError(f"{path.name}: expected an object with 'place' and 'visit' sections")
    places_by_id = {place["id"]: place for place in places}
    sections = {name: data.get(name, {}) for name in ("place", "visit")}
    problems = [f"unknown section {k!r}" for k in data if not k.startswith("_") and k not in sections]
    problems += [f"section {name!r} must be an object" for name, value in sections.items() if not isinstance(value, dict)]
    if problems:
        raise BuildError(f"{path.name}:\n  " + "\n  ".join(problems))
    place_short, visit_warnings = {}, {}
    for key, entry in sections["place"].items():
        problem = warning_problem(entry) if key in places_by_id else "no such place"
        if problem:
            problems.append(f"place[{key!r}]: {problem}")
        else:
            place_short[key] = {"level": entry["level"], "text": entry["text"]}
    for key, entry in sections["visit"].items():
        problem = resolve_visit_key(key, places_by_id) or warning_problem(entry)
        if problem:
            problems.append(f"visit[{key!r}]: {problem}")
        else:
            visit_warnings[key] = {"level": entry["level"], "text": entry["text"]}
    if problems:
        raise BuildError(f"{path.name} has entries that resolve to nothing or break the UI:\n  " + "\n  ".join(problems))
    return place_short, dict(sorted(visit_warnings.items()))


def load_inputs(root: Path) -> Inputs:
    plan = load_plan(root / "plan" / "Russia_Plan_Basic.csv")
    places = load_places(root / "mekanlar" / "mekanlar.json")
    slot_places = index_visits(places, plan)
    place_short, visit_warnings = load_warnings(root / "plan" / "uyarilar.json", places)
    return Inputs(plan, places, slot_places, place_short, visit_warnings)


# ---------- sunrise / sunset (NOAA solar calculator) ----------

def _solar_position(t: float) -> tuple:
    """Equation of time (minutes) and declination (degrees) at Julian century t."""
    l0 = (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360
    m = math.radians(357.52911 + t * (35999.05029 - 0.0001537 * t))
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    center = (math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t))
              + math.sin(2 * m) * (0.019993 - 0.000101 * t) + math.sin(3 * m) * 0.000289)
    omega = math.radians(125.04 - 1934.136 * t)
    apparent_long = math.radians(l0 + center - 0.00569 - 0.00478 * math.sin(omega))
    mean_obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    obliquity = math.radians(mean_obliquity + 0.00256 * math.cos(omega))
    declination = math.degrees(math.asin(math.sin(obliquity) * math.sin(apparent_long)))
    y = math.tan(obliquity / 2) ** 2
    l0r = math.radians(l0)
    eq_time = 4 * math.degrees(
        y * math.sin(2 * l0r) - 2 * e * math.sin(m) + 4 * e * y * math.sin(m) * math.cos(2 * l0r)
        - 0.5 * y * y * math.sin(4 * l0r) - 1.25 * e * e * math.sin(2 * m))
    return eq_time, declination


def _event_utc_minutes(jd: float, lat: float, lon: float, rising: bool) -> float:
    eq_time, declination = _solar_position((jd - 2451545.0) / 36525.0)
    lat_r, dec_r = math.radians(lat), math.radians(declination)
    cos_ha = (math.cos(math.radians(SUNRISE_ZENITH_DEG)) / (math.cos(lat_r) * math.cos(dec_r))
              - math.tan(lat_r) * math.tan(dec_r))
    if not -1 <= cos_ha <= 1:
        raise BuildError(f"the sun does not rise or set at {lat}, {lon} on JD {jd}")
    hour_angle = math.degrees(math.acos(cos_ha)) * (1 if rising else -1)
    return 720 - 4 * (lon + hour_angle) - eq_time


def _hhmm(total_minutes: float) -> str:
    minutes = math.floor(total_minutes + 0.5) % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def sun_times(day: dt.date, lat: float, lon: float, utc_offset_hours: float) -> tuple:
    """Local ("HH:MM", "HH:MM") sunrise and sunset; lon is east-positive."""
    jd_midnight = day.toordinal() + 1721424.5
    local = []
    for rising in (True, False):
        first = _event_utc_minutes(jd_midnight, lat, lon, rising)
        refined = _event_utc_minutes(jd_midnight + first / 1440, lat, lon, rising)
        local.append(_hhmm(refined + utc_offset_hours * 60))
    return tuple(local)


# ---------- trip.json assembly ----------

def photo_credit(image: dict) -> str:
    if image["source"] == "wikimedia":
        parts = ["Wikimedia Commons", image.get("author"), image.get("license")]
        return " · ".join(" ".join(p.split()) for p in parts if text_or_none(p))
    host = (urlsplit(image["page_url"]).hostname or "").removeprefix("www.")
    if not host:
        raise BuildError(f"no host in page_url {image['page_url']!r} for a bing photo credit")
    return host


def photo_record(place_id: str, n: int, image: dict, photo_size) -> dict:
    width, height = photo_size(place_id, n)
    return {"src": f"img/{place_id}-{n}.webp", "thumb": f"img/{place_id}-{n}-t.webp", "w": width, "h": height,
            "credit": photo_credit(image), "page": text_or_none(image.get("page_url"))}


def place_record(place: dict, short, photo_size) -> dict:
    pid, found = place["id"], place["status"] != "not_found"
    stops = place.get("stops")
    return {
        "id": pid,
        "name": place["name"],
        "local": text_or_none(place.get("name_local")),
        "nameEn": text_or_none(place.get("name_en")),
        "branch": text_or_none(place.get("branch")),
        "category": place["category"],
        "city": PLACE_PREFIXES[pid.split("-")[0]],
        "status": place["status"],
        "short": short,
        "statusNote": text_or_none(place.get("status_note")),
        "notes": text_or_none(place.get("notes")),
        "address": text_or_none(place.get("address")) if found else None,
        "lat": place["lat"] if found else None,
        "lon": place["lon"] if found else None,
        "website": text_or_none(place.get("website")),
        "stops": [{"name": s["name"], "lat": s["lat"], "lon": s["lon"]} for s in stops] if stops else None,
        "photos": [photo_record(pid, n, image, photo_size)
                   for n, image in enumerate(place["images"], start=1)] if found else [],
    }


def day_record(inputs: Inputs, index: int) -> dict:
    row = inputs.plan[index]
    city, from_city = day_city(inputs.plan, index)
    sunrise, sunset = sun_times(row["date"], *CITY_COORDS[city], UTC_OFFSET_HOURS)
    return {
        "n": index + 1,
        "date": row["date"].isoformat(),
        "weekday": WEEKDAYS_TR[row["date"].weekday()],
        "city": city,
        "transit": from_city is not None,
        **({"from": from_city} if from_city is not None else {}),
        "sunrise": sunrise,
        "sunset": sunset,
        "slots": [{"key": key, "plan": cell, "places": inputs.slot_places[(row["date"], key)]}
                  for key, cell in zip(SLOT_KEYS, row["cells"])],
    }


def dump_json(obj, **options) -> str:
    """json.dumps that refuses NaN/Infinity: the browser's JSON.parse would reject the whole file."""
    try:
        return json.dumps(obj, ensure_ascii=False, allow_nan=False, **options)
    except ValueError as exc:
        raise BuildError(f"trip.json would not be valid JSON: {exc}") from exc


def content_version(content: dict) -> str:
    canonical = dump_json(content, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:12]


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def assemble(inputs: Inputs, photo_size, generated_at: str | None = None) -> dict:
    """version hashes everything emitted except generatedAt, so any content change gets a new version."""
    content = {
        "verifiedOn": VERIFIED_ON,
        "timezone": TIMEZONE,
        "utcOffsetHours": UTC_OFFSET_HOURS,
        "dayRolloverHour": DAY_ROLLOVER_HOUR,
        "slots": SLOTS,
        "cities": CITIES,
        "days": [day_record(inputs, i) for i in range(len(inputs.plan))],
        "places": {p["id"]: place_record(p, inputs.place_short.get(p["id"]), photo_size) for p in inputs.places},
        "visitWarnings": inputs.visit_warnings,
    }
    return {"version": content_version(content), "generatedAt": generated_at or utc_now_iso(), **content}


def build_trip(root: Path, photo_size, generated_at: str | None = None) -> dict:
    """photo_size(place_id, n) -> (w, h) of the detail webp."""
    return assemble(load_inputs(Path(root)), photo_size, generated_at)


# ---------- images + provenance ----------

def fit_within(size: tuple, long_side: int) -> tuple:
    width, height = size
    if max(width, height) <= long_side:
        return size
    if width >= height:
        return long_side, max(1, round(height * long_side / width))
    return max(1, round(width * long_side / height)), long_side


def encode_webp(image: Image.Image, variant: Variant) -> bytes:
    target = fit_within(image.size, variant.long_side)
    resized = image if target == image.size else image.resize(target, Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    resized.save(buffer, "WEBP", quality=variant.quality, method=WEBP_METHOD)
    return buffer.getvalue()


def write_if_changed(path: Path, data: bytes) -> bool:
    if path.is_file() and path.read_bytes() == data:
        return False
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)
    return True


def provenance_prompt(image: dict) -> str:
    segments = [f"Origin page: {image['page_url']}", f"Image URL: {image['image_url']}",
                f"Found via: {image['source']}"]
    segments += [f"{label}: {' '.join(image[key].split())}"
                 for label, key in (("License", "license"), ("Author", "author")) if text_or_none(image.get(key))]
    segments.append(f"Resized for offline trip app, {RESIZED_ON}")
    return "Sourced photo (not generated). " + " | ".join(segments)


def embed_tool() -> Path:
    tool = Path(os.environ.get("IMPECCABLE", DEFAULT_EMBED_TOOL))
    if not os.access(tool, os.X_OK):
        raise BuildError(f"provenance tool not executable: {tool} (set IMPECCABLE to override)")
    return tool


def run_embed(tool: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([str(tool), "embed-prompt", *args], capture_output=True,
                          encoding="utf-8", errors="replace", timeout=120)


def ensure_provenance(tool: Path, path: Path, prompt: str) -> str:
    """Returns 'kept', 'embedded' or 'sidecar'; raises BuildError when the tool fails."""
    current = run_embed(tool, str(path), "--read")
    if current.returncode == 0 and current.stdout.strip() == prompt:
        return "kept"
    result = run_embed(tool, str(path), "--prompt", prompt)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise BuildError(f"embed-prompt failed for {path.name} (exit {result.returncode}): {detail}")
    return "sidecar" if "sidecar" in result.stdout else "embedded"


@dataclass
class RenderResult:
    sizes: dict = field(default_factory=dict)
    written: int = 0
    unchanged: int = 0
    provenance: dict = field(default_factory=lambda: {"kept": 0, "embedded": 0, "sidecar": 0})
    failures: list = field(default_factory=list)


def render_photos(root: Path, places: list, tool: Path, img_dir: Path) -> RenderResult:
    result = RenderResult()
    for place in places:
        if place["status"] == "not_found":
            continue
        for n, image in enumerate(place["images"], start=1):
            source_path = root / "mekanlar" / place["folder"] / image["file"]
            if not source_path.is_file():
                raise BuildError(f"{place['id']} photo {n}: missing source {source_path}")
            with Image.open(source_path) as opened:
                source = ImageOps.exif_transpose(opened).convert("RGB")
            prompt = provenance_prompt(image)
            for variant in VARIANTS:
                out = img_dir / f"{place['id']}-{n}{variant.suffix}.webp"
                if write_if_changed(out, encode_webp(source, variant)):
                    result.written += 1
                else:
                    result.unchanged += 1
                try:
                    result.provenance[ensure_provenance(tool, out, prompt)] += 1
                except (BuildError, subprocess.TimeoutExpired, OSError) as exc:
                    result.failures.append(str(exc))
            with Image.open(img_dir / f"{place['id']}-{n}.webp") as detail:
                result.sizes[(place["id"], n)] = detail.size
    return result


# ---------- outputs + report ----------

def write_trip_json(path: Path, trip: dict) -> tuple:
    """Keeps the previous generatedAt when the content version is unchanged (byte-stable reruns)."""
    try:
        previous = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previous = None
    if isinstance(previous, dict) and previous.get("version") == trip["version"] \
            and isinstance(previous.get("generatedAt"), str):
        trip = {**trip, "generatedAt": previous["generatedAt"]}
    data = (dump_json(trip, indent=1) + "\n").encode("utf-8")
    return write_if_changed(path, data), len(data), trip


def expected_image_names(sizes: dict) -> set:
    names = {f"{pid}-{n}{variant.suffix}.webp" for pid, n in sizes for variant in VARIANTS}
    return names | {f"{name}.json" for name in names}


def img_dir_report(img_dir: Path, expected: set) -> dict:
    report = {"files": 0, "bytes": 0, "webp_bytes": 0, "sidecar_bytes": 0, "orphans": []}
    for entry in sorted(img_dir.iterdir()):
        if entry.is_dir() or entry.name not in expected:
            report["orphans"].append(entry.name + ("/" if entry.is_dir() else ""))
        if entry.is_file():
            size = entry.stat().st_size
            report["files"] += 1
            report["bytes"] += size
            report["webp_bytes" if entry.suffix == ".webp" else "sidecar_bytes"] += size
    return report


def mb(count: int) -> str:
    return f"{count / 1_000_000:.2f} MB"


def build(root: Path) -> int:
    inputs = load_inputs(root)
    tool = embed_tool()
    img_dir, trip_path = root / "app" / "img", root / "app" / "data" / "trip.json"
    img_dir.mkdir(parents=True, exist_ok=True)
    trip_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = render_photos(root, inputs.places, tool, img_dir)
    trip = assemble(inputs, lambda pid, n: rendered.sizes[(pid, n)])
    written, trip_bytes, trip = write_trip_json(trip_path, trip)
    scan = run_embed(tool, "--scan", str(img_dir))
    stats = img_dir_report(img_dir, expected_image_names(rendered.sizes))

    print(f"trip.json: {'written' if written else 'unchanged'}, {trip_bytes} bytes, version {trip['version']}, "
          f"generatedAt {trip['generatedAt']}")
    print(f"webp: {rendered.written} written, {rendered.unchanged} unchanged")
    print("provenance: " + ", ".join(f"{k} {v}" for k, v in rendered.provenance.items())
          + " (sidecar = embed-prompt stores WebP prompts in <file>.webp.json)")
    print(f"app/img: {stats['files']} files, {stats['bytes']} bytes ({mb(stats['bytes'])}); "
          f"webp {mb(stats['webp_bytes'])}, other {mb(stats['sidecar_bytes'])}")
    print("orphans in app/img: " + (", ".join(stats["orphans"]) if stats["orphans"] else "none"))
    print("embed-prompt --scan: " + (scan.stdout.strip().splitlines() or ["(no output)"])[-1])

    failed = False
    if rendered.failures:
        failed = True
        print(f"build_trip: ERROR: {len(rendered.failures)} provenance embeds failed:", file=sys.stderr)
        for failure in rendered.failures[:20]:
            print(f"  {failure}", file=sys.stderr)
    if scan.returncode != 0:
        failed = True
        print(f"build_trip: ERROR: embed-prompt --scan exit {scan.returncode}:\n{scan.stdout}{scan.stderr}",
              file=sys.stderr)
    return 1 if failed else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Build app/data/trip.json and app/img/ for the trip app.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent,
                        help="project root holding plan/, mekanlar/ and app/ (default: repo root)")
    args = parser.parse_args(argv)
    try:
        return build(args.root.resolve())
    except BuildError as exc:
        print(f"build_trip: ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
