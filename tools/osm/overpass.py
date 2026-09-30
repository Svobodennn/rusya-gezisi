"""A polite, caching Overpass API client and the queries each city needs."""
import gzip
import hashlib
import http.client
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from .config import BuildError, ENDPOINTS, MAX_ATTEMPTS, MIN_GAP_S, QUERY_TIMEOUT_S, USER_AGENT


class Overpass:
    """Sequential cached client: MIN_GAP_S between requests, backoff, endpoint rotation."""

    def __init__(self, cache_dir, offline=False):
        self.cache_dir = Path(cache_dir)
        self.offline = offline
        self._last = 0.0

    def fetch(self, label, query):
        path = self.cache_dir / f"{label}-{hashlib.sha256(query.encode()).hexdigest()[:16]}.json"
        if path.is_file():
            return json.loads(path.read_bytes())["elements"]
        if self.offline:
            raise BuildError(f"{label}: not cached in {self.cache_dir} and --offline was given")
        raw, payload = self._download(label, query)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f".{path.name}.tmp")
        tmp.write_bytes(raw)
        os.replace(tmp, path)
        return payload["elements"]

    def _download(self, label, query):
        body = urllib.parse.urlencode({"data": query}).encode()
        failures = []
        for attempt in range(MAX_ATTEMPTS):
            endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
            time.sleep(max(0.0, self._last + MIN_GAP_S - time.monotonic()))
            started = time.monotonic()
            try:
                raw = self._post(endpoint, body)
                payload = json.loads(raw)
                if payload.get("remark"):  # HTTP 200 plus a remark means the query timed out or died
                    raise BuildError(f"remark: {payload['remark']}")
                if not isinstance(payload.get("elements"), list):
                    raise BuildError("response has no elements")
            except (OSError, EOFError, ValueError, http.client.HTTPException, BuildError) as exc:
                self._last = time.monotonic()
                failures.append(f"{endpoint}: {exc}")
                backoff = min(15 * 2 ** attempt, 180)
                print(f"  {label}: attempt {attempt + 1} failed ({exc}); retry in {backoff}s", file=sys.stderr)
                time.sleep(backoff)
                continue
            self._last = time.monotonic()
            print(f"  {label}: {len(raw) / 1e6:.1f} MB from {urllib.parse.urlsplit(endpoint).netloc} "
                  f"in {self._last - started:.0f}s", file=sys.stderr)
            return raw, payload
        raise BuildError(f"{label}: every attempt failed:\n    " + "\n    ".join(failures))

    @staticmethod
    def _post(endpoint, body):
        request = urllib.request.Request(endpoint, data=body, headers={
            "User-Agent": USER_AGENT, "Accept-Encoding": "gzip",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"})
        with urllib.request.urlopen(request, timeout=QUERY_TIMEOUT_S + 60) as response:
            raw = response.read()
            encoding = response.headers.get("Content-Encoding", "")
        return gzip.decompress(raw) if encoding == "gzip" else raw


def overpass_queries(bbox, targets):
    west, south, east, north = bbox
    box = f"({south},{west},{north},{east})"
    head = f"[out:json][timeout:{QUERY_TIMEOUT_S}];"
    marks = "".join(f'nwr["wikidata"="{t["wikidata"]}"]{box};' for t in targets)
    marks += "".join(f'way["name"="{t["osm_name"]}"]{box};rel["name"="{t["osm_name"]}"]{box};'
                     for t in targets if t["osm_name"])
    return {
        "water": head + f'(way["natural"="water"]{box};rel["natural"="water"]{box};'
                        f'way["waterway"="riverbank"]{box};rel["waterway"="riverbank"]{box};'
                        f'way["waterway"~"^(river|canal)$"]{box};way["natural"="coastline"]{box};);out geom;',
        "parks": head + f'(way["leisure"="park"]{box};rel["leisure"="park"]{box};way["landuse"="forest"]{box};'
                        f'rel["landuse"="forest"]{box};way["natural"="wood"]{box};rel["natural"="wood"]{box};);'
                        f'out geom;',
        "roads": head + f'way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]{box};out geom;',
        "rail": head + f'way["railway"="rail"]{box};out geom;',
        "metro": head + f'rel["route"="subway"]{box};out geom;rel(br)["route_master"="subway"];out;'
                        f'node["railway"="station"]["station"="subway"]{box};out;',
        "landmarks": head + f"({marks});out geom;",
        "places": head + f'nwr["place"~"^(suburb|quarter|island)$"]{box};out bb;',
        # Notable places only (they carry a wikidata id), so the map says what is where without drowning in shops.
        "pois": head + f'(nwr["tourism"~"^(museum|gallery|attraction|zoo|theme_park|viewpoint)$"]["name"]["wikidata"]{box};'
                       f'nwr["amenity"~"^(theatre|arts_centre|concert_hall|planetarium|place_of_worship)$"]["name"]["wikidata"]{box};'
                       f'nwr["historic"~"^(monument|castle|palace|fort|ship|citywalls|building)$"]["name"]["wikidata"]{box};'
                       f'nwr["building"~"^(cathedral|church|palace)$"]["name"]["wikidata"]{box};);out center tags;',
    }
