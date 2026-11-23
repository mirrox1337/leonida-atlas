// Leaflet map setup and the pixel <-> map coordinate conversion.
//
// Data files store positions as [x, y] pixels on the full-resolution source
// image (origin top-left, y pointing down). Leaflet's CRS.Simple wants
// [lat, lng] with lat pointing up, so everything goes through toLatLng() and
// toPixel(). The scale is chosen so that zoom level `nativeZoom` shows the
// source image at 1:1, which is also exactly what a tile pyramid expects, so
// overlay mode and tile mode share the same coordinates.

import { CONFIG } from './config.js';

const L = window.L;

export const [mapWidth, mapHeight] = CONFIG.map.size;
const tileSize = CONFIG.map.tiles.tileSize;

/** Zoom level at which one source-image pixel equals one screen pixel. */
export const nativeZoom = Math.max(0, Math.ceil(Math.log2(Math.max(mapWidth, mapHeight) / tileSize)));
const scale = 2 ** nativeZoom;

/** Zoom used when flying to a single marker. */
export const focusZoom = CONFIG.map.focusZoom ?? Math.max(0, nativeZoom - 1);

export const toLatLng = (x, y) => L.latLng(-y / scale, x / scale);

export const toPixel = (latlng) => ({
  x: Math.round(latlng.lng * scale),
  y: Math.round(-latlng.lat * scale),
});

export const inImage = ({ x, y }) => x >= 0 && y >= 0 && x <= mapWidth && y <= mapHeight;

export const imageBounds = L.latLngBounds(toLatLng(0, mapHeight), toLatLng(mapWidth, 0));

export function createMap(element, { editMode = false } = {}) {
  const map = L.map(element, {
    crs: L.CRS.Simple,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 100,
    maxZoom: nativeZoom + CONFIG.map.extraZoom,
    maxBounds: imageBounds.pad(0.6),
    maxBoundsViscosity: 0.7,
    attributionControl: false,
    zoomControl: false,
    // In edit mode a map click drops a draft marker, so popups are closed by
    // the edit module instead (see edit.js).
    closePopupOnClick: !editMode,
    doubleClickZoom: !editMode, // a double-click would drop two drafts
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Region labels sit above the map image but below markers.
  map.createPane('regions');
  map.getPane('regions').style.zIndex = 450;
  map.getPane('regions').style.pointerEvents = 'none';
  // The selected place label is lifted above the pins so it is never covered.
  map.createPane('regionTop');
  map.getPane('regionTop').style.zIndex = 650;
  map.getPane('regionTop').style.pointerEvents = 'none';

  if (CONFIG.map.mode === 'tiles') {
    L.tileLayer(CONFIG.map.tiles.url, {
      tileSize,
      minNativeZoom: CONFIG.map.tiles.minZoom ?? 0,
      maxNativeZoom: nativeZoom,
      minZoom: -5,
      bounds: imageBounds,
      noWrap: true,
      keepBuffer: 3,
    }).addTo(map);
  } else {
    L.imageOverlay(CONFIG.map.image, imageBounds).addTo(map);
  }

  return map;
}
