// App entry point: loads the data files, builds the map layers, and wires the
// sidebar, deep links, found tracking and (optionally) edit mode together.

import { CONFIG } from './config.js';
import { createMap, toLatLng, toPixel, imageBounds, focusZoom } from './map.js';
import * as storage from './storage.js';
import { iconSvg } from './icons.js';
import { parseHash, writeHash, shareUrl } from './hash.js';
import { initSidebar } from './sidebar.js';
import { el, esc, safeUrl, toast, mobileQuery, reduceMotion } from './util.js';

const L = window.L;

// Panel width and drawer peek height come from css/style.css, so popups and
// the home view stay clear of the panel when the layout is restyled.
const rootStyle = getComputedStyle(document.documentElement);
const PANEL_WIDTH = parseFloat(rootStyle.getPropertyValue('--panel-w')) || 330;
const DRAWER_PEEK = parseFloat(rootStyle.getPropertyValue('--peek')) || 86;

const FALLBACK_COLOR = '#7a8a91';

const app = {
  map: null,
  editMode: new URLSearchParams(window.location.search).get('edit') === '1',
  categories: new Map(), // id -> category
  groups: [], // [{ name, categories: [...] }]
  rawMarkers: [], // markers.json exactly as loaded (used for export)
  markers: [], // validated markers
  layers: new Map(), // marker id -> L.Marker
  haystack: new Map(), // marker id -> lowercase searchable text
  group: null, // layer group (or cluster group) holding the markers
  clustered: false,
  regionLayer: null,
  found: new Set(),
  hidden: new Set(), // hidden category ids
  hideFound: false,
  showRegions: true,
  darkMap: false,
  collapsed: new Set(), // collapsed sidebar group names
  query: '',
  selectedId: null,
  sidebar: null,
};

/* ---------- data ---------- */

async function loadJSON(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} (HTTP ${response.status})`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function addCategory(category) {
  const entry = {
    id: String(category.id),
    name: category.name || String(category.id),
    group: category.group || 'Other',
    color: category.color || FALLBACK_COLOR,
    icon: category.icon || 'dot',
  };
  app.categories.set(entry.id, entry);
  let group = app.groups.find((g) => g.name === entry.group);
  if (!group) {
    group = { name: entry.group, categories: [] };
    app.groups.push(group);
  }
  group.categories.push(entry);
  return entry;
}

function ingest(categories, markers) {
  for (const category of categories) {
    if (category && category.id != null && !app.categories.has(String(category.id))) addCategory(category);
  }
  app.rawMarkers = markers;
  for (const raw of markers) {
    if (!raw || raw.id == null || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
      console.warn('Skipping marker without id or numeric x/y:', raw);
      continue;
    }
    const marker = { ...raw, id: String(raw.id), category: String(raw.category ?? 'uncategorized') };
    if (app.haystack.has(marker.id)) {
      console.warn(`Skipping duplicate marker id "${marker.id}"`);
      continue;
    }
    // A marker pointing at an unknown category still shows up, under "Other".
    if (!app.categories.has(marker.category)) addCategory({ id: marker.category });
    app.markers.push(marker);
    app.haystack.set(marker.id, `${marker.title || ''} ${marker.description || ''}`.toLowerCase());
  }
}

/* ---------- markers ---------- */

function makeIcon(category, { found = false, draft = false } = {}) {
  const classes = ['pin', found && 'pin--found', draft && 'pin--draft'].filter(Boolean).join(' ');
  return L.divIcon({
    className: 'pin-icon',
    html: `<span class="${classes}" style="--c:${esc(category.color)}">${iconSvg(category.icon)}</span>`,
    iconSize: [24, 30],
    iconAnchor: [12, 30],
    popupAnchor: [0, -28],
  });
}

function popupOptions() {
  const mobile = mobileQuery.matches;
  return {
    maxWidth: Math.min(300, window.innerWidth - 48),
    minWidth: 210,
    autoPanPaddingTopLeft: mobile ? [12, 12] : [PANEL_WIDTH + 28, 12],
    autoPanPaddingBottomRight: mobile ? [12, DRAWER_PEEK + 28] : [12, 36],
  };
}

function buildPopup(marker) {
  const category = app.categories.get(marker.category);
  const image = safeUrl(marker.image);
  const link = safeUrl(marker.link);
  const checkbox = el('input', {
    type: 'checkbox',
    checked: app.found.has(marker.id),
    onchange: (event) => setFound(marker.id, event.target.checked),
  });
  return el('div', { class: 'pop' },
    image && el('img', { class: 'pop__img', src: image, alt: '', loading: 'lazy' }),
    el('div', { class: 'pop__cat', style: `--c:${category.color}` },
      el('span', { class: 'pop__dot' }),
      marker.region ? `${category.name} · ${marker.region}` : category.name),
    el('h2', { class: 'pop__title', text: marker.title || marker.id }),
    marker.description && el('p', { class: 'pop__desc', text: marker.description }),
    link && el('a', { class: 'pop__link', href: link, target: '_blank', rel: 'noopener noreferrer', text: 'More info ↗' }),
    el('div', { class: 'pop__actions' },
      el('label', { class: 'pop__found' }, checkbox, 'Mark as found'),
      el('button', { type: 'button', class: 'btn btn--sm', onclick: () => copyLink(marker) }, 'Copy link')),
    app.editMode && el('div', { class: 'pop__meta', text: `id ${marker.id} · x ${marker.x}, y ${marker.y}` }),
  );
}

function createLayers() {
  app.clustered = typeof L.markerClusterGroup === 'function'
    && app.markers.length >= CONFIG.cluster.minMarkers;

  app.group = app.clustered
    ? L.markerClusterGroup({
      // Clusters stay on at every zoom, tighter from the fly-to zoom upwards;
      // pins that still overlap at the deepest zoom fan out when clicked.
      maxClusterRadius: (zoom) => (zoom >= focusZoom ? CONFIG.cluster.radius * 0.6 : CONFIG.cluster.radius),
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => L.divIcon({
        className: 'cluster-icon',
        html: `<span class="cluster">${cluster.getChildCount()}</span>`,
        iconSize: [32, 32],
      }),
    })
    : L.layerGroup();

  for (const marker of app.markers) {
    const category = app.categories.get(marker.category);
    const layer = L.marker(toLatLng(marker.x, marker.y), {
      icon: makeIcon(category, { found: app.found.has(marker.id) }),
      title: marker.title || '',
      alt: marker.title || category.name,
      riseOnHover: true,
    });
    layer.bindPopup(() => buildPopup(marker), popupOptions());
    layer.on('popupopen', () => {
      app.selectedId = marker.id;
      syncHash();
    });
    layer.on('popupclose', () => {
      if (app.selectedId !== marker.id) return;
      app.selectedId = null;
      syncHash();
      // The selected marker is exempt from filters; re-check it once closed.
      setTimeout(applyFilters, 0);
    });
    app.layers.set(marker.id, layer);
  }

  app.group.addTo(app.map);
}

// Label kinds, most important first. Each kind appears from a zoom level
// relative to focusZoom (the zoom used when flying to a marker); a label that would overlap a more important
// one is hidden until there is room for it.
const LABEL_KINDS = { county: -99, city: -99, region: -99, town: -3.5, area: -2.75, water: -2.75 };

function createRegions(regions) {
  app.regionLayer = L.layerGroup();
  const kinds = Object.keys(LABEL_KINDS);
  app.regionLabels = regions
    .filter((region) => region && Number.isFinite(region.x) && Number.isFinite(region.y))
    .map((region) => ({ ...region, kind: kinds.includes(region.kind) ? region.kind : 'region' }))
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind))
    .map((region) => ({
      minZoom: focusZoom + LABEL_KINDS[region.kind],
      marker: L.marker(toLatLng(region.x, region.y), {
        pane: 'regions',
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'region-icon',
          html: `<span class="region region--${region.kind}">${esc(region.name || region.id || '')}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(app.regionLayer),
    }));
  app.map.on('zoomend', declutterLabels);
  if (app.showRegions) app.regionLayer.addTo(app.map);
}

function declutterLabels() {
  if (!app.map.hasLayer(app.regionLayer)) return;
  const zoom = app.map.getZoom();
  const placed = [];
  for (const { marker, minZoom } of app.regionLabels) {
    const label = marker.getElement()?.firstElementChild;
    if (!label) continue;
    let show = zoom >= minZoom;
    if (show) {
      const box = label.getBoundingClientRect();
      show = !placed.some((other) => box.left < other.right + 6 && box.right > other.left - 6
        && box.top < other.bottom + 2 && box.bottom > other.top - 2);
      if (show) placed.push(box);
    }
    label.style.visibility = show ? '' : 'hidden';
  }
}

/* ---------- filtering ---------- */

function matchesQuery(id, query) {
  if (!query) return true;
  const text = app.haystack.get(id) || '';
  return query.split(/\s+/).every((token) => text.includes(token));
}

function isVisible(marker) {
  if (marker.id === app.selectedId) return true; // never hide the open marker
  if (app.hidden.has(marker.category)) return false;
  if (app.hideFound && app.found.has(marker.id)) return false;
  return matchesQuery(marker.id, app.query);
}

function applyFilters() {
  const add = [];
  const remove = [];
  for (const marker of app.markers) {
    const layer = app.layers.get(marker.id);
    const shown = app.group.hasLayer(layer);
    const wanted = isVisible(marker);
    if (wanted && !shown) add.push(layer);
    else if (!wanted && shown) remove.push(layer);
  }
  if (app.clustered) {
    if (remove.length) app.group.removeLayers(remove);
    if (add.length) app.group.addLayers(add);
  } else {
    remove.forEach((layer) => app.group.removeLayer(layer));
    add.forEach((layer) => app.group.addLayer(layer));
  }
}

function savePrefs() {
  storage.save('prefs', {
    hidden: [...app.hidden],
    hideFound: app.hideFound,
    showRegions: app.showRegions,
    darkMap: app.darkMap,
    collapsed: [...app.collapsed],
  });
}

function changed() {
  applyFilters();
  savePrefs();
  app.sidebar?.update();
}

function setCategoriesVisible(ids, visible) {
  for (const id of ids) {
    if (visible) app.hidden.delete(id);
    else app.hidden.add(id);
  }
  changed();
}

function setHideFound(value) {
  app.hideFound = value;
  changed();
}

function setShowRegions(value) {
  app.showRegions = value;
  if (value) app.regionLayer.addTo(app.map);
  else app.regionLayer.remove();
  declutterLabels();
  savePrefs();
}

function setDarkMap(value) {
  app.darkMap = value;
  document.body.classList.toggle('map-dark', value);
  app.darkButton?.setAttribute('aria-pressed', String(value));
  savePrefs();
}

function setGroupCollapsed(name, value) {
  if (value) app.collapsed.add(name);
  else app.collapsed.delete(name);
  savePrefs();
}

function setQuery(query) {
  app.query = query;
  applyFilters();
}

/* ---------- found tracking ---------- */

function refreshIcon(id) {
  const marker = app.markers.find((m) => m.id === id);
  const layer = app.layers.get(id);
  if (!marker || !layer) return;
  layer.setIcon(makeIcon(app.categories.get(marker.category), { found: app.found.has(id) }));
}

function setFound(id, value) {
  if (value) app.found.add(id);
  else app.found.delete(id);
  if (!storage.save('found', [...app.found])) toast('Could not save progress in this browser');
  refreshIcon(id);
  applyFilters();
  app.sidebar?.update();
}

function resetFound() {
  app.map.closePopup(); // an open popup would keep showing a ticked box
  const ids = [...app.found];
  app.found.clear();
  storage.save('found', []);
  ids.forEach(refreshIcon);
  applyFilters();
  app.sidebar?.update();
  toast('Progress reset');
}

function counts() {
  const result = new Map();
  for (const id of app.categories.keys()) result.set(id, { total: 0, found: 0 });
  for (const marker of app.markers) {
    const entry = result.get(marker.category);
    entry.total += 1;
    if (app.found.has(marker.id)) entry.found += 1;
  }
  return result;
}

/* ---------- selection and deep links ---------- */

function viewState() {
  const centre = toPixel(app.map.getCenter());
  return {
    m: app.selectedId,
    x: centre.x,
    y: centre.y,
    z: Math.round(app.map.getZoom() * 100) / 100,
  };
}

function syncHash() {
  writeHash(viewState());
}

/** Shows a marker's popup, zooming out of a cluster first if needed. */
function reveal(layer) {
  if (app.clustered) app.group.zoomToShowLayer(layer, () => layer.openPopup());
  else layer.openPopup();
}

function select(id, { fly = true } = {}) {
  const layer = app.layers.get(id);
  if (!layer) {
    toast('That marker is not on the map any more');
    return false;
  }
  app.selectedId = id;
  applyFilters();
  if (!fly) {
    reveal(layer);
    return true;
  }
  const zoom = Math.max(app.map.getZoom(), focusZoom);
  if (reduceMotion.matches) {
    app.map.setView(layer.getLatLng(), zoom, { animate: false });
    reveal(layer);
  } else {
    // Open the popup when the flight ends, or shortly after if the browser
    // stalls the animation (a background tab, for instance).
    let opened = false;
    const open = () => {
      if (opened || app.selectedId !== id) return;
      opened = true;
      reveal(layer);
    };
    app.map.once('moveend', open);
    setTimeout(open, 1600);
    app.map.flyTo(layer.getLatLng(), zoom, { duration: 0.8 });
  }
  return true;
}

async function copyLink(marker) {
  const url = shareUrl({ ...viewState(), m: marker.id });
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
    return;
  } catch {
    /* fall through to the legacy path */
  }
  const field = el('textarea', { value: url, style: 'position:fixed;opacity:0;top:0;left:0' });
  document.body.append(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  field.remove();
  toast(ok ? 'Link copied' : 'Copy blocked by the browser. The address bar holds the same link.');
}

function homeView(animate = false) {
  const mobile = mobileQuery.matches;
  app.map.fitBounds(imageBounds, {
    paddingTopLeft: mobile ? [8, 8] : [PANEL_WIDTH + 24, 8],
    paddingBottomRight: mobile ? [8, DRAWER_PEEK + 8] : [8, 28],
    animate,
  });
}

/** Small square map button in the same style as the zoom buttons. */
function mapButton(bar, className, label, svg, onClick) {
  const link = L.DomUtil.create('a', className, bar);
  link.href = '#';
  link.title = label;
  link.setAttribute('role', 'button');
  link.setAttribute('aria-label', label);
  link.innerHTML = svg;
  L.DomEvent.on(link, 'click', (event) => {
    L.DomEvent.preventDefault(event);
    onClick();
  });
  return link;
}

function addMapButtons() {
  const ButtonsControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const bar = L.DomUtil.create('div', 'leaflet-bar map-buttons');
      L.DomEvent.disableClickPropagation(bar);
      const line = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
      app.darkButton = mapButton(bar, 'dark-button', 'Dark map',
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z" fill="currentColor"/></svg>',
        () => setDarkMap(!app.darkMap));
      app.darkButton.setAttribute('aria-pressed', String(app.darkMap));
      mapButton(bar, 'home-button', 'Show the whole map',
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" ${line}/></svg>`,
        () => {
          app.map.closePopup();
          homeView(!reduceMotion.matches);
        });
      return bar;
    },
  });
  app.map.addControl(new ButtonsControl());
}

function applyHash() {
  const hash = parseHash();
  const hasView = hash.x != null && hash.y != null && hash.z != null;
  // No animation: opening the popup mid-animation would cut the move short.
  if (hasView) app.map.setView(toLatLng(hash.x, hash.y), hash.z, { animate: false });
  else if (!app.map._loaded) homeView();
  if (hash.m && hash.m !== app.selectedId) select(hash.m, { fly: !hasView });
}

/* ---------- start-up ---------- */

function showFatal(error) {
  document.body.append(el('div', { class: 'fatal', role: 'alert' },
    el('strong', { text: 'The map could not start.' }),
    el('p', { text: String(error.message || error) }),
    el('p', { text: 'If you opened index.html straight from disk, serve the folder over HTTP instead (see the README).' })));
}

async function start() {
  const [categories, markers, regions] = await Promise.all([
    loadJSON('data/categories.json'),
    loadJSON('data/markers.json'),
    loadJSON('data/regions.json').catch((error) => {
      console.warn('Region labels disabled:', error.message);
      return [];
    }),
  ]);
  if (!Array.isArray(categories) || !Array.isArray(markers)) {
    throw new Error('data/categories.json and data/markers.json must each contain a JSON array');
  }
  ingest(categories, markers);

  // Saved state. Ids that no longer exist are ignored rather than deleted, so
  // progress survives a marker being temporarily removed from the data.
  const savedFound = storage.load('found', []);
  app.found = new Set(Array.isArray(savedFound) ? savedFound : []);
  const prefs = storage.load('prefs', {}) || {};
  // First visit: categories marked "hidden": true in categories.json start off.
  app.hidden = new Set(Array.isArray(prefs.hidden)
    ? prefs.hidden
    : categories.filter((c) => c && c.hidden).map((c) => String(c.id)));
  app.hideFound = Boolean(prefs.hideFound);
  app.showRegions = prefs.showRegions !== false;
  // Dark map is off until the visitor switches it on.
  app.darkMap = prefs.darkMap === true;
  document.body.classList.toggle('map-dark', app.darkMap);
  // Groups start collapsed on phones, where the list would be very long.
  app.collapsed = new Set(Array.isArray(prefs.collapsed)
    ? prefs.collapsed
    : (mobileQuery.matches ? app.groups.map((g) => g.name) : []));

  app.map = createMap('map', { editMode: app.editMode });
  // Allow zooming out a little past "whole map fits", also after a resize.
  const updateMinZoom = () => app.map.setMinZoom(Math.floor(app.map.getBoundsZoom(imageBounds)) - 1);
  updateMinZoom();
  app.map.on('resize', updateMinZoom);

  addMapButtons();
  createLayers();
  createRegions(Array.isArray(regions) ? regions : []);
  applyFilters();

  Object.assign(app, {
    makeIcon, popupOptions, counts, select, setCategoriesVisible, setHideFound,
    setShowRegions, setQuery, resetFound, matchesQuery, setDarkMap, setGroupCollapsed,
    storageAvailable: storage.available(),
  });
  app.sidebar = initSidebar(app);

  applyHash();
  declutterLabels();
  app.map.on('moveend', syncHash);
  window.addEventListener('hashchange', applyHash);

  mobileQuery.addEventListener('change', () => {
    const options = popupOptions();
    for (const layer of app.layers.values()) Object.assign(layer.getPopup().options, options);
  });

  if (app.editMode) {
    const { initEdit } = await import('./edit.js');
    initEdit(app);
  }
}

start().catch((error) => {
  console.error(error);
  showFatal(error);
});
