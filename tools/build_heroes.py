#!/usr/bin/env python3
"""Pick each day's hero photo and write it at hero size.

For every trip day the hero is the first sightseeing (afternoon) stop with photos, else an evening sight
(a square, a museum, a street), else the city's emblem (Red Square / the Hermitage); cafés and stations never lead. Among the place's
three photos the widest landscape one wins, because the hero is a wide band.

Writes app/img/hero-<placeId>.webp (long side ≤ 1600 px) and app/data/heroes.json {date: {...}}.
Run after tools/build_trip.py; then tools/build_sw.py.
"""
import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
TRIP = ROOT / "app" / "data" / "trip.json"
PLACES = ROOT / "mekanlar" / "mekanlar.json"
OUT_IMG = ROOT / "app" / "img"
OUT_JSON = ROOT / "app" / "data" / "heroes.json"
CITY_EMBLEM = {"moscow": "msk-06", "spb": "spb-06"}
MAX_SIDE = 1600
QUALITY = 60
# The design tool that stamps provenance into each rendered image; override with $IMPECCABLE.
IMPECCABLE = os.environ.get(
    "IMPECCABLE",
    str(Path.home() / ".claude-personal/plugins/cache/impeccable/impeccable/4.2.0/skills/impeccable/scripts/impeccable"),
)


def source_photos(place: dict) -> list[tuple[Path, dict]]:
    folder = ROOT / "mekanlar" / place.get("folder", "")
    return [(folder / img["file"], img) for img in place.get("images", []) if (folder / img["file"]).exists()]


def widest(photos: list[tuple[Path, dict]]) -> tuple[Path, dict] | None:
    def aspect(item):
        with Image.open(item[0]) as im:
            w, h = ImageOps.exif_transpose(im).size
        return w / h
    return max(photos, key=aspect, default=None)


SIGHTS = {"landmark", "museum", "park", "street", "area", "viewpoint", "venue", "shopping"}


def hero_place(day: dict, trip: dict, raw: dict) -> str:
    slots = {s["key"]: s["places"] for s in day["slots"]}
    evening_sights = [pid for pid in slots.get("evening", []) if trip["places"][pid]["category"] in SIGHTS]
    for pid in slots.get("afternoon", []) + evening_sights:
        if source_photos(raw[pid]) and trip["places"][pid]["status"] not in ("closed", "not_found"):
            return pid
    return CITY_EMBLEM[day["city"]]


def write_hero(pid: str, source: Path, meta: dict) -> dict:
    target = OUT_IMG / f"hero-{pid}.webp"
    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(target, "WEBP", quality=QUALITY, method=6)
        w, h = im.size
    origin = (f"Sourced photo (not generated). Origin page: {meta.get('page_url')} | Image URL: {meta.get('image_url')} "
              f"| Found via: {meta.get('source')} | Resized as day hero for the offline trip app, 2026-09-30")
    subprocess.run([IMPECCABLE, "embed-prompt", str(target), "--prompt", origin], check=True, capture_output=True)
    host = (meta.get("page_url") or "").split("/")[2].removeprefix("www.") if meta.get("page_url") else ""
    return {"src": f"img/{target.name}", "w": w, "h": h, "credit": host or meta.get("source", ""), "page": meta.get("page_url")}


def main() -> None:
    trip = json.loads(TRIP.read_text(encoding="utf-8"))
    raw = {p["id"]: p for p in json.loads(PLACES.read_text(encoding="utf-8"))["places"]}
    written: dict[str, dict] = {}
    heroes = {}
    for day in trip["days"]:
        pid = hero_place(day, trip, raw)
        if pid not in written:
            source, meta = widest(source_photos(raw[pid]))
            written[pid] = write_hero(pid, source, meta)
        heroes[day["date"]] = {"place": pid, **written[pid]}
    OUT_JSON.write_text(json.dumps(heroes, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = sum((OUT_IMG / f"hero-{pid}.webp").stat().st_size for pid in written)
    print(f"heroes: {len(heroes)} days, {len(written)} images, {size / 1e6:.1f} MB -> {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
