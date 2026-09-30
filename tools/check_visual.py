#!/usr/bin/env python3
"""Pixel-exact visual regression check for app/, for refactors that must not change a single pixel.

    python3 tools/check_visual.py --baseline   # capture .impeccable/baseline/*.png
    python3 tools/check_visual.py              # capture again and compare with the baseline

Renders are made deterministic: the clock is frozen with ?now=, motion is reduced (no tweens, no twinkle),
Math.random is seeded, the snow canvas (random by design) is hidden, the service worker is blocked and every lazy
image is awaited. --app captures another copy of the app, e.g. an archived pre-refactor one, as the baseline.
"""
import argparse
import io
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
BASELINE = ROOT / ".impeccable" / "baseline"
PORT = 8791
DESKTOP = {"viewport": {"width": 1440, "height": 900}}
MOBILE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}
MOSCOW_DAY = "2026-12-20T13:00:00Z"
SPB_DAY = "2027-01-06T13:00:00Z"
NEW_YEAR = "2026-12-31T13:00:00Z"
BEFORE_TRIP = "2026-10-01T09:00:00Z"

SEED_RANDOM = """(() => {
  let seed = 20261231;
  Math.random = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();"""

HIDE_SNOW = ".hero-snow { visibility: hidden !important; }"

SETTLE = """async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  await Promise.all([...document.images].map((img) => img.complete ? null
    : new Promise((resolve) => { img.onload = img.onerror = resolve; })));
  await document.fonts.ready;
  window.scrollTo(0, 0);
}"""


def shots():
    """(name, context options, now, action) for every capture; action runs after the page settles."""
    def full(page):
        return page.screenshot(full_page=True)

    def viewport(page):
        return page.screenshot()

    def city_map(page):
        page.locator('[data-map-mode="city"]').click()
        page.wait_for_timeout(300)
        return page.locator("#map").screenshot()

    def taxi(page):
        page.locator("[data-taxi]").first.click()
        page.wait_for_selector("#taxi[open]")
        return page.screenshot()

    return [
        ("desktop-moscow-full", DESKTOP, MOSCOW_DAY, full),
        ("desktop-spb-viewport", DESKTOP, SPB_DAY, viewport),
        ("desktop-map-city", DESKTOP, MOSCOW_DAY, city_map),
        ("mobile-new-year-full", MOBILE, NEW_YEAR, full),
        ("mobile-spb-full", MOBILE, SPB_DAY, full),
        ("mobile-taxi", MOBILE, MOSCOW_DAY, taxi),
        ("mobile-before-trip-full", MOBILE, BEFORE_TRIP, full),
    ]


def capture(browser) -> dict:
    images = {}
    for name, options, now, action in shots():
        context = browser.new_context(service_workers="block", reduced_motion="reduce", bypass_csp=True, **options)
        context.add_init_script(SEED_RANDOM)
        page = context.new_page()
        page.goto(f"http://localhost:{PORT}/?now={now}")
        page.wait_for_selector(".slot")
        page.add_style_tag(content=HIDE_SNOW)
        page.evaluate(SETTLE)
        page.wait_for_timeout(300)
        images[name] = Image.open(io.BytesIO(action(page))).convert("RGB")
        context.close()
    return images


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--baseline", action="store_true", help="capture the baseline instead of comparing")
    parser.add_argument("--app", type=Path, default=APP, help="app directory to serve (default: app/)")
    args = parser.parse_args()
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", str(args.app)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            images = capture(browser)
            browser.close()
    finally:
        server.terminate()

    if args.baseline:
        BASELINE.mkdir(parents=True, exist_ok=True)
        for name, image in images.items():
            image.save(BASELINE / f"{name}.png")
        print(f"baseline: {len(images)} captures in {BASELINE}")
        return 0

    failures = 0
    for name, image in images.items():
        base = Image.open(BASELINE / f"{name}.png").convert("RGB")
        if base.size != image.size:
            print(f"FAIL {name}: size {image.size} vs baseline {base.size}")
            failures += 1
            continue
        box = ImageChops.difference(base, image).getbbox()
        if box:
            image.save(BASELINE / f"{name}.actual.png")
            print(f"FAIL {name}: pixels differ inside {box} (actual saved next to the baseline)")
            failures += 1
        else:
            print(f"PASS {name}: identical")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
