// Sidebar: category filters, progress, options, search, and the mobile drawer.

import { iconSvg } from './icons.js';
import { el, confirmButton, mobileQuery } from './util.js';

const MAX_RESULTS = 40;

export function initSidebar(app) {
  const panel = document.getElementById('panel');
  const list = document.getElementById('cat-list');
  const rows = new Map(); // category id -> { button, count }
  const groupCounts = []; // [{ ids, node }]

  /* ----- drawer (small screens) ----- */

  const handle = document.getElementById('drawer-toggle');
  const setDrawer = (open) => {
    panel.classList.toggle('is-open', open);
    handle.setAttribute('aria-expanded', String(open));
  };
  const toggleDrawer = () => setDrawer(!panel.classList.contains('is-open'));
  handle.addEventListener('click', toggleDrawer);
  document.getElementById('drawer-open').addEventListener('click', toggleDrawer);
  app.map.on('click', () => setDrawer(false));

  // Swipe the top of the drawer up to open it and down to close it.
  let swipeStart = null;
  for (const node of [handle, panel.querySelector('.panel__head')]) {
    node.addEventListener('touchstart', (event) => { swipeStart = event.touches[0].clientY; }, { passive: true });
    node.addEventListener('touchend', (event) => {
      if (swipeStart == null) return;
      const moved = event.changedTouches[0].clientY - swipeStart;
      swipeStart = null;
      if (Math.abs(moved) > 30) setDrawer(moved < 0);
    }, { passive: true });
  }

  /* ----- category list ----- */

  for (const group of app.groups) {
    const ids = group.categories.map((c) => c.id);
    const groupCount = el('span', { class: 'group__count' });
    const toggle = el('button', {
      type: 'button',
      class: 'group__toggle',
      'aria-expanded': String(!app.collapsed.has(group.name)),
      onclick: () => {
        const collapse = !section.classList.contains('is-collapsed');
        section.classList.toggle('is-collapsed', collapse);
        toggle.setAttribute('aria-expanded', String(!collapse));
        app.setGroupCollapsed(group.name, collapse);
      },
    }, el('span', { class: 'group__chevron', 'aria-hidden': 'true' }), el('span', { class: 'group__name', text: group.name }), groupCount);
    groupCounts.push({ ids, node: groupCount });
    const section = el('section', { class: app.collapsed.has(group.name) ? 'group is-collapsed' : 'group' },
      el('div', { class: 'group__head' },
        el('h2', { class: 'group__title' }, toggle),
        el('button', { type: 'button', class: 'link', onclick: () => app.setCategoriesVisible(ids, true) }, 'show'),
        el('button', { type: 'button', class: 'link', onclick: () => app.setCategoriesVisible(ids, false) }, 'hide')));
    for (const category of group.categories) {
      const count = el('span', { class: 'cat__count' });
      const button = el('button', {
        type: 'button',
        class: 'cat',
        style: `--c:${category.color}`,
        onclick: () => app.setCategoriesVisible([category.id], app.hidden.has(category.id)),
      },
        el('span', { class: 'cat__icon', html: iconSvg(category.icon) }),
        el('span', { class: 'cat__name', text: category.name }),
        count,
        el('span', { class: 'cat__switch', 'aria-hidden': 'true' }));
      rows.set(category.id, { button, count });
      section.append(button);
    }
    list.append(section);
  }

  const allIds = [...app.categories.keys()];
  document.getElementById('show-all').addEventListener('click', () => app.setCategoriesVisible(allIds, true));
  document.getElementById('hide-all').addEventListener('click', () => app.setCategoriesVisible(allIds, false));

  /* ----- options ----- */

  const hideFound = document.getElementById('hide-found');
  hideFound.addEventListener('change', () => app.setHideFound(hideFound.checked));

  const showRegions = document.getElementById('show-regions');
  showRegions.addEventListener('change', () => app.setShowRegions(showRegions.checked));

  confirmButton(document.getElementById('reset-found'), 'Click again to reset', () => app.resetFound());

  if (!app.storageAvailable) document.getElementById('storage-note').hidden = false;

  /* ----- progress + counts ----- */

  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');

  function update() {
    let total = 0;
    let found = 0;
    const counts = app.counts();
    for (const group of groupCounts) {
      const sum = group.ids.reduce((acc, id) => {
        const entry = counts.get(id);
        return [acc[0] + entry.found, acc[1] + entry.total];
      }, [0, 0]);
      group.node.textContent = `${sum[0]}/${sum[1]}`;
    }
    for (const [id, entry] of counts) {
      total += entry.total;
      found += entry.found;
      const row = rows.get(id);
      if (!row) continue;
      const visible = !app.hidden.has(id);
      row.button.setAttribute('aria-pressed', String(visible));
      row.count.textContent = `${entry.found}/${entry.total}`;
      row.count.title = `${entry.found} of ${entry.total} found`;
      row.button.classList.toggle('is-complete', entry.total > 0 && entry.found === entry.total);
    }
    progressText.textContent = `${found} / ${total} found`;
    progressBar.style.width = total ? `${(found / total) * 100}%` : '0%';
    hideFound.checked = app.hideFound;
    showRegions.checked = app.showRegions;
  }

  /* ----- search ----- */

  const input = document.getElementById('search');
  const clear = document.getElementById('search-clear');
  const results = document.getElementById('results');

  function renderResults() {
    const query = input.value.trim().toLowerCase();
    clear.hidden = !input.value;
    results.replaceChildren();
    if (!query) {
      results.hidden = true;
      return;
    }
    const matches = app.markers.filter((marker) => app.matchesQuery(marker.id, query));
    results.hidden = false;
    results.append(el('li', { class: 'results__note' },
      matches.length
        ? `${matches.length} match${matches.length === 1 ? '' : 'es'} · map shows matches only`
        : 'No markers match'));
    for (const marker of matches.slice(0, MAX_RESULTS)) {
      const category = app.categories.get(marker.category);
      results.append(el('li', {},
        el('button', { type: 'button', class: 'result', style: `--c:${category.color}`, onclick: () => pick(marker.id) },
          el('span', { class: 'result__dot' }),
          el('span', { class: 'result__text' },
            el('span', { class: 'result__title', text: marker.title || marker.id }),
            el('span', { class: 'result__sub', text: marker.region ? `${category.name} · ${marker.region}` : category.name })))));
    }
    if (matches.length > MAX_RESULTS) {
      results.append(el('li', { class: 'results__note' }, `…and ${matches.length - MAX_RESULTS} more. Keep typing to narrow it down.`));
    }
  }

  function pick(id) {
    if (mobileQuery.matches) {
      setDrawer(false);
      input.blur();
    }
    app.select(id);
  }

  function onInput() {
    app.setQuery(input.value.trim().toLowerCase());
    renderResults();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('focus', () => {
    if (mobileQuery.matches) setDrawer(true);
  });
  input.addEventListener('keydown', (event) => {
    const first = results.querySelector('.result');
    if (event.key === 'Enter' && first) {
      event.preventDefault();
      first.click();
    } else if (event.key === 'ArrowDown' && first) {
      event.preventDefault();
      first.focus();
    } else if (event.key === 'Escape' && input.value) {
      input.value = '';
      onInput();
    }
  });
  results.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...results.querySelectorAll('.result')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) next.focus();
    else if (event.key === 'ArrowUp') input.focus();
  });
  clear.addEventListener('click', () => {
    input.value = '';
    onInput();
    input.focus();
  });

  update();
  return { update };
}
