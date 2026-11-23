// Edit mode (?edit=1). Click the map to drop a draft marker, fill in the
// form, drag it into place, then download the merged markers.json and commit
// it. Drafts are kept in localStorage so a reload does not lose them.

import { toLatLng, toPixel, inImage } from './map.js';
import * as storage from './storage.js';
import { el, slugify, toast, confirmButton } from './util.js';

const L = window.L;

export function initEdit(app) {
  const { map } = app;
  document.body.classList.add('is-edit');
  document.getElementById('edit-panel').hidden = false;

  const coords = document.getElementById('coords');
  coords.hidden = false;
  const draftCount = document.getElementById('draft-count');

  const layer = L.layerGroup().addTo(map);
  const draftMarkers = new Map(); // draft object -> L.Marker
  const firstCategory = app.categories.keys().next().value;
  let lastCategory = firstCategory;

  const exportTitle = (draft) => draft.title.trim() || 'Untitled marker';

  // Drafts that already made it into markers.json (same spot, same title) are
  // dropped, so they don't show twice after you commit an export.
  const committed = (draft) => app.rawMarkers.some(
    (m) => m && m.x === draft.x && m.y === draft.y && m.title === exportTitle(draft));

  const savedDrafts = storage.load('drafts', []);
  let drafts = (Array.isArray(savedDrafts) ? savedDrafts : [])
    .filter((d) => d && Number.isFinite(d.x) && Number.isFinite(d.y))
    .map((d) => ({
      title: String(d.title || ''),
      category: app.categories.has(d.category) ? d.category : firstCategory,
      description: String(d.description || ''),
      x: d.x,
      y: d.y,
    }))
    .filter((d) => !committed(d));

  function persist() {
    storage.save('drafts', drafts);
    draftCount.textContent = `${drafts.length} draft${drafts.length === 1 ? '' : 's'}`;
  }

  function showCoords(point) {
    coords.textContent = `x ${point.x} · y ${point.y}`;
    coords.classList.toggle('is-outside', !inImage(point));
  }
  map.on('mousemove', (event) => showCoords(toPixel(event.latlng)));

  /* ----- draft markers ----- */

  const draftIcon = (draft) => app.makeIcon(app.categories.get(draft.category), { draft: true });

  function buildForm(draft, marker) {
    const title = el('input', {
      type: 'text',
      value: draft.title,
      placeholder: 'Title',
      maxLength: 120,
      oninput: (event) => { draft.title = event.target.value; persist(); },
    });
    const category = el('select', {
      onchange: (event) => {
        draft.category = event.target.value;
        lastCategory = draft.category;
        marker.setIcon(draftIcon(draft));
        persist();
      },
    }, app.groups.map((group) => el('optgroup', { label: group.name },
      group.categories.map((c) => el('option', { value: c.id, text: c.name })))));
    category.value = draft.category;
    const description = el('textarea', {
      rows: 3,
      value: draft.description,
      placeholder: 'Description',
      oninput: (event) => { draft.description = event.target.value; persist(); },
    });
    return el('form', { class: 'draft', onsubmit: (event) => { event.preventDefault(); marker.closePopup(); } },
      el('div', { class: 'draft__head' },
        el('strong', { text: 'Draft marker' }),
        el('span', { text: `x ${draft.x}, y ${draft.y}` })),
      el('label', {}, 'Title', title),
      el('label', {}, 'Category', category),
      el('label', {}, 'Description', description),
      el('div', { class: 'draft__actions' },
        el('button', { type: 'submit', class: 'btn btn--sm btn--accent' }, 'Done'),
        el('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => removeDraft(draft) }, 'Delete')),
      el('p', { class: 'draft__hint', text: 'Changes save as you type. Close this and drag the pin to move it.' }));
  }

  function addDraftMarker(draft) {
    const marker = L.marker(toLatLng(draft.x, draft.y), {
      draggable: true,
      icon: draftIcon(draft),
      zIndexOffset: 1000,
      title: 'Draft: click to edit, drag to move',
    });
    marker.bindPopup(() => buildForm(draft, marker), { ...app.popupOptions(), minWidth: 230 });
    marker.on('drag', () => showCoords(toPixel(marker.getLatLng())));
    marker.on('dragend', () => {
      const point = toPixel(marker.getLatLng());
      if (inImage(point)) {
        draft.x = point.x;
        draft.y = point.y;
        persist();
      } else {
        toast('Keep markers inside the map image');
      }
      // Snap to the whole-pixel position that will be exported.
      marker.setLatLng(toLatLng(draft.x, draft.y));
    });
    draftMarkers.set(draft, marker);
    layer.addLayer(marker);
    return marker;
  }

  function removeDraft(draft) {
    const marker = draftMarkers.get(draft);
    if (marker) layer.removeLayer(marker);
    draftMarkers.delete(draft);
    drafts = drafts.filter((d) => d !== draft);
    persist();
  }

  // Popups don't auto-close in edit mode (see createMap), so the first click
  // on the map closes an open popup and only the next one drops a marker.
  let popupOpen = false;
  map.on('popupopen', () => { popupOpen = true; });
  map.on('popupclose', () => { popupOpen = false; });

  // On phones a tap on the map first closes the open drawer; that tap should
  // not drop a marker either.
  const panel = document.getElementById('panel');
  let drawerWasOpen = false;
  map.on('preclick', () => { drawerWasOpen = panel.classList.contains('is-open'); });

  map.on('click', (event) => {
    if (popupOpen) {
      map.closePopup();
      return;
    }
    if (drawerWasOpen) return;
    const point = toPixel(event.latlng);
    showCoords(point);
    if (!inImage(point)) {
      toast('Click inside the map image to add a marker');
      return;
    }
    const draft = { title: '', category: lastCategory, description: '', x: point.x, y: point.y };
    drafts.push(draft);
    persist();
    const marker = addDraftMarker(draft);
    marker.openPopup();
    setTimeout(() => marker.getPopup().getElement()?.querySelector('input')?.focus(), 60);
  });

  /* ----- export ----- */

  function buildExport() {
    const ids = new Set(app.rawMarkers.map((m) => m && m.id));
    const merged = app.rawMarkers.map((m) => ({ ...m }));
    for (const draft of drafts) {
      const base = slugify(draft.title) || 'marker';
      let id = base;
      for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`;
      ids.add(id);
      merged.push({
        id,
        category: draft.category,
        title: exportTitle(draft),
        description: draft.description.trim(),
        x: draft.x,
        y: draft.y,
      });
    }
    return merged;
  }

  document.getElementById('download-markers').addEventListener('click', () => {
    const json = `${JSON.stringify(buildExport(), null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = el('a', { href: url, download: 'markers.json' });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${app.rawMarkers.length} existing + ${drafts.length} draft markers`);
  });

  confirmButton(document.getElementById('discard-drafts'), 'Click again to discard', () => {
    [...drafts].forEach(removeDraft);
    toast('Drafts discarded');
  });

  drafts.forEach(addDraftMarker);
  persist();
}
