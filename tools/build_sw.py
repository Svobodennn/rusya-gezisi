#!/usr/bin/env python3
"""Render app/sw.js from tools/sw.template.js with every shipped file and its content hash.

Run after anything in app/ changes (including `tools/build_trip.py`): a new hash is what makes
installed phones fetch the update, and the per-file hashes let them fetch only what changed.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
TEMPLATE = ROOT / "tools" / "sw.template.js"
SHIPPED_SUFFIXES = {".html", ".css", ".js", ".json", ".webmanifest", ".woff2", ".webp", ".png", ".svg"}
# Provenance sidecars (written by `impeccable embed-prompt`) stay on disk but are never fetched by the app.
SKIP_SUFFIXES = (".test.mjs", ".webp.json", ".png.json")
SKIP_NAMES = {"sw.js"}
# The page is cached once, under "./" (the URL the app is opened at), with index.html's hash.
PAGE = "index.html"


def is_shipped(rel: Path) -> bool:
    return (rel.suffix in SHIPPED_SUFFIXES and rel.name not in SKIP_NAMES
            and not rel.name.endswith(SKIP_SUFFIXES) and not any(part.startswith(".") for part in rel.parts))


def file_hash(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:12]


def file_entries(app_dir: Path) -> list:
    """[["./", hash of index.html], [path, hash], ...] with paths relative to app_dir, sorted."""
    page = app_dir / PAGE
    if not page.is_file():
        raise FileNotFoundError(f"{page} is missing")
    rels = sorted(path.relative_to(app_dir) for path in app_dir.rglob("*") if path.is_file())
    return [["./", file_hash(page)]] + [[rel.as_posix(), file_hash(app_dir / rel)]
                                        for rel in rels if is_shipped(rel) and rel.as_posix() != PAGE]


def content_version(entries: list) -> str:
    canonical = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:10]


def render(template: str, version: str, entries: list) -> str:
    listing = "[\n" + ",\n".join(f"  {json.dumps(entry, ensure_ascii=False)}" for entry in entries) + "\n]"
    return template.replace("__VERSION__", version).replace("__FILES__", listing)


def main() -> int:
    try:
        entries = file_entries(APP)
    except OSError as exc:
        print(f"build_sw: ERROR: {exc}", file=sys.stderr)
        return 1
    version = content_version(entries)
    rendered = render(TEMPLATE.read_text(encoding="utf-8"), version, entries).encode("utf-8")
    target = APP / "sw.js"
    changed = not target.is_file() or target.read_bytes() != rendered
    if changed:
        tmp = target.with_name(f".{target.name}.tmp")
        tmp.write_bytes(rendered)
        os.replace(tmp, target)
    size = sum((APP / (PAGE if path == "./" else path)).stat().st_size for path, _ in entries)
    print(f"app/sw.js: {'written' if changed else 'unchanged'}, {len(entries)} entries, "
          f"{size / 1_000_000:.1f} MB, version {version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
