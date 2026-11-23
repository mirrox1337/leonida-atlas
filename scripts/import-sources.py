#!/usr/bin/env python3
"""Rebuild data/markers.json from the two open data sources.

    python3 scripts/import-sources.py

Sources (see README, "Data sources and licences"):
  * GTA Wiki interactive map "GTA VI Places of Interest"  (CC BY-SA)
  * GTADB.ORG GTA VI landmarks                            (CC BY 4.0)

What it does:
  * Imported markers get ids starting with "wiki-" or "gtadb-" and are replaced
    on every run. Markers with any other id (your own) are kept untouched.
  * Categories you already have in data/categories.json are kept as they are
    (so your colour/icon/name edits survive); missing ones are appended.

Coordinates are converted to pixels on the full-size 34816 x 45056 map. If you
change the base map, change MAP_W / MAP_H to match js/config.js.
Needs only the Python standard library.
"""

import json
import math
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP_W, MAP_H = 34816, 45056

WIKI_API = ("https://gta.fandom.com/api.php?action=query&titles=Map:GTA_VI_Places_of_Interest"
            "&prop=revisions&rvprop=content&rvslots=main&format=json")
GTADB_URL = "https://raw.githubusercontent.com/rolux/gtadb.org/main/map/data/6/landmarks.json"

# The wiki map is 34816 x 45056 units with the origin bottom-left, the same
# size as the full-resolution tiles. GTADB uses in-game coordinates (y up); two
# wiki units per game unit, offset by a whole number of tiles.
WIKI_W, WIKI_H = 34816, 45056
GTADB_SCALE, GTADB_OFFSET = 2, (24576, 20480)

# (wiki category name) -> (group, colour, icon). Wiki categories not listed
# here still import, under "More from the wiki".
WIKI_CATEGORIES = {
    "Stunt Jumps": ("Challenges", "#b8862a", "ramp"),
    "Under the Bridge": ("Challenges", "#4f7fd6", "bridge"),
    "Base Jumps": ("Challenges", "#2f9e8f", "flag"),
    "Knife Flight": ("Challenges", "#6b8794", "chevrons"),
    "Curiosity": ("Collectibles & secrets", "#a45fc4", "eye"),
    "Sculpture": ("Collectibles & secrets", "#8a7fd0", "star"),
    "Landmark": ("Collectibles & secrets", "#4f7fd6", "flag"),
    "Book Swap": ("Collectibles & secrets", "#2f9e8f", "book"),
    "Magazine": ("Collectibles & secrets", "#c2792b", "book"),
    "Unique Playlist": ("Collectibles & secrets", "#c45f97", "note"),
    "1010 Mural": ("Collectibles & secrets", "#d1495b", "spray"),
    "Jack of Hearts": ("Collectibles & secrets", "#d1495b", "heart"),
    "Delights": ("Collectibles & secrets", "#b8862a", "star"),
    "Nine1Nine": ("Collectibles & secrets", "#6b8794", "phone"),
    "ATM": ("Money & robberies", "#3c9a5f", "card"),
    "ATM (Towable)": ("Money & robberies", "#2c7a6a", "card"),
    "Bank": ("Money & robberies", "#3c9a5f", "coin"),
    "Big Bank": ("Money & robberies", "#1f7a3f", "coin"),
    "Payday Loans": ("Money & robberies", "#7a9a3c", "coin"),
    "Low-End Jewelry Store": ("Money & robberies", "#5a8fb0", "diamond"),
    "High-End Jewelry Store": ("Money & robberies", "#3f6fd0", "diamond"),
    "Pawn Shop": ("Money & robberies", "#a0703a", "cart"),
    "Safe": ("Money & robberies", "#6b8794", "lock"),
    "Contact": ("Money & robberies", "#c2792b", "person"),
    "Ammu-Nation": ("Shops & services", "#b0413e", "target"),
    "Convenience Store": ("Shops & services", "#2f9e8f", "cart"),
    "Fast Food": ("Shops & services", "#c2792b", "burger"),
    "Liquor Store": ("Shops & services", "#8a5fc4", "glass"),
    "Street Food": ("Shops & services", "#b8862a", "burger"),
    "Pay 'N' Spray": ("Shops & services", "#c45f97", "spray"),
    "Mod Shop": ("Shops & services", "#6b8794", "wrench"),
    "Gas Station": ("Shops & services", "#b8862a", "fuel"),
    "Standout Vehicle": ("Vehicles", "#b8862a", "car"),
    "Randy Vehicle": ("Vehicles", "#4f7fd6", "car"),
    "Moses Vehicle": ("Vehicles", "#c45f97", "car"),
    "Purchasable Garage": ("Vehicles", "#3c9a5f", "garage"),
    "Garage": ("Vehicles", "#3a7f96", "garage"),
    "Arcade Machine": ("Activities", "#8a5fc4", "gamepad"),
    "Animal Crackers": ("Activities", "#3c9a5f", "paw"),
}

# GTADB landmarks are sorted into these by their tags; first match wins.
# (id, name, colour, icon, hidden by default, tags)
GTADB_CATEGORIES = [
    ("places-safehouse", "Safehouses", "#2f9e8f", "house", False, {"#safehouse"}),
    ("places-notable", "Notable landmarks", "#4f7fd6", "flag", False, {"landmark", "point-of-interest"}),
    ("places-transport", "Transport", "#3a7f96", "bus", False,
     {"transportation", "#bus", "#train", "#metro", "#metromover", "#airport", "#marina", "#airbase", "#blimp"}),
    ("places-hotel", "Hotels", "#8a5fc4", "bed", False, {"hotel"}),
    ("places-food", "Food & nightlife", "#c2792b", "glass", False,
     {"restaurant", "#bar", "#fastfood", "fastfood", "#food", "#drinks", "#nightclub", "#stripclub", "#liquor"}),
    ("places-store", "Stores & services", "#c45f97", "bag", False,
     {"retail", "#supermarket", "supermarket", "#clothes", "#shoes", "#hair", "#guns", "#electronics",
      "#tattoos", "#gas", "#modshop", "#pay'n'spray", "#carwash", "#pharmacy", "#bikeshop", "#vendor", "service"}),
    ("places-leisure", "Leisure & venues", "#b8862a", "ticket", False,
     {"leisure", "events", "recreation", "#tennis", "#golf", "#gym", "#cinema", "#racetrack",
      "#volleyball", "#ferriswheel"}),
    ("places-civic", "Civic buildings", "#6b8794", "columns", False,
     {"government", "public", "#police", "#hospital", "#jail"}),
    ("places-nature", "Nature", "#3c9a5f", "tree", False, {"natural"}),
    ("places-industry", "Industry & utilities", "#7a6a58", "factory", True,
     {"industrial", "utilities", "construction", "agriculture", "office"}),
    ("places-residential", "Residential", "#5a7f96", "building", True, {"residential"}),
    ("places-other", "Other buildings", "#66757c", "building", True, set()),
]
GTADB_GROUP = "Places & buildings"
# Entries the GTADB editors flag as doubtful or duplicated are left out.
GTADB_SKIP = ("//doesnt", "//may-not-exist", "//duplicate", "//todo_not_here", "cancelled")


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "leonida-atlas-import/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def in_map(x, y):
    return 0 <= x <= MAP_W and 0 <= y <= MAP_H


def wiki_to_pixel(wx, wy):
    return round(wx * MAP_W / WIKI_W), round((WIKI_H - wy) * MAP_H / WIKI_H)


def import_wiki(categories, markers):
    page = next(iter(fetch_json(WIKI_API)["query"]["pages"].values()))
    data = json.loads(page["revisions"][0]["slots"]["main"]["*"])
    names = {str(c["id"]): c["name"] for c in data["categories"]}
    used = []
    for item in data["markers"]:
        name = names.get(str(item["categoryId"]))
        if not name:
            continue
        x, y = wiki_to_pixel(*item["position"])
        if not in_map(x, y):
            continue
        popup = item.get("popup", {})
        marker = {
            "id": f"wiki-{item['id']}",
            "category": slug(name),
            "title": (popup.get("title") or name).strip(),
            "description": (popup.get("description") or "").strip(),
            "x": x,
            "y": y,
        }
        link = (popup.get("link") or {}).get("url")
        if link:
            marker["link"] = link
        markers.append(marker)
        if name not in used:
            used.append(name)
    # Keep the order of WIKI_CATEGORIES so groups stay together in the sidebar.
    for name in sorted(used, key=lambda n: list(WIKI_CATEGORIES).index(n) if n in WIKI_CATEGORIES else 999):
        group, color, icon = WIKI_CATEGORIES.get(name, ("More from the wiki", "#6b8794", "dot"))
        categories.append({"id": slug(name), "name": name, "group": group, "color": color, "icon": icon})


def import_gtadb(categories, markers):
    data = fetch_json(GTADB_URL)
    # Skip a GTADB place when the wiki already has a marker of the same name nearby.
    taken = {}
    for marker in markers:
        taken.setdefault(slug(marker["title"]), []).append((marker["x"], marker["y"]))
    used = set()
    for key, entry in data.items():
        name, position, real_life, tags = entry[0], entry[1], entry[3], set(entry[6])
        if not position or not name or name.startswith("?"):
            continue
        if any(tag.startswith(GTADB_SKIP) for tag in tags):
            continue
        x, y = wiki_to_pixel(position[0] * GTADB_SCALE + GTADB_OFFSET[0],
                             position[1] * GTADB_SCALE + GTADB_OFFSET[1])
        if not in_map(x, y):
            continue
        title, _, region = name.partition(", ")
        if any(math.hypot(x - ox, y - oy) < MAP_W / 64 for ox, oy in taken.get(slug(title), [])):
            continue
        category = next(c for c in GTADB_CATEGORIES if not c[5] or tags & c[5])
        used.add(category[0])
        description = ""
        if real_life and not real_life.startswith("?"):
            description = f"Real-world counterpart: {real_life}"
            if "unconfirmed" in tags:
                description += " (unconfirmed)"
        marker = {"id": f"gtadb-{key}", "category": category[0], "title": title,
                  "description": description, "x": x, "y": y}
        if region:
            marker["region"] = region
        markers.append(marker)
    for cid, name, color, icon, hidden, _ in GTADB_CATEGORIES:
        if cid in used:
            entry = {"id": cid, "name": name, "group": GTADB_GROUP, "color": color, "icon": icon}
            if hidden:
                entry["hidden"] = True
            categories.append(entry)


def main():
    categories, markers = [], []
    import_wiki(categories, markers)
    wiki_count = len(markers)
    import_gtadb(categories, markers)

    markers_path = ROOT / "data" / "markers.json"
    categories_path = ROOT / "data" / "categories.json"
    old_markers = json.loads(markers_path.read_text("utf-8")) if markers_path.exists() else []
    old_categories = json.loads(categories_path.read_text("utf-8")) if categories_path.exists() else []

    own = [m for m in old_markers if not str(m.get("id", "")).startswith(("wiki-", "gtadb-"))]
    known = {c["id"] for c in old_categories}
    merged_categories = old_categories + [c for c in categories if c["id"] not in known]

    markers_path.write_text(
        "[\n" + ",\n".join("  " + json.dumps(m, ensure_ascii=False) for m in own + markers) + "\n]\n", "utf-8")
    categories_path.write_text(
        "[\n" + ",\n".join("  " + json.dumps(c, ensure_ascii=False) for c in merged_categories) + "\n]\n", "utf-8")

    print(f"GTA Wiki: {wiki_count} markers, GTADB: {len(markers) - wiki_count} markers, "
          f"your own: {len(own)} kept, categories: {len(merged_categories)}")


if __name__ == "__main__":
    sys.exit(main())
