"""OSM elements to projected shapes: rings, merged lines, the sea, polygon and line rendering."""
import math
from collections import defaultdict

from .config import MIN_RING_UNITS2, TWIN_SHARE
from .geometry import clip_line, clip_polygon, douglas_peucker, quantize, signed_area


def _coords(geometry):
    return [(g["lon"], g["lat"]) for g in geometry or () if g]


def _closed(coords):
    return len(coords) >= 4 and coords[0] == coords[-1]


def assemble_rings(chains):
    """Join way geometries that share endpoints into closed rings; open leftovers are dropped."""
    rings, pending = [], [list(chain) for chain in chains if len(chain) >= 2]
    while pending:
        ring = pending.pop()
        while ring[0] != ring[-1]:
            ends = {ring[0], ring[-1]}
            i = next((i for i, other in enumerate(pending) if ends & {other[0], other[-1]}), None)
            if i is None:
                break
            other = pending.pop(i)
            if ring[-1] in (other[0], other[-1]):
                ring += other[1:] if other[0] == ring[-1] else other[-2::-1]
            else:
                ring = (other if other[-1] == ring[0] else other[::-1]) + ring[1:]
        if _closed(ring):
            rings.append(ring)
    return rings


def element_rings(el):
    """[(lon/lat ring, is_outer)] for a closed way or a multipolygon relation, else []."""
    if el["type"] == "way":
        ring = _coords(el.get("geometry"))
        return [(ring, True)] if _closed(ring) else []
    if el["type"] != "relation" or el.get("tags", {}).get("type") not in ("multipolygon", "boundary"):
        return []
    members = [m for m in el.get("members", ()) if m["type"] == "way" and m.get("role") in ("outer", "inner", "")]
    outer = assemble_rings(_coords(m.get("geometry")) for m in members if m.get("role") != "inner")
    inner = assemble_rings(_coords(m.get("geometry")) for m in members if m.get("role") == "inner")
    return [(r, True) for r in outer] + [(r, False) for r in inner]


def merge_lines(lines):
    """Join polylines end to end wherever they share an endpoint, so a layer needs fewer moves."""
    lines = [list(line) for line in lines if len(line) >= 2]
    at = defaultdict(list)
    for i, line in enumerate(lines):
        at[line[0]].append(i)
        at[line[-1]].append(i)
    used = [False] * len(lines)
    merged = []
    for i, line in enumerate(lines):
        if used[i]:
            continue
        used[i] = True
        chain = list(line)
        for _ in range(2):
            while (j := next((j for j in at[chain[-1]] if not used[j]), None)) is not None:
                used[j] = True
                other = lines[j]
                chain.extend(other[1:] if other[0] == chain[-1] else other[-2::-1])
            chain.reverse()
        merged.append(chain)
    return merged


def chain_directed(ways):
    """Join directed ways [(node ids, points)] head to tail; coastline direction matters."""
    starts = {}
    for i, (nodes, _) in enumerate(ways):
        starts.setdefault(nodes[0], i)
    tails = {nodes[-1] for nodes, _ in ways}
    used, chains = set(), []
    for i in sorted(range(len(ways)), key=lambda i: ways[i][0][0] in tails):
        if i in used:
            continue
        used.add(i)
        chain, last = list(ways[i][1]), ways[i][0][-1]
        while last in starts and starts[last] not in used:
            j = starts[last]
            used.add(j)
            chain.extend(ways[j][1][1:])
            last = ways[j][0][-1]
        chains.append(chain)
    return chains


def sea_rings(coast, rect):
    """Water rings from coastline chains (land on their left): each run clipped to rect is closed
    by walking the frame clockwise to the next run's entry. Islands wholly inside become holes."""
    xmin, ymin, xmax, ymax = rect
    w, h = xmax - xmin, ymax - ymin
    perimeter = 2 * (w + h)
    corners = ((0.0, (xmin, ymin)), (w, (xmax, ymin)), (w + h, (xmax, ymax)), (2 * w + h, (xmin, ymax)))
    eps = 1e-6

    def inside(p):
        return xmin + eps < p[0] < xmax - eps and ymin + eps < p[1] < ymax - eps

    def along(p):
        x, y = p
        gaps = (abs(y - ymin), abs(x - xmax), abs(y - ymax), abs(x - xmin))
        return (x - xmin, w + y - ymin, w + h + xmax - x, 2 * w + h + ymax - y)[gaps.index(min(gaps))]

    runs, rings = [], []
    for chain in coast:
        if chain[0] == chain[-1]:
            outside = next((i for i, p in enumerate(chain) if not inside(p)), None)
            if outside is None:
                rings.append((chain, False))
                continue
            chain = chain[outside:] + chain[1:outside + 1]
        runs += [run for run in clip_line(chain, rect) if not inside(run[0]) and not inside(run[-1])]
    entries = [along(run[0]) for run in runs]
    used = [False] * len(runs)
    for first in range(len(runs)):
        ring, cur = [], first
        while not used[cur]:
            used[cur] = True
            ring.extend(runs[cur])
            exit_at = along(runs[cur][-1])
            cur = min(range(len(runs)), key=lambda j: (entries[j] - exit_at) % perimeter)
            gap = (entries[cur] - exit_at) % perimeter
            ring.extend(p for d, p in sorted(((s - exit_at) % perimeter, p) for s, p in corners) if 0 < d < gap)
        if ring:
            rings.append((ring, True))
    return rings if runs else []


def project_line(coords, proj):
    return [proj(lon, lat) for lon, lat in coords]


def project_rings(rings, proj):
    return [(project_line(ring, proj), is_outer) for ring, is_outer in rings]


def feature_area_m2(feature, proj):
    units2 = sum((1 if is_outer else -1) * abs(signed_area(ring)) for ring, is_outer in feature)
    return units2 * proj.m_per_unit ** 2


# --- rendering ------------------------------------------------------------------------------

def render_polygons(features, rect, tol):
    """Clip, simplify and quantize rings; outer rings wind clockwise on screen, holes the other way."""
    rings = []
    for feature in features:
        for ring, is_outer in feature:
            if ring[0] == ring[-1]:
                ring = ring[:-1]
            clipped = clip_polygon(ring, rect)
            if len(clipped) < 3:
                continue
            outline = quantize(douglas_peucker(clipped + clipped[:1], tol))
            if len(outline) > 1 and outline[0] == outline[-1]:
                outline.pop()
            area = signed_area(outline) / 100
            if len(outline) < 3 or abs(area) < MIN_RING_UNITS2:
                continue
            if (area > 0) != is_outer:
                outline.reverse()
            rings.append(outline)
    return rings


def _length(points):
    return sum(math.dist(a, b) for a, b in zip(points, points[1:]))


def _densify(points, step):
    """The points plus extra ones so that no gap along the line exceeds step."""
    out = [points[0]]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        extra = int(math.dist((x0, y0), (x1, y1)) // step)
        out += [(x0 + (x1 - x0) * i / (extra + 1), y0 + (y1 - y0) * i / (extra + 1)) for i in range(1, extra + 1)]
        out.append((x1, y1))
    return out


def drop_twins(groups, reach):
    """Longest group first, drop each line lying almost wholly within ~reach of earlier groups:
    the other direction's tunnel of a metro line, the parallel tracks of a station throat. A group
    (one route's track) never suppresses itself, so the first route stays continuous."""
    taken, kept = set(), []
    for group in sorted(groups, key=lambda lines: sum(map(_length, lines)), reverse=True):
        fresh = set()
        for line in (line for line in group if len(line) >= 2):
            cells = {(int(x // reach), int(y // reach)) for x, y in _densify(line, reach / 2)}
            near = sum(1 for cx, cy in cells if any((cx + i, cy + j) in taken for i in (-1, 0, 1) for j in (-1, 0, 1)))
            if near < TWIN_SHARE * len(cells):
                kept.append(line)
                fresh |= cells
        taken |= fresh
    return kept


def render_lines(lines, rect, tol):
    runs = []
    for line in lines:
        for run in clip_line(line, rect):
            outline = quantize(douglas_peucker(run, tol))
            if len(outline) >= 2:
                runs.append(outline)
    return runs
