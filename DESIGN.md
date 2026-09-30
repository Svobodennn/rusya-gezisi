---
name: Rusya Gezisi
description: An offline winter-trip companion that opens each day on its city at night and hangs the day's stops as bulbs on a wire.
colors:
  night: "#0d1220"
  night-raised: "#151c2f"
  night-deep: "#080c16"
  map-ground: "#0a0f1c"
  snow: "#eef1f6"
  frost: "#9aaccb"
  wire: "#313a55"
  glass: "#2a3350"
  bulb: "#ffb54a"
  filament: "#ffe7a3"
  ember: "#c9803a"
  ash: "#b9aa9b"
  ice: "#a9d6ff"
  gold: "#dcab49"
  gold-soft: "#f0cd7c"
  brick: "#8e2a1f"
  brick-deep: "#3d0e09"
  cobalt: "#2448b8"
  cobalt-deep: "#0c1a4d"
  porcelain: "#f2f5fc"
typography:
  display:
    fontFamily: "Oranienbaum, 'Bodoni 72', Didot, 'Times New Roman', serif"
    fontSize: "clamp(3.4rem, 30cqi, 10.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Oranienbaum, 'Bodoni 72', Didot, 'Times New Roman', serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.02em"
  title:
    fontFamily: "Oranienbaum, 'Bodoni 72', Didot, 'Times New Roman', serif"
    fontSize: "clamp(1.75rem, 3vw, 2.35rem)"
    fontWeight: 400
    lineHeight: 1.05
  script:
    fontFamily: "'Bad Script', 'Segoe Script', 'Apple Chancery', cursive"
    fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "'Sofia Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  lead:
    fontFamily: "'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
  label:
    fontFamily: "'Sofia Sans Condensed', 'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    letterSpacing: "0.06em"
  label-button:
    fontFamily: "'Sofia Sans Condensed', 'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    letterSpacing: "0.02em"
  label-gloss:
    fontFamily: "'Sofia Sans Condensed', 'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "0.22em"
  sign:
    fontFamily: "'Sofia Sans', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 10vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.1
rounded:
  photo: "2px"
  frame: "3px"
  tag: "4px"
  plate: "6px"
  bulb: "50%"
spacing:
  pitch: "8px"
  p2: "16px"
  p3: "24px"
  p4: "32px"
  p5: "40px"
  p6: "48px"
  p7: "56px"
  p10: "80px"
  rail: "40px"
  touch: "48px"
  gutter: "clamp(16px, 4vw, 56px)"
  shell: "1560px"
components:
  button-plate:
    backgroundColor: "{colors.night}"
    textColor: "{colors.snow}"
    typography: "{typography.label-button}"
    rounded: "{rounded.plate}"
    padding: "0 14px"
    height: "{spacing.touch}"
  button-lit:
    backgroundColor: "{colors.bulb}"
    textColor: "{colors.night}"
    typography: "{typography.label-button}"
    rounded: "{rounded.plate}"
    padding: "0 14px"
    height: "{spacing.touch}"
  button-lit-hover:
    backgroundColor: "{colors.filament}"
    textColor: "{colors.night}"
  tick-on:
    backgroundColor: "{colors.bulb}"
    textColor: "{colors.night}"
    rounded: "{rounded.plate}"
  nav-day:
    backgroundColor: "{colors.night}"
    textColor: "{colors.snow}"
    typography: "{typography.label-button}"
    rounded: "{rounded.plate}"
    padding: "0 16px"
    height: "{spacing.touch}"
  nav-today:
    backgroundColor: "{colors.bulb}"
    textColor: "{colors.night}"
    rounded: "{rounded.plate}"
    height: "{spacing.touch}"
  next-tag:
    backgroundColor: "{colors.bulb}"
    textColor: "{colors.night}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  map-mode:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.frost}"
    typography: "{typography.label-button}"
    rounded: "{rounded.tag}"
    padding: "0 14px"
    height: "{spacing.touch}"
  map-mode-active:
    backgroundColor: "{colors.brick}"
    textColor: "{colors.snow}"
  postcard-moscow:
    backgroundColor: "{colors.brick-deep}"
    textColor: "{colors.snow}"
    rounded: "{rounded.frame}"
    padding: "36px 26px 20px"
  postcard-spb:
    backgroundColor: "{colors.cobalt-deep}"
    textColor: "{colors.snow}"
    rounded: "{rounded.frame}"
    padding: "36px 26px 20px"
  stamp:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.brick}"
    width: "58px"
    height: "68px"
  card-number:
    backgroundColor: "{colors.bulb}"
    textColor: "{colors.night}"
    rounded: "{rounded.bulb}"
    size: "38px"
  pin-label:
    backgroundColor: "{colors.map-ground}"
    textColor: "{colors.snow}"
    rounded: "{rounded.frame}"
    padding: "3px 8px"
  taxi-sign:
    backgroundColor: "{colors.night}"
    textColor: "{colors.filament}"
    typography: "{typography.sign}"
---

# Design System: Rusya Gezisi

## Overview

**Creative North Star: "The City at Night, Strung with Lights"**

Every day opens on its own city after dark: the day's landmark photographed full bleed, dimmed by a night scrim, with two strings of street garlands sagging across the sky, snow falling on a canvas, the date spelled in a bulb-matrix sign and the city's name in Oranienbaum capitals, in Cyrillic. The hero stands on the city's own edge: the Kremlin wall's swallowtail merlons under Moscow, a gilded cast-iron railing over a strip of cobalt-net porcelain under Petersburg. Below it the page becomes an almanac on the night ground, and that ground is the city's own textile, fixed behind everything and calmed in the middle: a Pavlovo Posad shawl (brick roses, cobalt daisies, gold Khokhloma vines with rowan berries) for Moscow, the Imperial Porcelain cobalt net with gold stars for Petersburg: the day's three slots hang on one wire at the left, each with a bulb whose state is the stop's state, and on wide screens the offline route map stays in view at the right, the day's stops numbered on a string of chasing lights. The whole trip closes the page as one garland of 27 × 3 bulbs.

Light is the only accent. Tungsten (bulb, filament, ember) means "now, next, done". Gold is ornament only: filets, vines, stars, glosses. Each city has one colour, Kremlin brick or porcelain cobalt, switched as a whole by `body[data-city]`. Ornament comes from the cities themselves (Kremlin merlons, Khokhloma vines with rowan berries, the Petersburg railing, the Imperial Porcelain cobalt net and its gold star), never from generic flourishes. Density is moderate: photographs are large, text is set for reading outdoors at arm's length, and night space rather than rules separates stops and days.

**Key Characteristics:**
- Full-bleed night hero per day: photo, scrim, garlands, snow, bulb-matrix date, Cyrillic city name, postcard phrase, city edge ornament.
- One tungsten accent family carrying state; gold reserved for ornament; one city colour switched by `data-city`.
- Four-state bulb grammar (off, next, lit, dead) repeated on the slot rail, card number, map pin and trip garland.
- Photographs as gilt-framed plates with city corners, never rounded cards.
- One 8 px pitch for all spacing; 48 px plates for every control.
- Continuous light motion that pauses off screen and stops under reduced motion.

## Colors

A winter-night ink ground lit by tungsten, trimmed in gold, with one civic colour per city.

### Primary
- **Tungsten Bulb** (bulb): the single accent. The next stop's bulb, a ticked stop's button, the primary action ("Rotayı Yandex'te aç", update, taxi close), the "Bugün" nav plate, the "Sıradaki" tag, the lit dots of the date sign, selection, caret and today's mark on the garland.
- **Filament** (filament): the hot core. City name and section titles, taxi address, focus ring, hover state of lit plates, route-lights on the map, the viewed garland day.
- **Ember** (ember): a visited stop. Lit bulbs, the live wire's start, the tick icon, hover borders on plates, the frame of the next/lit stop's photo plate.

### Secondary
- **Gilt** (gold): ornament and the frame. Photo filets (at 50% alpha), Khokhloma and star corners, the Russian gloss under section titles, link icons, the train separator on the garland.
- **Pale Gilt** (gold-soft): slot time labels, month labels, the Petersburg "Санкт-" prefix, phrase transliteration, map pin anchors.

### Tertiary (the city)
- **Kremlin Brick** (brick) / **Brick Night** (brick-deep): Moscow. Exposed as `--city` / `--city-deep`.
- **Porcelain Cobalt** (cobalt) / **Cobalt Night** (cobalt-deep): Petersburg. `body[data-city='spb']` swaps `--city` and `--city-deep` to these.
- **Porcelain** (porcelain): the postage stamp's paper.
- `--city` fills the active map-mode plate, the prep-list number discs and the stamp's ink; `--city-deep` fills the postcard and the free-slot panel.

### Neutral
- **Night** (night): page ground (under the city textile, `.page-bg` at 22% shawl / 26% net with a radial calm pool), plates, taxi sign, theme colour.
- **Raised Night** (night-raised): photo placeholders, prep-list items.
- **Deep Night** (night-deep): hero backdrop, map-mode track.
- **Map Ground** (map-ground): the route map's own ground, pin rings, label halo and pin-label chip.
- **Snow** (snow): body text, stop names.
- **Frost** (frost): secondary text, Cyrillic local names, credits, hints.
- **Wire** (wire): the dead wire, plate borders, the garland wire.
- **Glass** (glass): an unlit bulb.
- **Ash** (ash): closed and not-found venues (struck name, dead bulb slash, flag text).
- **Ice** (ice): warning-flag icons and offline error states.

### Named Rules
**The Tungsten Rule.** Only light means state. Bulb, filament and ember mark next, now, today and done; gold never marks state and tungsten never decorates.

**The City Switch Rule.** A component takes the city's colour only through `--city` / `--city-deep`; the city is changed in one place, `body[data-city]`.

**The Dead Bulb Rule.** Closed and not-found are ash, never red: a dark bulb with a slash, the name struck through, the photos greyed (grayscale 0.85, brightness 0.62), and a text flag. Colour is never the only carrier.

## Typography

**Display Font:** Oranienbaum (with Bodoni 72, Didot, Times New Roman)
**Script Font:** Bad Script (with Segoe Script, Apple Chancery)
**Body Font:** Sofia Sans (with system sans)
**Label Font:** Sofia Sans Condensed (with Sofia Sans)

**Character:** Oranienbaum's high-contrast imperial capitals carry the city and every place name in Latin and Cyrillic; Bad Script writes the day's Russian as a postcard hand; Sofia Sans is a Cyrillic-native text face and its condensed cut sets the sign labels. All four are self-hosted (latin, latin-ext, cyrillic subsets) for offline use; Sofia Sans latin and Oranienbaum cyrillic are preloaded.

### Hierarchy
- **Display** (400, clamp(3.4rem, 30cqi, 10.5rem), 0.86): the hero's city name, sized in container units against its own column so ПЕТЕРБУРГ never breaks; Petersburg uses clamp(2.4rem, 22cqi, 9rem). Filament, with a night text-shadow.
- **Headline** (400, 2rem, 1.05, 0.02em): section titles (Günün rotası, Gezinin tamamı, Yola çıkmadan), filament.
- **Title** (400, clamp(1.75rem, 3vw, 2.35rem), 1.05): stop names; the taxi name at clamp(2rem, 8vw, 4rem); the free-slot plan at clamp(1.6rem, 3vw, 2.1rem).
- **Script** (400, clamp(1.9rem, 3.4vw, 2.6rem), 1.15): the day's Russian phrase on the postcard only.
- **Lead** (600, 1.25rem): the hero date line; the prep lead at 400.
- **Body** (400, 1.0625rem, 1.45): flags, addresses, notes (max 64ch).
- **Body small** (0.9375rem): secondary text, links, hero sun times.
- **Label** (Condensed 600, 1.0625rem, 0.06em, uppercase): slot times and slot names, tabular numerals.
- **Button label** (Condensed 600, 0.9375rem, 0.02em): every plate and map mode.
- **Gloss** (Condensed 600, 0.8125rem, 0.22em, uppercase, gold): the Russian translation set under a section title.
- **Sign** (Sofia Sans 700, clamp(2rem, 10vw, 4.5rem), 1.1): the taxi address in filament.

Numerals in the display face also mark stops: card numbers (1.35rem), pins (1.05rem), prep discs (1.25rem), the stamp (30px).

### Named Rules
**The Russian Tag Rule.** Every Cyrillic run carries `lang="ru"`. Sofia Sans draws Bulgarian letterforms otherwise; builders wrap mixed text with `ruText()` and set `lang="ru"` on Cyrillic names, addresses, the phrase, the stamp, the garland city names and map labels.

**The Gloss-Below Rule.** A section title may carry its Russian translation as a small gold line below it; the gloss is always the heading's own meaning in Russian, never a category label placed above.

## Layout

One pitch of 8 px: every gap and padding is a multiple of `--pitch` (1.25×, 1.5×, 2×, 2.5×, 3×, 4×, 5×, 6×, 7×, 10× in use). The shell is max 1560 px with gutters of clamp(16px, 4vw, 56px) that respect safe-area insets.

- **Hero:** full bleed, min-height clamp(560px, 84vh, 940px), content anchored to the bottom above the edge ornament (56 px Kremlin, 78 px railing + cobalt). Grid: date | text | phrase at ≥980 px; date | text over a full-width phrase from 600 to 979 px; a single column below 600 px.
- **Almanac:** below 1180 px, map then day in one column; at ≥1180 px, day at left (1.1fr) and the route aside sticky at right (minmax(400px, 0.9fr)), column gap 56 px.
- **Slot:** a 40 px rail (wire in, bulb, wire out) beside the body; 56 px between slots, 48 px between stops.
- **Photo plate:** cover 2fr beside two stacked 1fr photos at 16/9; below 600 px the cover spans the top and two thumbnails sit under it (4/3.4).
- **Bands:** prep, trip and footer open with 80 px of night above them.
- **Map height:** clamp(340px, 64vh, 780px) in the aside, clamp(320px, 78vw, 560px) below 1180 px.
- **Garland:** scrolls horizontally inside the gutter, 46 px per day.

**The Void Rule.** Night space separates stops, slots and days. No horizontal rules between content; gold appears as frames and ornament, not as dividers.

## Elevation & Depth

Night ground patterned with the city textile at low opacity; depth comes from light and from the photograph behind the scrim, not from lifted surfaces.

### Shadow Vocabulary
- **Glow, next** (`0 0 12px 3px rgb(255 181 74 / 0.55), 0 0 36px 10px rgb(255 181 74 / 0.2)`): the next stop's bulb, plus a breathing halo.
- **Glow, lit** (`0 0 8px 1px rgb(201 128 58 / 0.55)`): a visited bulb.
- **Filament bloom** (`drop-shadow(0 0 3px rgb(255 226 170 / 0.95)) drop-shadow(0 0 10px rgb(255 181 74 / 0.5))`): garland bulbs and lit dots of the date sign.
- **Postcard** (`0 18px 40px -18px rgb(0 0 0 / 0.8)` plus inset gold double filet): the phrase card.
- **Map well** (`inset 0 0 0 1px var(--wire), 0 24px 60px -30px rgb(0 0 0 / 0.9)`): the route map.
- **Plate drop** (`0 4px 14px -4px rgb(0 0 0 / 0.7)`): the number bulb on a photo.

**The Scrim Rule.** Text never sits on a raw photograph. The hero shade grades the photo dark at the top (garlands), clearer mid-frame, and to night at the bottom (a denser grade below 720 px); a radial night pool sits behind the lettering and the city name has a night text-shadow.

## Shapes

Hard, framed, lightly softened. Plates and buttons 6 px; postcards, the map, panels and chips 3 px; tags and map-mode segments 4 px; photos 2 px inside a 1 px gold filet set 5 px outside the plate (2 px ember on next/lit stops). Bulbs, pins and number discs are circles. Corners of photo plates and the postcard carry the city ornament: a 46 px Khokhloma vine with rowan berries (Moscow) or a 22 px porcelain star (Petersburg), mirrored per corner. The stamp is a porcelain rectangle with a perforated edge cut by a radial mask on an 8 px grid, rotated 5°; on wide screens the postcard tilts −1.6°.

City ornaments are SVG patterns and symbols in the page sprite: `p-kremlin` (48 × 56 merlon with loophole on a brick parapet), `p-railing` (22 × 60 spear bars and rings), `p-cobalt` (28 × 28 cobalt net with gold stars), `o-khokhloma`, `o-star`. Interface icons are 24 px stroke SVGs at 1.75 stroke, round caps.

## Components

### Buttons (plates)
- **Shape:** 6 px plates, min height 48 px, 1 px wire border on night.
- **Plate:** Condensed label, icon at 20 px, 8 px gap. Hover: border to ember. Active: 1 px press down.
- **Lit plate (primary):** bulb fill, night text; hover to filament.
- **Tick toggle ("Gittik" / "Yapıldı"):** a plate with an ember bulb icon; `aria-pressed="true"` turns it into a lit plate. Its label never changes; state is in `aria-pressed`.
- **Focus:** 2 px filament outline, 3 px offset, everywhere.

### Day navigation
Previous and next plates carry the short date; a lit "Bugün" plate appears in the middle when viewing another day. Single-finger swipes on the hero and timeline change the day; the timeline slides in 14 px over 0.24 s.

### Hero
Photo (fade 0.9 s, slow 28 s drift), scrim, two garland strings (short tight front string, long deep back string; every third bulb warm; four twinkle groups at 2.8–4.1 s), snow canvas (up to 170 flakes), bulb-matrix date (5 × 7 dot numerals, 11 px pitch, unlit dots at 25% glass), Cyrillic city name, Turkish and Russian date line, sunrise/sunset, photo credit, postcard, edge ornament. Lettering rises 14 px in 0.7 s, staggered 0.08 s and 0.18 s.

### Postcard and stamp
The day's Russian phrase in Bad Script, transliteration in pale gilt condensed, Turkish in frost, on `--city-deep` with a gold double filet and two corner ornaments. The stamp reads ПОЧТА, the day number in Oranienbaum and the Russian month abbreviation, in city ink on porcelain.

### Slot rail
Wire 2 px; bulb 24 px. **Off:** glass. **Next:** filament-to-bulb gradient, next glow, halo breathing over 3.6 s. **Lit:** ember gradient. **Dead:** dark bulb with an ash slash. The wire from the last visited stop to the next is live (ember to bulb) and, when a stop is ticked, current flows down it in 0.6 s while the bulb warms in 0.5 s. The slot heading shows time, slot name and a "Sıradaki" tag.

### Photo plate
One to three photos as a single plate, gold filet, city corners, a 38 px numbered bulb at top left that matches the stop's map pin (dead stops get a dark disc in ash). Credits in xs frost below. Choosing a pin flashes the frame filament for 1.4 s.

### Stop body
Name (title face, gold chevron that turns 90° when open), Cyrillic local name in frost, flags with hanging 19 px icons (warn: snow semibold with ice icon; info/moved: frost; closed/not found: ash), Cyrillic address, plates: Rota, Adres, tick. The notes panel opens with a 1 px gold left border on a faint gold wash.

### Route map
Build-time OpenStreetMap vectors on map ground (water, parks, dashed rail, minor and major roads, metro lines in their own colours at 32%, stations), landmark outlines in gold (bulb when today's), labels in the display face with wide tracking and a map-ground halo. A camera fits the day's stops (never closer than ~1.6 km across) and tweens 900 ms with ease-in-out cubic. Hops between stops sag like a string: a faint wire plus filament dots that chase along it (1.6 s). Pins are 32 px bulbs in the four states with a label chip right or left of the bulb, or none where it would collide; overlapping bulbs fan out on a small ring with a gold leader to their true spot. "Gün" / "Şehir" mode plates switch to the whole city: 16 px unlabelled bulbs (22 px ringed in bulb for today) with a 44 px hit area. A lit "Rotayı Yandex'te aç" plate sits under the map.

### Trip garland
One wire across 27 days, three 14 px bulbs per day, the date under them, month labels in pale gilt and the city name in Cyrillic display above each city's stretch, a train icon between cities. The viewed day is washed in bulb at 10%; today carries a 2 px bulb bar on the wire.

### Taxi sign
A full-screen dialog on night: the Russian request in frost, the place name in the title face and the address in the sign style in filament, with Copy and a lit Close plate.

### Motion and reduced motion
Continuous motion (hero drift, twinkle, snow, route chase) pauses when its element is off screen (`data-offscreen`) and snow also stops while the tab is hidden. Under `prefers-reduced-motion: reduce` every animation and transition is removed, snow is painted once and left still, the map jumps without tweening, and scrolling is instant.

## Do's and Don'ts

### Do:
- **Do** take every spacing value from the 8 px pitch and give every control at least 48 px (links and pins at least 44 px).
- **Do** mark state with the four-state bulb grammar, identically on rail, card number, map pin and garland, always with text alongside.
- **Do** set every Cyrillic run with `lang="ru"`.
- **Do** switch city colour only through `--city` / `--city-deep` via `body[data-city]`.
- **Do** frame photographs as gilt plates with the city's corners, and put text over photos only on a night scrim.
- **Do** pause continuous lights off screen and remove them under reduced motion.

### Don't:
- **Don't** use rounded photo cards on grey, or leave the page empty of photographs, map and ornament.
- **Don't** use gold or the city colour to signal state, or tungsten as decoration.
- **Don't** show a closed or missing venue in red; it is ash, struck, greyed and labelled.
- **Don't** separate content with horizontal rules; use night space.
- **Don't** borrow ornament from outside the two cities; the vocabulary is Kremlin merlons, Khokhloma, the Petersburg railing, the cobalt net and its star.

## Folk Objects

Hand-drawn SVG symbols in the sprite, recoloured through custom properties (`--mt-body`, `--mt-scarf`, `--mt-flower`) set by a class on each instance:

- **Matryoshka** (`#o-matryoshka`): headscarf with polka dots, rosy cheeks, a rose on a gold-trimmed apron. Five nest on a black-lacquer shelf with a gold edge (red, blue, green, gold, red; heights 1, .84, .7, .56, .45 × `--shelf-h`, 112 px, 84 px under 480 px).
- **Samovar** (`#o-samovar`): Tula brass with shoulder medals and a Gzhel teapot on the crown. It heads the shelf and keeps free slots company ("tea time").
- **Placement:** the shelf sits under the route map in the sticky column on wide, tall screens (≥1180 × 820); elsewhere it closes the day, over «Спокойной ночи!» in Bad Script with "İyi geceler" beneath. All decorative (`aria-hidden`).

## Glass Plates

Every reading surface sits on frosted glass over the textile: each slot's body, the route panel and the sections below the day (`.slot-body`, `.route`, `.band`). A diagonal white sheen (11% → 0) over night at 50%, `blur(22px) saturate(1.7) brightness(0.92)`, so the shawl's roses and the net's cobalt glow through as soft colour; a 1 px white hairline at 13%, a bright top edge (inset white 24%), a faint gold inner ring, radius 14 px, inner padding `--glass-pad` (clamp 16–28 px; 14 px under 420 px). Under 700 px the night tint rises to 76% because Chromium at 2x density can drop the blur on a plate scrolled partly past the top edge, and the plate must stay readable without it (93% where `backdrop-filter` is unsupported). The next slot's plate is edged in tungsten with a warm glow. The textile (`.page-bg`, shawl 42%, net 46%) scrolls with the page inside `.page`'s isolated stacking context. Slots are separated by 40 px of textile, and the slot bulb drops by `--glass-pad` so it stays level with the time line.
