"""Projection, simplification, clipping and SVG path encoding in the maps' 1000-unit Web Mercator space."""
import math
from dataclasses import dataclass

from .config import BuildError, KM_PER_DEG_LAT, MARGIN_KM, PAD, WIDTH


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * 180 / math.pi


@dataclass(frozen=True)
class Projection:
    lon0: float
    lat0: float
    k: float
    width: float
    height: float
    y0: float
    m_per_unit: float

    @classmethod
    def for_bbox(cls, bbox, width=WIDTH):
        west, south, east, north = bbox
        k = round(width / (east - west), 6)
        y0 = merc_y(north)
        m_per_unit = KM_PER_DEG_LAT * 1000 * math.cos(math.radians((south + north) / 2)) / k
        return cls(west, north, k, width, (y0 - merc_y(south)) * k, y0, m_per_unit)

    def __call__(self, lon, lat):
        return (lon - self.lon0) * self.k, (self.y0 - merc_y(lat)) * self.k

    def frame(self, inset=-PAD):
        return (inset, inset, self.width - inset, self.height - inset)


def city_bbox(places, city, margin_km=MARGIN_KM):
    """[w, s, e, n]: the envelope of the city's located places plus margin_km on every side."""
    points = [(p["lon"], p["lat"]) for p in places.values()
              if p.get("city") == city and p.get("lat") is not None and p.get("lon") is not None]
    if not points:
        raise BuildError(f"no located places for {city}")
    lons, lats = zip(*points)
    dlat = margin_km / KM_PER_DEG_LAT
    dlon = margin_km / (KM_PER_DEG_LAT * math.cos(math.radians((min(lats) + max(lats)) / 2)))
    return [round(min(lons) - dlon, 6), round(min(lats) - dlat, 6),
            round(max(lons) + dlon, 6), round(max(lats) + dlat, 6)]


def _seg_dist2(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2


def douglas_peucker(points, tol):
    """Keep both endpoints and every point further than tol from the outline kept so far."""
    count = len(points)
    if count < 3:
        return list(points)
    keep = [False] * count
    keep[0] = keep[-1] = True
    tol2 = tol * tol
    stack = [(0, count - 1)]
    while stack:
        first, last = stack.pop()
        a, b = points[first], points[last]
        best, best_d2 = -1, tol2
        for i in range(first + 1, last):
            d2 = _seg_dist2(points[i], a, b)
            if d2 > best_d2:
                best, best_d2 = i, d2
        if best >= 0:
            keep[best] = True
            stack.extend(((first, best), (best, last)))
    return [p for p, kept in zip(points, keep) if kept]


def clip_segment(a, b, rect):
    """Liang-Barsky: the part of segment a-b inside rect, or None."""
    (x0, y0), (x1, y1) = a, b
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - rect[0]), (dx, rect[2] - x0), (-dy, y0 - rect[1]), (dy, rect[3] - y0)):
        if p == 0 and q < 0:
            return None
        if p < 0:
            t0 = max(t0, q / p)
        elif p > 0:
            t1 = min(t1, q / p)
        if t0 > t1:
            return None
    return (a if t0 == 0 else (x0 + t0 * dx, y0 + t0 * dy)), (b if t1 == 1 else (x0 + t1 * dx, y0 + t1 * dy))


def clip_line(points, rect):
    """Split a polyline into the runs that lie inside rect."""
    runs, run = [], []
    for a, b in zip(points, points[1:]):
        segment = clip_segment(a, b, rect)
        if segment is None:
            continue
        start, end = segment
        if not run or run[-1] != start:
            if len(run) >= 2:
                runs.append(run)
            run = [start]
        run.append(end)
        if end is not b:
            runs.append(run)
            run = []
    if len(run) >= 2:
        runs.append(run)
    return runs


def clip_polygon(ring, rect):
    """Sutherland-Hodgman against the rectangle; the ring comes without its closing point."""
    xmin, ymin, xmax, ymax = rect
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    if min(xs) >= xmin and max(xs) <= xmax and min(ys) >= ymin and max(ys) <= ymax:
        return list(ring)
    if max(xs) < xmin or min(xs) > xmax or max(ys) < ymin or min(ys) > ymax:
        return []
    out = list(ring)
    for axis, bound, keep_above in ((0, xmin, True), (0, xmax, False), (1, ymin, True), (1, ymax, False)):
        if not out:
            break
        src, out = out, []
        prev = src[-1]
        prev_in = prev[axis] >= bound if keep_above else prev[axis] <= bound
        for cur in src:
            cur_in = cur[axis] >= bound if keep_above else cur[axis] <= bound
            if cur_in != prev_in:
                t = (bound - prev[axis]) / (cur[axis] - prev[axis])
                other = 1 - axis
                cut = [0.0, 0.0]
                cut[axis], cut[other] = bound, prev[other] + t * (cur[other] - prev[other])
                out.append(tuple(cut))
            if cur_in:
                out.append(cur)
            prev, prev_in = cur, cur_in
    return out


def signed_area(ring):
    """Shoelace area; positive for a ring that runs clockwise on screen (y grows down)."""
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])) / 2


def interior_point(ring):
    """Middle of the widest horizontal span through the ring's vertical middle."""
    ys = [y for _, y in ring]
    y = (min(ys) + max(ys)) / 2
    xs = sorted(x0 + (y - y0) * (x1 - x0) / (y1 - y0)
                for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]) if (y0 > y) != (y1 > y))
    spans = list(zip(xs[::2], xs[1::2]))
    if not spans:
        return sum(x for x, _ in ring) / len(ring), y
    left, right = max(spans, key=lambda span: span[1] - span[0])
    return (left + right) / 2, y


def quantize(points):
    """Round to 0.1 unit as integer tenths, dropping repeats."""
    out = []
    for x, y in points:
        q = (round(x * 10), round(y * 10))
        if not out or out[-1] != q:
            out.append(q)
    return out


def _num(tenths):
    whole, tenth = divmod(abs(tenths), 10)
    text = str(whole) if tenth == 0 else f"{whole}.{tenth}"
    return "-" + text if tenths < 0 else text


def _join(numbers):
    return "".join(n if i == 0 or n.startswith("-") else " " + n for i, n in enumerate(numbers))


def encode(paths, closed=False):
    """SVG path data: an absolute move per subpath, then relative lines (exact on the 0.1 grid)."""
    parts = []
    for pts in paths:
        (x, y), rest = pts[0], pts[1:]
        chunk = "M" + _join([_num(x), _num(y)])
        if rest:
            deltas = []
            for qx, qy in rest:
                deltas += [_num(qx - x), _num(qy - y)]
                x, y = qx, qy
            chunk += "l" + _join(deltas)
        parts.append(chunk + ("z" if closed else ""))
    return "".join(parts)
