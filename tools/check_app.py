#!/usr/bin/env python3
"""Serve app/, prove it works offline in Chromium, and capture review screenshots.

Usage: python3 tools/check_app.py [--out .impeccable/review]
Exit code 1 when a check fails. Needs Playwright's Chromium.
"""
import argparse
import functools
import http.server
import sys
import threading
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

import build_sw

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
BEFORE_TRIP = "2026-10-01T09:00:00Z"  # a fixed pre-trip moment, so the check never depends on today's date
DAY_2_AFTERNOON = "2026-12-20T13:00:00Z"  # 16:00 Moscow time on day 2: the sightseeing slot is next
DAY_3_EVENING = "2026-12-21T17:00:00Z"  # 20:00 on day 3: the evening venue is closed
SPB_DAY_AFTERNOON = "2027-01-06T13:00:00Z"  # 16:00 on a Petersburg day
CACHED_URLS_JS = "async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)"
MOBILE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):  # noqa: A002 - signature fixed by the base class
        pass


def serve() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(QuietHandler, directory=str(APP))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/"


class Checks:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def expect(self, ok: bool, label: str) -> None:
        print(("PASS " if ok else "FAIL ") + label)
        if not ok:
            self.failures.append(label)


def no_horizontal_overflow(page) -> bool:
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def check_precache(page, base: str, checks: Checks) -> None:
    entries = build_sw.file_entries(APP)
    version = build_sw.content_version(entries)
    worker = (APP / "sw.js").read_text(encoding="utf-8")
    checks.expect(f"const VERSION = '{version}';" in worker, "app/sw.js lists the current app/ (build_sw.py was run)")
    cached = set(page.evaluate(CACHED_URLS_JS, f"rusya-gezisi-{version}"))
    missing = [path for path, _ in entries if urljoin(base, path) not in cached]
    checks.expect(not missing, f"service worker cached all {len(entries)} files (missing: {missing[:3]})")


def check_tick_lights_the_bulb(page, out: Path, checks: Checks) -> None:
    tick = page.locator(".stop").first.locator(".act--tick")
    tick.click()
    checks.expect(tick.get_attribute("aria-pressed") == "true", "ticking the first stop presses its button")
    bulb = page.locator('.slot[data-key="work"] .slot-rail .bulb').get_attribute("data-state")
    checks.expect(bulb == "lit", f"ticking the work stop lights the work bulb (data-state={bulb!r})")
    page.locator('.slot[data-key="work"]').scroll_into_view_if_needed()
    page.wait_for_timeout(700)
    page.screenshot(path=str(out / "mobile-lit.png"))
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector(".slot")


# Walk the page once so lazy photographs are in before a full-page capture.
SCROLL_THROUGH_JS = """async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  window.scrollTo(0, 0);
}"""


# The first match has finished loading and decoded to real pixels.
LOADED_JS = "sel => { const img = document.querySelector(sel); return Boolean(img && img.complete && img.naturalWidth > 0); }"


def check_offline(browser, base: str, out: Path, checks: Checks) -> None:
    context = browser.new_context(**MOBILE)
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    page.goto(f"{base}?now={DAY_2_AFTERNOON}")
    page.wait_for_selector('#offline[data-state="ready"]', timeout=180_000)
    check_precache(page, base, checks)
    checks.expect(page.locator(".slot").count() == 3, "day view renders three slots")
    checks.expect(page.locator('.slot-now').count() == 1, "exactly one slot is marked next at 16:00")
    checks.expect(no_horizontal_overflow(page), "no horizontal overflow at 390px")
    page.screenshot(path=str(out / "mobile-viewport.png"))
    page.evaluate(SCROLL_THROUGH_JS)
    page.wait_for_timeout(600)
    page.screenshot(path=str(out / "mobile.png"), full_page=True)
    check_tick_lights_the_bulb(page, out, checks)

    context.set_offline(True)
    page.reload()
    page.wait_for_selector(".slot", timeout=15_000)
    checks.expect(page.locator(".slot").count() == 3, "offline reload still renders the day")
    page.wait_for_function("document.querySelector('.hero-photo')?.complete", timeout=10_000)
    checks.expect(page.evaluate(LOADED_JS, ".hero-photo"), "offline reload shows the day's cover photograph")
    checks.expect(page.locator("#map .pin").count() >= 1, "offline reload draws the day's stops on the map")
    checks.expect(page.locator("#map .map-svg path").count() > 4, "offline reload draws the city base map")
    cover = page.locator(".card-img--cover").first
    cover.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    checks.expect(page.evaluate(LOADED_JS, ".card-img--cover"), "offline reload shows the first card's photographs")
    page.locator('.nav-btn[data-dir="next"]').click()
    checks.expect(page.url.endswith("#gun-3"), "offline navigation to the next day works")
    route = page.locator("#route-open").get_attribute("href") or ""
    checks.expect(route.startswith("https://yandex.ru/maps/?rtext=~"), "the day route opens in Yandex with every stop")
    page.locator(".stop-toggle").first.click()
    page.wait_for_timeout(400)
    checks.expect(page.locator(".stop-more:not([hidden]) .stop-links").count() == 1, "offline stop detail opens")
    page.screenshot(path=str(out / "mobile-detail.png"))

    page.goto(f"{base}?now={DAY_3_EVENING}#gun-3")
    page.wait_for_selector(".slot")
    dead_next = page.locator('.slot:has(.slot-now) .slot-rail .bulb[data-state="dead"]').count()
    checks.expect(dead_next == 1, "a closed evening venue shows a dead bulb even when it is next")
    page.locator(".slot:has(.slot-now)").scroll_into_view_if_needed()
    page.screenshot(path=str(out / "mobile-dead.png"))

    page.locator("[data-taxi]").first.click()
    page.wait_for_selector("#taxi[open]")
    page.screenshot(path=str(out / "mobile-taxi.png"))
    page.locator("#taxi-close").click()

    page.goto(f"{base}?now={BEFORE_TRIP}")
    page.wait_for_selector(".slot")
    checks.expect(page.locator("#prep:not([hidden])").count() == 1, "before the trip the preparation list is shown")
    page.screenshot(path=str(out / "mobile-before.png"), full_page=True)
    checks.expect(not errors, f"no console errors ({errors[:3]})")
    context.close()


def check_desktop(browser, base: str, out: Path, checks: Checks) -> None:
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.goto(f"{base}?now={DAY_2_AFTERNOON}")
    page.wait_for_selector("#map .pin")
    page.wait_for_timeout(1200)
    checks.expect(no_horizontal_overflow(page), "no horizontal overflow at 1440px")
    page.screenshot(path=str(out / "desktop-viewport.png"))
    page.evaluate(SCROLL_THROUGH_JS)
    page.wait_for_timeout(600)
    page.screenshot(path=str(out / "desktop.png"), full_page=True)
    page.locator('[data-map-mode="city"]').click()
    page.wait_for_timeout(1200)
    checks.expect(page.locator("#map .pin").count() > page.locator(".stop").count(), "city mode shows every stop of the city")
    page.locator("#map").screenshot(path=str(out / "desktop-map-city.png"))
    page.goto(f"{base}?now={SPB_DAY_AFTERNOON}")
    page.wait_for_selector('body[data-city="spb"] #map .pin')
    page.wait_for_timeout(1200)
    page.screenshot(path=str(out / "desktop-spb.png"))
    context.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / ".impeccable" / "review"))
    out = Path(parser.parse_args().out)
    out.mkdir(parents=True, exist_ok=True)
    httpd, base = serve()
    checks = Checks()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            check_offline(browser, base, out, checks)
            check_desktop(browser, base, out, checks)
            browser.close()
    finally:
        httpd.shutdown()
    print(f"\n{len(checks.failures)} failure(s); screenshots in {out}")
    return 1 if checks.failures else 0


if __name__ == "__main__":
    sys.exit(main())
