// Deep links. The URL hash looks like  #m=marker-id&x=2100&y=2500&z=3
// where x/y is the map centre in source-image pixels and z is the zoom.

export function parseHash(hash = window.location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const num = (key) => {
    const value = Number.parseFloat(params.get(key));
    return Number.isFinite(value) ? value : null;
  };
  return { m: params.get('m') || null, x: num('x'), y: num('y'), z: num('z') };
}

export function buildHash({ m, x, y, z }) {
  const parts = [];
  if (m) parts.push(`m=${encodeURIComponent(m)}`);
  if (x != null && y != null && z != null) parts.push(`x=${x}`, `y=${y}`, `z=${z}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/** Updates the address bar without adding history entries. */
export function writeHash(state) {
  const url = window.location.pathname + window.location.search + buildHash(state);
  try {
    window.history.replaceState(null, '', url);
  } catch {
    /* some sandboxed contexts forbid replaceState; deep links just won't update */
  }
}

/** Shareable link for the given state (drops ?edit=1 and other query params). */
export function shareUrl(state) {
  return window.location.origin + window.location.pathname + buildHash(state);
}
