# Leonida Atlas

An unofficial, fan-made interactive map for GTA 6 (the state of Leonida): a
pannable, zoomable map with categorized markers, filters, search, progress
tracking and shareable links.

It is a static site: plain HTML, CSS and vanilla JavaScript (ES modules), with
no framework, no build step and no backend. Push it to GitHub Pages and it works.

> Unofficial fan project. Not affiliated with Rockstar Games or Take-Two
> Interactive. The map image and markers come from community sources under
> open licences; see "Data sources and licences" below. They can be wrong or
> out of date.

## File structure

```
index.html
manifest.webmanifest   name, colours and icons for "Add to Home Screen"
css/style.css
js/
  config.js      map size, overlay/tile mode, clustering  <- the file you edit
  main.js        loads data, builds markers, filters, found tracking, deep links
  map.js         Leaflet setup and pixel <-> map coordinate conversion
  sidebar.js     category list, search, mobile drawer
  edit.js        edit mode (?edit=1)
  hash.js        URL hash parsing/writing
  icons.js       category icons (inline SVG)
  storage.js     localStorage wrapper
  util.js        small DOM helpers
data/
  categories.json
  markers.json
  regions.json
assets/
  map/tiles/     base map as tiles, {zoom}/{x}/{y}.jpg (what the site shows)
  map/map.jpg    small single-image copy of the map (overlay-mode fallback)
  markers/       optional images for marker popups
vendor/          Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 (no CDN)
scripts/make-tiles.js   optional: cut a huge map into tiles (Node + sharp)
scripts/import-sources.py   optional: refresh markers from the open sources (Python)
.nojekyll        tells GitHub Pages to serve the files as-is
```

## Run it locally

ES modules and `fetch` do not work from `file://`, so serve the folder over
HTTP. Any static server will do:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. (`npx serve` works too.)

To mimic the GitHub Pages subpath (`username.github.io/repo-name/`), serve the
**parent** folder and open `http://localhost:8000/<this-folder-name>/`. Every
path in the site is relative, so both work.

## The map image

The site ships in **tile mode**: `assets/map/tiles/` holds the GTADB map cut
into about 32,000 small JPGs (84 MB) across six zoom levels, at 2 pixels per
in-game metre. `map.size` is `[34816, 45056]`, the size of the full map, and
every marker and label coordinate is a pixel on that full-size map. The
browser only downloads the tiles for the area on screen.

The tiles were copied unchanged from GTADB's repository
(`maps/tiles/6/day`, levels 1 to 6, stored here as zoom 3 to 8); tiles of open
sea that GTADB does not ship were filled with the sea colour. `tiles.minZoom`
in `js/config.js` is 3 because there are no tiles below that level.

`assets/map/map.jpg` is the same map as one 2560 x 3313 image. Setting
`mode: 'overlay'` shows it instead (same coordinates, far less zoom detail);
if you do that, also set `extraZoom` and `focusZoom` lower, or delete them.

### Using your own map instead

1. Save your map as `assets/map/map.jpg` (replacing the current one).
2. In `js/config.js`, set `map.size` to the image's `[width, height]` in pixels:

   ```js
   size: [8192, 10240],
   ```

That is the only change needed. Notes:

- All coordinates in `data/*.json` are **pixels on the full-resolution source
  image**, origin top-left, `x` to the right, `y` down. They are the numbers
  you read off in any image editor.
- `map.size` is the size of that full-resolution source. If you later export a
  smaller JPG to save bandwidth, keep `map.size` unchanged (the file only has
  to have the same aspect ratio) and every marker stays in place.
- The markers and region labels are positioned for the current 34816 x 45056
  map. A different map image needs their coordinates converted to match.
- A different file name or format (PNG, WebP) is fine: change `map.image`.

### When the image gets too big: tile mode

One huge JPG is slow to download and can fail to decode on phones (roughly
beyond 8,000 to 10,000 px a side). Cut it into tiles instead:

```bash
npm install
```

```bash
node scripts/make-tiles.js path/to/full-size-map.png
```

This writes `assets/map/tiles/{z}/{x}/{y}.jpg` (replacing the shipped tiles)
and prints the values to put in `js/config.js`. Also set `tiles.minZoom` to 0,
because this script makes every level:

```js
size: [16384, 20480],   // size of the image you tiled
mode: 'tiles',
```

Marker coordinates do not change between overlay and tile mode. Commit the
`assets/map/tiles/` folder; `node_modules/` is git-ignored and is not needed by
the site. Options: `--tile-size 512` (also set `map.tiles.tileSize`),
`--quality 82`, `--background '#0a1216'` (fill colour for edge tiles).

## Categories

`data/categories.json` is an array. The order here is the order in the sidebar.

```json
{ "id": "places-safehouse", "name": "Safehouses", "group": "Places & buildings", "color": "#2f9e8f", "icon": "house" }
```

| Field   | Meaning |
|---------|---------|
| `id`    | Unique key that markers refer to. Do not rename it once markers use it. |
| `name`  | Label shown in the sidebar and popups. |
| `group` | Sidebar heading (e.g. Locations, Collectibles, Activities, Shops). New names create new groups. |
| `color` | Pin colour (any CSS colour). Mid-dark colours keep the white icon readable. |
| `icon`  | One of the names in `js/icons.js`. |
| `hidden` | Optional. `true` makes the category start switched off for first-time visitors. |

Available icons: `dot`, `house`, `flag`, `box`, `camera`, `chevrons`, `ramp`,
`shirt`, `wrench`, `cart`, `star`, `diamond`, `glass`, `anchor`, `bridge`,
`eye`, `book`, `note`, `heart`, `phone`, `card`, `coin`, `lock`, `person`,
`target`, `burger`, `spray`, `fuel`, `car`, `garage`, `gamepad`, `paw`,
`building`, `tree`, `bed`, `bus`, `bag`, `ticket`, `columns`, `factory`. To add your
own, add an entry to `js/icons.js` (the inner markup of a 24 x 24 SVG) and use
its key. An unknown icon name falls back to `dot`.

## Markers

`data/markers.json` is an array of:

```json
{
  "id": "my-hideout-1",
  "category": "places-safehouse",
  "title": "My hideout",
  "description": "Shown in the popup and searched by the search box.",
  "x": 21500,
  "y": 23800,
  "region": "Vice City",
  "image": "assets/markers/sample.svg",
  "link": "https://example.com/"
}
```

`id`, `category`, `title`, `x` and `y` are required; `description`, `region`,
`image` and `link` are optional.

- `id` must be unique and should never change: found progress and shared links
  are keyed by it.
- `image` is a path relative to the site root (put files in `assets/markers/`)
  or a full `https://` URL.
- Markers with a missing id or non-numeric `x`/`y`, and duplicate ids, are
  skipped with a warning in the browser console. A marker whose `category` is
  not in `categories.json` still appears, under an "Other" group.

### Adding markers by hand

Edit `data/markers.json`, add an object, commit. To find coordinates, open the
map image in an image editor and read the pixel position, or use edit mode's
coordinate readout.

### Adding markers through edit mode

There is no backend, so edit mode produces a file for you to commit.

1. Open the site with `?edit=1`, for example
   `http://localhost:8000/?edit=1` (it works on the live site too).
2. The cursor's `x, y` shows in the corner. Click the map to drop a draft
   marker; a form opens for title, category and description. Changes save as
   you type.
3. Close the form (click the map once) and drag a draft pin to fine-tune it.
   Click a draft to edit or delete it.
4. Press **Download markers.json** in the sidebar. The file contains every
   existing marker plus your drafts, with ids generated from the titles.
5. Replace `data/markers.json` with the download, commit and push.

Drafts are kept in your browser's localStorage until you export and commit
them (a draft that now exists in `markers.json` disappears on the next load),
or until you press **Discard drafts**. Only drafts are draggable; to move an
existing marker, change its `x`/`y` in the JSON. Optional fields (`region`,
`image`, `link`) are added by hand after export.

## Data sources and licences

The shipped data is imported, not written for this project:

| What | Source | Licence |
|------|--------|---------|
| Base map tiles and image | GTA VI Map Tiles, [GTADB.ORG](https://map.gtadb.org) ([repository](https://github.com/rolux/gtadb.org)) | CC BY 4.0 |
| Markers with ids starting `wiki-` (stunt jumps, collectibles, shops, ATMs, vehicles and so on) | [GTA Wiki, "GTA VI Places of Interest"](https://gta.fandom.com/wiki/Map:GTA_VI_Places_of_Interest) | CC BY-SA |
| Markers with ids starting `gtadb-` (named places and buildings) | GTA VI Landmarks Data, [GTADB.ORG](https://map.gtadb.org) | CC BY 4.0 |

What that means for you:

- **Keep the credits.** Both licences require attribution. It is in the
  sidebar ("Data and map credits") and in this file; do not remove it.
- **Share-alike.** The wiki markers are CC BY-SA, so `data/markers.json` as a
  whole should be shared under CC BY-SA too if you publish or pass it on.
- **Changes made here:** positions were converted to this map's pixel
  coordinates, the wiki's categories were regrouped and given new colours and
  icons, and GTADB places were sorted into categories by their tags. GTADB
  places without a name, and ones its editors flag as doubtful, are left out.
- The sidebar groups (for example "Collectibles & secrets") are this
  project's own sorting, not an official classification.

### Refreshing the data

Both sources keep growing. To pull the current versions:

```bash
python3 scripts/import-sources.py
```

It replaces every `wiki-` and `gtadb-` marker and keeps markers with any other
id, so your own additions survive. Existing categories are left alone; new
ones are appended. Found progress is keyed by marker id, so it carries over as
long as the sources keep their ids. The script assumes the 34816 x 45056
map; change `MAP_W`/`MAP_H` in it if you change the map.

## Region labels

`data/regions.json` positions the text labels (toggle: "Region labels" in the
sidebar):

```json
{ "id": "vice-city", "name": "Vice City", "kind": "city", "x": 1135, "y": 620 }
```

`x`/`y` is the centre of the label, in the same pixel coordinates. `kind` is
optional and sets the size and when the label appears:

| `kind`   | Used for | Appears |
|----------|----------|---------|
| `county` | counties | always |
| `city`   | main cities | always |
| `region` | the default when `kind` is missing | always |
| `town`   | towns | from 3.5 zoom levels before `focusZoom` |
| `area`   | districts, islands, keys, parks | from 2.75 zoom levels before `focusZoom` |
| `water`  | bays, sounds, the ocean | from 2.75 zoom levels before `focusZoom` |

A label that would overlap a more important one (earlier in the table) is
hidden until you zoom in far enough for both to fit. The zoom rules live in
`LABEL_KINDS` in `js/main.js`; the sizes are the `.region--*` rules in
`css/style.css`.

The shipped names and positions were read by eye from the official Leonida
poster and converted to this map's pixels, so check spellings and nudge any
label that sits off its place.

## Features at a glance

- **Filters**: toggle categories individually, per group, or all at once. Each
  row shows found/total.
- **Search**: matches title and description; the map shows only matches while
  a query is active, and picking a result flies to it.
- **Found tracking**: "Mark as found" in a popup, a "Hide found markers"
  option and a reset button. Saved in localStorage (per browser, per site).
- **Deep links**: the URL hash holds the open marker and the view, e.g.
  `#m=wiki-1&x=1223&y=562&z=3`. "Copy link" in a popup copies it.
- **Clustering**: switches on automatically once there are at least
  `cluster.minMarkers` markers (default 40, in `js/config.js`). It stays on at
  every zoom; pins that still overlap at the deepest zoom fan out on click.
- **Dark map**: the moon button under the zoom buttons darkens the map with a
  CSS filter (`--night` in `css/style.css`); no second set of tiles is needed.
  It is off by default and the visitor's choice is remembered.
- **Sidebar groups** collapse and show a found/total count; they start
  collapsed on phones.
- **Home button** (under the dark-map button) shows the whole map again.
- **Mobile**: the sidebar becomes a slide-up drawer that also opens and closes
  with a swipe; pan and pinch-zoom are handled by Leaflet. `manifest.webmanifest`
  and `assets/icons/` let visitors add the map to their home screen.

## Deploy to GitHub Pages

1. Create a repository on GitHub (public, or private on a plan that supports
   Pages).
2. From this folder:

   ```bash
   git init -b main
   ```

   ```bash
   git add .
   ```

   ```bash
   git commit -m "Leonida Atlas"
   ```

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   ```

   ```bash
   git push -u origin main
   ```

3. On GitHub open the repository, then **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Set **Branch** to `main` and the folder to `/ (root)`, then **Save**.
6. Wait a minute or two. The page shows the address, in the form
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

Every later `git push` to `main` redeploys. Make sure `.nojekyll` is committed
(it is an empty, hidden file in the repository root). If an update does not
show up, hard-refresh the page: browsers cache the JS and CSS files.

## Credits and licences

- [Leaflet](https://leafletjs.com/) (BSD 2-Clause) and
  [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
  (MIT), vendored in `vendor/` with their licence files.
- Icons were drawn for this project.
- Map image and marker data: see "Data sources and licences".
- Grand Theft Auto and related names are trademarks of their owners. This
  project uses none of their logos, fonts or artwork. If you add a map image,
  make sure you have the right to publish it.
