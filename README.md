# Rusya Gezisi

An offline trip page for a winter trip to Moscow and St Petersburg (19 December 2026 – 14 January 2027).
It opens on today, shows the day's three stops on one string of lights, what is next and what is wrong with it
(closed venues, odd opening hours), routes there through Yandex Maps, shows the Cyrillic address to a taxi driver,
and draws the day's route on an offline map of the city. It is a static PWA: once opened with a connection it keeps
working without one.

Turkish interface, Cyrillic addresses, no accounts, no server: ticks ("Gittik") stay on each phone.

## Run it

```bash
python3 -m http.server 8000 -d app
# open http://localhost:8000/?now=2026-12-20T13:00:00Z  (the ?now= parameter freezes the trip clock)
```

Installing it on a phone needs an HTTPS address.

## Memories (Hatıralar)

Each day ends with an album page for the day's own photos. From a computer:

```bash
# 1. put the day's photos in hatiralar/<date>/, e.g. hatiralar/2026-12-20/kizil-meydan.jpg
# 2. optional captions, one per line, in hatiralar/2026-12-20/aciklamalar.txt:  kizil-meydan.jpg = Kızıl Meydan'da ilk kar
python3 tools/build_memories.py && python3 tools/build_sw.py
```

Photos are turned upright, scaled and re-encoded without metadata (no GPS position, no camera details) into
`app/memories/`, ordered by the time they were taken. The originals in `hatiralar/` are never committed.

## What is and is not in this repository

- `app/` — the page itself: HTML, CSS, vanilla ES modules, the SVG sprite, fonts, icons, trip data and the
  offline base maps. There is no build step.
- `tools/` — Python scripts that build the data, the day covers, the maps and the service worker, plus checks.
- `tests/` — unit tests for the trip logic, the HTML views and the map geometry.
- **Not included:** the photographs (`app/img/`, `mekanlar/**/*.jpg`). They were collected from the web for
  personal use and their rights stay with their owners, so the page runs here without them.

Structure and conventions are described in `CLAUDE.md`; the design system in `DESIGN.md`; the product in
`PRODUCT.md`.

## Credits

- Map data © OpenStreetMap contributors, available under the Open Database License (ODbL).
- Fonts: Sofia Sans, Sofia Sans Condensed, Oranienbaum and Bad Script, under the SIL Open Font License.
