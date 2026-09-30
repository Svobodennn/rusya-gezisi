"""Tests for tools/build_sw.py.

How this can break (the tests below are derived from this list):
 1. A file the app never requests is precached (dotfile, `.x.webp.tmp` left by an interrupted
    image write, provenance sidecar, test file, sw.js itself, unknown extension): wasted bytes on a
    throttled network, or an install that fails on a file the host does not serve.
 2. index.html listed next to "./": downloaded twice, and hosts that redirect /index.html to /
    hand back a redirect.
 3. "./" not carrying index.html's hash: an edited page is copied stale from the old cache.
 4. A hash that is not of the file's bytes: a changed file is copied stale, or an unchanged one
    downloaded again.
 5. VERSION unchanged when a (path, hash) pair changes: the update reuses the working version's
    cache name, finds every file "already cached" and never fetches the change.
 6. FILES rendered in a shape the worker cannot read.
"""
import hashlib
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

import build_sw

SHIPPED = {
    "index.html": b"<!doctype html>",
    "app.js": b"console",
    "app.css": b"body{}",
    "data/trip.json": b"{}",
    "fonts/sofia.woff2": b"woff",
    "icons/icon-192.png": b"png",
    "img/msk-01-1.webp": b"webp",
    "manifest.webmanifest": b"{}",
}
SKIPPED = {
    "sw.js": b"old worker",
    ".DS_Store": b"x",
    "img/.msk-01-1.webp.tmp": b"half-written",
    "img/msk-01-1.webp.json": b"{}",
    "icons/icon-192.png.json": b"{}",
    "logic.test.mjs": b"test",
    "notes.txt": b"x",
    "img/photo.jpg": b"jpg",
    ".cache/extra.js": b"x",
}


def sha1_12(data):
    return hashlib.sha1(data).hexdigest()[:12]


class BuildSwTest(unittest.TestCase):
    def setUp(self):
        self.app = Path(tempfile.mkdtemp(prefix="build_sw_test_"))
        self.addCleanup(shutil.rmtree, self.app)
        for rel, data in {**SHIPPED, **SKIPPED}.items():
            self.write(rel, data)

    def write(self, rel, data):
        path = self.app / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def test_ships_allowlisted_app_files_only_with_the_page_as_dot_slash(self):
        paths = [path for path, _ in build_sw.file_entries(self.app)]
        expected = sorted(rel for rel in SHIPPED if rel != "index.html")
        self.assertEqual(paths, ["./", *expected])

    def test_each_hash_is_the_first_12_hex_of_the_files_sha1(self):
        hashes = dict(build_sw.file_entries(self.app))
        self.assertEqual(hashes["./"], sha1_12(SHIPPED["index.html"]))
        for rel, data in SHIPPED.items():
            if rel != "index.html":
                self.assertEqual(hashes[rel], sha1_12(data), rel)

    def test_version_follows_every_shipped_byte_and_path_only(self):
        version = build_sw.content_version(build_sw.file_entries(self.app))
        self.write("img/msk-01-1.webp.json", b'{"prompt": "changed"}')
        self.write(".DS_Store", b"changed")
        self.assertEqual(build_sw.content_version(build_sw.file_entries(self.app)), version)
        self.write("index.html", b"<!doctype html><p>")
        edited = build_sw.content_version(build_sw.file_entries(self.app))
        self.assertNotEqual(edited, version)
        (self.app / "app.css").rename(self.app / "main.css")
        self.assertNotEqual(build_sw.content_version(build_sw.file_entries(self.app)), edited)

    def test_rendered_worker_carries_version_and_files(self):
        entries = build_sw.file_entries(self.app)
        version = build_sw.content_version(entries)
        rendered = build_sw.render(build_sw.TEMPLATE.read_text(encoding="utf-8"), version, entries)
        self.assertNotIn("__VERSION__", rendered)
        self.assertNotIn("__FILES__", rendered)
        self.assertIn(f"const VERSION = '{version}';", rendered)
        files = re.search(r"^const FILES = (\[.*?^\]);$", rendered, re.S | re.M)
        self.assertIsNotNone(files)
        self.assertEqual(json.loads(files.group(1)), [list(entry) for entry in entries])


if __name__ == "__main__":
    unittest.main()
