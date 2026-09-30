#!/usr/bin/env python3
"""Turn each day's photos into the page's memories: hatiralar/<date>/* → app/memories/<date>/ + app/data/memories.json.

Put a day's photos (JPEG, PNG or WebP) into hatiralar/2026-12-20/ and so on, then run:

    python3 tools/build_memories.py && python3 tools/build_sw.py

Photos are turned upright, scaled (1600 px long side, 480 px thumbnails) and re-encoded as WebP with no metadata,
so no location (GPS) or camera details leave the computer. They are ordered by the time they were taken (EXIF),
then by file name. An optional aciklamalar.txt in the day's folder adds captions, one per line:

    kizil-meydan.jpg = Kızıl Meydan'da ilk kar
"""
import argparse
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "hatiralar"
OUT_DIR = ROOT / "app" / "memories"
OUT_JSON = ROOT / "app" / "data" / "memories.json"
PHOTO_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
SIZES = {"": (1600, 72), "-t": (480, 60)}  # file suffix: (long side px, WebP quality)
CAPTIONS = "aciklamalar.txt"
DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EXIF_IFD = 0x8769
DATETIME_ORIGINAL = 0x9003
DATETIME = 0x0132


def taken_at(image: Image.Image) -> str | None:
    """'HH:MM' the photo was taken, from EXIF; None when the camera did not say."""
    exif = image.getexif()
    value = exif.get_ifd(EXIF_IFD).get(DATETIME_ORIGINAL) or exif.get(DATETIME)
    match = re.match(r"\d{4}:\d{2}:\d{2} (\d{2}):(\d{2})", str(value or ""))
    return f"{match[1]}:{match[2]}" if match else None


def read_captions(folder: Path) -> dict:
    """{file name: caption} from the folder's aciklamalar.txt ("name = caption" lines); missing file → {}."""
    path = folder / CAPTIONS
    if not path.exists():
        return {}
    captions = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        name, sep, text = line.partition("=")
        if sep and name.strip() and text.strip():
            captions[name.strip()] = text.strip()
    return captions


def slug(stem: str) -> str:
    """A web-safe file name: lower case ASCII letters, digits and dashes."""
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return re.sub(r"[^a-z0-9]+", "-", stem.translate(table).lower()).strip("-") or "foto"


def ordered(photos: list) -> list:
    """Photos with a time first, earliest first; photos without one after them, by file name."""
    return sorted(photos, key=lambda p: (p["time"] is None, p["time"] or "", p["name"]))


def encode(image: Image.Image, side: int, quality: int) -> bytes:
    copy = image.copy()
    copy.thumbnail((side, side), Image.LANCZOS)
    buffer = io.BytesIO()
    copy.save(buffer, "WEBP", quality=quality, method=6)  # no exif= argument: metadata is never written
    return buffer.getvalue()


def write_if_changed(path: Path, data: bytes) -> bool:
    if path.exists() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def build_day(folder: Path, out_root: Path) -> tuple[list, int]:
    """The day's photo entries, and how many files were (re)written."""
    captions = read_captions(folder)
    photos, written, used = [], 0, set()
    for path in sorted(p for p in folder.iterdir() if p.suffix.lower() in PHOTO_SUFFIXES):
        with Image.open(path) as raw:
            time = taken_at(raw)
            image = ImageOps.exif_transpose(raw).convert("RGB")
        name = slug(path.stem)
        while name in used:
            name += "-2"
        used.add(name)
        for suffix, (side, quality) in SIZES.items():
            written += write_if_changed(out_root / folder.name / f"{name}{suffix}.webp", encode(image, side, quality))
        width, height = image.size
        scale = min(1.0, SIZES[""][0] / max(width, height))
        photos.append({
            "name": path.name, "time": time, "caption": captions.get(path.name),
            "src": f"memories/{folder.name}/{name}.webp", "thumb": f"memories/{folder.name}/{name}-t.webp",
            "w": round(width * scale), "h": round(height * scale),
        })
    return [{k: v for k, v in photo.items() if k != "name"} for photo in ordered(photos)], written


def build(source: Path, out_root: Path, out_json: Path) -> dict:
    days, written = {}, 0
    folders = sorted(p for p in source.iterdir() if p.is_dir() and DATE_DIR.match(p.name)) if source.exists() else []
    for folder in folders:
        photos, count = build_day(folder, out_root)
        written += count
        if photos:
            days[folder.name] = photos
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(days, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    shipped = {Path(p[key]).name for photos in days.values() for p in photos for key in ("src", "thumb")}
    orphans = sorted(str(p.relative_to(out_root)) for p in out_root.rglob("*.webp") if p.name not in shipped) if out_root.exists() else []
    return {"days": len(days), "photos": sum(len(v) for v in days.values()), "written": written, "orphans": orphans}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=SOURCE, help="folder of <YYYY-MM-DD> photo folders")
    args = parser.parse_args(argv)
    report = build(args.source, OUT_DIR, OUT_JSON)
    print(f"memories: {report['photos']} photos on {report['days']} days, {report['written']} files written")
    for orphan in report["orphans"]:
        print(f"  not in any day any more (delete by hand if unwanted): app/memories/{orphan}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
