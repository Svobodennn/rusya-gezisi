"""Map labels: along rivers, at parks and districts, kept inside the frame."""
import math
import sys

from .config import LABEL_INSET, POINT_LABEL_INSET_X, RIVER_LABELS
from .geometry import clip_line, clip_polygon, douglas_peucker, interior_point, signed_area
from .shapes import _length


def along_label(runs, text, kind):
    """Anchor on the longest straight stretch of the longest run, angled along it."""
    if not runs:
        return None
    run = max(runs, key=_length)
    coarse = douglas_peucker(run, 6.0)
    a, b = max(zip(coarse, coarse[1:]), key=lambda seg: math.dist(*seg))
    middle = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    x, y = min(run, key=lambda p: math.dist(p, middle))
    angle = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    angle = angle - 180 if angle > 90 else angle + 180 if angle <= -90 else angle
    return {"text": text, "x": round(x, 1), "y": round(y, 1), "angle": round(angle, 1), "kind": kind}


def point_label(text, point, kind):
    return {"text": text, "x": round(point[0], 1), "y": round(point[1], 1), "angle": 0, "kind": kind}


def _inside(point, rect):
    xmin, ymin, xmax, ymax = rect
    return xmin <= point[0] <= xmax and ymin <= point[1] <= ymax


def park_labels(parks, inner, limit=6):
    labels = []
    for tags, feature, _ in sorted(parks, key=lambda park: -park[2]):
        text = tags.get("short_name") or tags.get("name")
        outers = [ring for ring, is_outer in feature if is_outer]
        if not text or len(text) > 26 or not outers or any(label["text"] == text for label in labels):
            continue
        ring = max(outers, key=lambda r: abs(signed_area(r)))
        clipped = clip_polygon(ring[:-1], inner)
        if len(clipped) >= 3 and abs(signed_area(clipped)) >= 0.5 * abs(signed_area(ring)):
            labels.append(point_label(text, interior_point(clipped), "park"))
        if len(labels) == limit:
            break
    return labels


def district_labels(elements, proj, inner, focus, mentioned, limit=6):
    """Islands the trip itself names (at least 1 km across), then the place=suburb label anchors
    nearest the trip's centre. Quarters are mostly unnamed blocks or housing estates, and most
    islands are canal-bounded blocks nobody calls by name."""
    islands, suburbs = [], []
    for el in elements:
        tags = el.get("tags", {})
        name, place = tags.get("name"), tags.get("place")
        if not name or len(name) > 24:
            continue
        if place == "suburb" and el["type"] == "node":
            point = proj(el["lon"], el["lat"])
            if _inside(point, inner):
                suburbs.append((math.dist(point, focus), name, point))
        elif place == "island" and name in mentioned and "bounds" in el:
            b = el["bounds"]
            (x0, y0), (x1, y1) = proj(b["minlon"], b["maxlat"]), proj(b["maxlon"], b["minlat"])
            point = ((x0 + x1) / 2, (y0 + y1) / 2)
            if min(x1 - x0, y1 - y0) * proj.m_per_unit >= 1000 and _inside(point, inner):
                islands.append((0.0, name, point))
    labels = []
    for _, name, point in islands + sorted(suburbs):
        if len(labels) < limit and all(label["text"] != name for label in labels):
            labels.append(point_label(name, point, "district"))
    return labels


def label_features(city, rivers, parks, place_elements, proj, focus, mentioned):
    inner = proj.frame(LABEL_INSET)
    point_inner = (POINT_LABEL_INSET_X, LABEL_INSET, proj.width - POINT_LABEL_INSET_X, proj.height - LABEL_INSET)
    labels = []
    for osm_name, text in RIVER_LABELS[city].items():
        label = along_label([run for line in rivers.get(osm_name, []) for run in clip_line(line, inner)],
                            text, "river")
        if label:
            labels.append(label)
        else:
            print(f"  {city}: no centre line named {osm_name!r} for the {text} label", file=sys.stderr)
    return (labels + park_labels(parks, point_inner)
            + district_labels(place_elements, proj, point_inner, focus, mentioned))
