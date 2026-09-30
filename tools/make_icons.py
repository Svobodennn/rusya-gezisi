#!/usr/bin/env python3
"""Draw the home-screen icons: one lit bulb hanging from its wire on the winter-night ground."""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
NIGHT = (13, 18, 32)
WIRE = (49, 58, 85)
BULB = (255, 181, 74)
FILAMENT = (255, 231, 163)
CORE = (255, 246, 214)
EMBER = (196, 106, 24)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def radial_bulb(size: int) -> Image.Image:
    """Bulb disc shaded from a hot core to an ember rim, with alpha outside the disc."""
    bulb = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = bulb.load()
    cx, cy, r = size / 2, size * 0.46, size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / r
            if d > 1:
                continue
            t = min(1.0, math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r)
            stops = [(0.0, CORE), (0.16, CORE), (0.3, FILAMENT), (0.58, BULB), (1.0, EMBER)]
            for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                if t <= t1:
                    color = lerp(c0, c1, 0 if t1 == t0 else (t - t0) / (t1 - t0))
                    break
            alpha = 255 if d < 0.97 else round(255 * (1 - d) / 0.03)
            px[x, y] = (*color, alpha)
    return bulb


def draw_icon(size: int, bulb_ratio: float) -> Image.Image:
    img = Image.new("RGB", (size, size), NIGHT)
    bulb_d = round(size * bulb_ratio)
    center = (size // 2, round(size * 0.56))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [center[0] - bulb_d, center[1] - bulb_d, center[0] + bulb_d, center[1] + bulb_d], fill=(*BULB, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.09))
    img.paste(glow, (0, 0), glow)
    draw = ImageDraw.Draw(img)
    wire_w = max(2, round(size * 0.02))
    draw.rectangle([center[0] - wire_w // 2, 0, center[0] + wire_w // 2, center[1] - bulb_d // 2], fill=WIRE)
    bulb = radial_bulb(bulb_d)
    img.paste(bulb, (center[0] - bulb_d // 2, center[1] - bulb_d // 2), bulb)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192, 0.34).save(OUT / "icon-192.png", optimize=True)
    draw_icon(512, 0.34).save(OUT / "icon-512.png", optimize=True)
    draw_icon(512, 0.26).save(OUT / "icon-maskable-512.png", optimize=True)
    draw_icon(180, 0.36).save(OUT / "apple-touch-icon.png", optimize=True)
    print("icons:", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
