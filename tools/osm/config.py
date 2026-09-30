"""Paths, limits and OpenStreetMap tag vocabularies for the offline base maps."""
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "app" / "data"
TRIP = DATA / "trip.json"
# trip.json carries no wikidata ids (yet); the research file keyed by the same place ids does.
SOURCES = ROOT / "mekanlar" / "mekanlar.json"
# Kept in the project: Overpass is often busy (HTTP 504), and a rerun from the cache needs no network.
DEFAULT_CACHE = Path(os.environ.get("OSM_CACHE_DIR") or ROOT / "tools" / "osm-cache")
CITIES = ("moscow", "spb")
WIDTH = 1000
MARGIN_KM = 0.8
KM_PER_DEG_LAT = 111.32
PAD = 2.0  # clip a hair outside the frame so strokes never end in visible caps on the edge
LABEL_INSET = 25.0
POINT_LABEL_INSET_X = 60.0  # room for half a park or district name either side of its anchor
BUDGET_BYTES = 450_000
ATTRIBUTION = "© OpenStreetMap katkıcıları (ODbL)"

ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
USER_AGENT = "rusya-gezisi-map-builder/1.0 (one-off build of an offline trip map; python-urllib)"
MIN_GAP_S = 4.0
MAX_ATTEMPTS = 6
QUERY_TIMEOUT_S = 180

# Douglas-Peucker tolerance per layer in map units (1 unit is ~15 m in Moscow, ~9 m in SPb).
TOLERANCE = {"water_area": 0.4, "water_line": 0.6, "parks": 0.7, "major": 0.6, "minor": 0.9,
             "rail": 0.9, "metro": 0.5, "landmarks": 0.25}
TOLERANCE_STEPS = (1.0, 1.25, 1.6, 2.0)
MIN_RING_UNITS2 = 1.0
PARK_MIN_M2 = 30_000
POND_MIN_M2 = 10_000
FLOWING = {"river", "canal", "oxbow", "riverbank"}
NOT_WATER = {"wastewater", "reflecting_pool", "fountain", "pool"}
MAJOR = {"motorway", "trunk", "primary"}
RAIL_SKIP_USAGE = {"industrial", "military", "test", "tourism"}
STATION_REACH_M = 300
POI_SAME_NAME_M = 300  # within this (or the stop's footprint), a place whose name the stop's name contains is the stop
POI_LIMIT = 450
# The best-known places (by how many languages OSM names them in) show from the whole-city view, the next ones
# from a district's, the rest only close up; the page reads the tier.
POI_TIERS = (16, 80)
STATION_MERGE_M = 500  # platforms of one interchange that share a name take one label
STATION_TIE_M = 80  # cross-platform interchanges put two lines' stops within a few metres
TWIN_M = 30  # tracks or tunnels this close to a longer one of the same layer draw as one line
TWIN_SHARE = 0.8
# OSM `colour` takes CSS names too (every St. Petersburg line uses them); these are the CSS values.
CSS_COLOURS = {"black": "000000", "white": "FFFFFF", "red": "FF0000", "green": "008000", "blue": "0000FF",
               "yellow": "FFFF00", "orange": "FFA500", "purple": "800080", "brown": "A52A2A", "grey": "808080",
               "gray": "808080", "pink": "FFC0CB", "violet": "EE82EE", "magenta": "FF00FF", "cyan": "00FFFF",
               "lime": "00FF00", "darkgreen": "006400", "lightgreen": "90EE90", "lightblue": "ADD8E6",
               "darkblue": "00008B", "navy": "000080", "maroon": "800000", "olive": "808000", "teal": "008080",
               "silver": "C0C0C0", "gold": "FFD700", "skyblue": "87CEEB"}
RIVER_LABELS = {
    "moscow": {"Москва": "Москва-река"},
    "spb": {"Нева": "Нева", "Большая Нева": "Большая Нева", "Малая Нева": "Малая Нева",
            "Фонтанка": "Фонтанка"},
}
# Drawn even when no trip place points at them: (wikidata, OSM name as a fallback match).
EXTRA_LANDMARKS = {"moscow": [("Q133274", "Московский Кремль")],
                   "spb": [("Q38646", "Петропавловская крепость")]}


class BuildError(Exception):
    pass
