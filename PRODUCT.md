# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML/CSS/JS with no framework or build tool. A service worker precaches the page, the itinerary data and pre-resized photos, so the app works fully offline after one install. A one-off script converts `mekanlar/mekanlar.json` and the photo folders into the app's data and image files. Chosen because the app is one page, lives for a single 27-day trip and must run without a network; a framework would add tooling without adding capability.

Hosting: local only for now; the publishing target is undecided. Installing on phones needs an HTTPS origin (service workers do not register over plain HTTP on a LAN), so phone installs wait on that decision.

## Users

The traveller and 1–2 travel companions on a 27-day winter trip: Moscow 19 Dec 2026 → 3 Jan 2027, Sapsan train on 4 Jan, St. Petersburg 4 → 14 Jan 2027. Each person installs the page on their own phone before departure and opens it several times a day to see today's plan, find the next stop and get there. The traveller works remotely from a café on most days.

## Product Purpose

A daily itinerary companion for this one trip. It shows each day's three slots (work café 08:00–16:00, sightseeing 16:00–19:30, evening 19:30+) with each stop's photos, location and warnings, and lets each person tick off the stops they visited.

Success: on any day of the trip, with no connection, anyone in the group opens the page and within seconds knows where they are going next, how to get there and what to watch out for (closures, opening hours, date conflicts).

## Positioning

Built on a verified place database rather than a generic guide: in September 2026 every stop was checked for whether it still operates, and given OSM/Wikidata coordinates, a Cyrillic name and address, and three hand-picked photos. The page tells the truth about the plan (closed venues, date conflicts) instead of hiding it.

## Operating Context

- Used on phones, outdoors, in sub-zero winter weather, often after dark: sunset is around 16:00 in both cities during the trip, the same hour the sightseeing slot starts.
- Connectivity in Russia cannot be relied on. Since June 2025 Russian ISPs throttle Cloudflare-hosted sites to 16 KB; GitHub access has been degraded since May 2026; Moscow and St. Petersburg have had mobile-internet shutdowns with whitelists of approved Russian sites during 2026. Wi-Fi usually keeps working. After install, the page must never depend on the network.
- Navigation happens in Yandex Maps (city maps downloaded in advance for offline use) or Google Maps, opened through deep links from the page; routing to the next stop uses Yandex's public-transport mode.
- Cyrillic names and addresses are shown to taxi drivers and passers-by, so they must be displayable large and legible.
- Both cities run on Moscow time (UTC+3).

## Capabilities and Constraints

- Day view that selects today automatically during the trip; per-stop detail with photos, Cyrillic name and address, Turkish notes, warnings and map links.
- Per-device "visited" ticks stored locally. No accounts, no server, no sync between phones.
- An embedded offline route map: city base maps drawn at build time from OpenStreetMap data and shipped with the app (no tiles, no network), the day's stops numbered in visit order and strung on a line of lights, plus a whole-city view. Turn-by-turn navigation stays in Yandex Maps / Google Maps through deep links, including the whole day's route in one Yandex link.
- Closed and not-found venues stay in their slot with a clear status label; moved venues show their new address. Replacement venues arrive later as a data update.
- Turkish interface; place names in Latin and Cyrillic.
- Data updates reach installed copies through the service worker when a connection exists; otherwise the cached version keeps working.
- Undecided: the publishing host; accommodation (addresses not known yet, so no hotel feature until they are); replacements for the 10 closed or not-found slots.

## Evidence on Hand

- `mekanlar/mekanlar.json`: 79 places (67 open, 8 closed, 2 moved, 2 not found) with status, addresses, coordinates, Turkish notes, visit dates and slots, and photo sources. Verified 2026-09-30.
- `mekanlar/moskova/*/` and `mekanlar/st-petersburg/*/`: 231 photos, three per found place with the first as cover, from Bing Images and Wikimedia Commons. Rights stay with their owners; personal use only.
- `mekanlar/mekanlar.kml` and `mekanlar/mekanlar.csv`: the same places for map apps and spreadsheets.
- Source plan: `~/Downloads/Russia_Plan_Basic.csv` (27 days × 3 slots).
- Known conflicts the page must surface: Red Square has been closed to the public on New Year's Eve 2023–2025; St. Basil's stops admitting visitors about an hour before its ~17:00 winter closing; Tretyakov's last entry is 17:00 on Wednesdays (23 Dec); Gipsy normally opens only Friday–Saturday (plan: Monday 28 Dec); Novodevichy closes at 17:00; Church of the Savior on Spilled Blood is normally closed on Wednesdays, with a holiday exception expected for 6 Jan; six work cafés open at 09:00–10:00, not 08:00.
- Absent and not to be invented: hotels, bookings, tickets, prices, weather, transit times.

## Product Principles

1. Offline is the normal state, not a fallback.
2. The day is the unit: today's three stops are read together at a glance, the upcoming one marked; the whole-trip overview is secondary.
3. Tell the truth about the plan: closures, conflicts and uncertainty are shown, never smoothed over.
4. Built for the street: one hand, gloves, cold, darkness, and a taxi driver reading the screen.
5. Private by construction: ticks and anything a person enters stay on their phone.

## Brand Commitments

- Pinned by the user (2026-09-30): use the whole page, photographs visible up front, the route map visible, and Russian ornament from Moscow and St. Petersburg themselves — Kremlin merlons, Khokhloma vines, the Petersburg gilded railing and porcelain cobalt, Cyrillic display lettering, the day's Russian phrase. A plain, empty page is the named failure.

## Accessibility & Inclusion

Outdoor winter use sets the bar: WCAG 2.2 AA contrast in both bright snow glare and darkness, touch targets of at least 44 px usable with gloves, and no information carried by colour alone (status labels always have text).
