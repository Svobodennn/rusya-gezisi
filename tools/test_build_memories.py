"""Tests for tools/build_memories.py.

How this breaks, and the test that catches it:
- a phone photo's GPS position or camera details reach the published page → output carries no EXIF at all
- a portrait photo shows up lying on its side → EXIF orientation is applied before scaling
- photos appear out of order, or captions attach to the wrong photo → ordering and caption cases
- a Turkish or spaced file name breaks the URL → slug cases
"""
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

import build_memories as bm

GPS_IFD = 0x8825


def photo(path: Path, size=(40, 30), when=None, orientation=None, gps=False):
    image = Image.new("RGB", size, (200, 30, 30))
    exif = Image.Exif()
    if when:
        exif.get_ifd(bm.EXIF_IFD)[bm.DATETIME_ORIGINAL] = when
    if orientation:
        exif[0x0112] = orientation
    if gps:
        exif.get_ifd(GPS_IFD)[2] = (55.0, 45.0, 7.0)
    image.save(path, "JPEG", exif=exif.tobytes())


class BuildMemoriesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.day = self.tmp / "src" / "2026-12-20"
        self.day.mkdir(parents=True)
        self.out = self.tmp / "out"
        self.json = self.tmp / "memories.json"

    def build(self):
        report = bm.build(self.tmp / "src", self.out, self.json)
        return report, json.loads(self.json.read_text(encoding="utf-8"))

    def test_output_carries_no_metadata_at_all(self):
        photo(self.day / "kar.jpg", when="2026:12:20 18:42:05", gps=True)
        self.build()
        for name in ("kar.webp", "kar-t.webp"):
            with Image.open(self.out / "2026-12-20" / name) as out:
                self.assertEqual(len(out.getexif()), 0, f"{name} must not carry EXIF (GPS, camera)")

    def test_orientation_is_applied_before_scaling(self):
        photo(self.day / "dik.jpg", size=(40, 30), orientation=6)  # stored landscape, shown rotated 90°
        _, days = self.build()
        entry = days["2026-12-20"][0]
        self.assertEqual((entry["w"], entry["h"]), (30, 40))

    def test_photos_are_ordered_by_time_taken_then_by_name(self):
        photo(self.day / "b.jpg", when="2026:12:20 21:00:00")
        photo(self.day / "a.jpg", when="2026:12:20 09:15:00")
        photo(self.day / "c.jpg")
        _, days = self.build()
        self.assertEqual([p["src"].rsplit("/", 1)[1] for p in days["2026-12-20"]], ["a.webp", "b.webp", "c.webp"])
        self.assertEqual([p["time"] for p in days["2026-12-20"]], ["09:15", "21:00", None])

    def test_captions_attach_to_their_file_and_ignore_bad_lines(self):
        photo(self.day / "kar.jpg")
        (self.day / bm.CAPTIONS).write_text("kar.jpg = Kızıl Meydan'da ilk kar\nno separator\n = empty name\n", encoding="utf-8")
        _, days = self.build()
        self.assertEqual(days["2026-12-20"][0]["caption"], "Kızıl Meydan'da ilk kar")

    def test_large_photos_are_scaled_and_get_a_thumbnail(self):
        photo(self.day / "genis.jpg", size=(4000, 3000))
        _, days = self.build()
        entry = days["2026-12-20"][0]
        self.assertEqual((entry["w"], entry["h"]), (1600, 1200))
        with Image.open(self.out / "2026-12-20" / "genis-t.webp") as thumb:
            self.assertEqual(max(thumb.size), 480)

    def test_slug_keeps_urls_plain(self):
        self.assertEqual(bm.slug("Kızıl Meydan Çay"), "kizil-meydan-cay")
        self.assertEqual(bm.slug("IMG_0042"), "img-0042")
        self.assertEqual(bm.slug("!!!"), "foto")

    def test_days_without_photos_and_other_folders_are_left_out(self):
        (self.tmp / "src" / "notlar").mkdir()
        _, days = self.build()
        self.assertEqual(days, {})


if __name__ == "__main__":
    unittest.main()
