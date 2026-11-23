// Small DOM helpers shared by the other modules.

export const mobileQuery = window.matchMedia('(max-width: 760px)');
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** el('div', { class: 'x', onclick: fn }, 'text', childNode) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Returns the URL if it is relative or http(s); otherwise null. */
export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

let toastTimer = 0;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2600);
}

/**
 * Turns a button into a two-step confirm: first click arms it, second click
 * (within a few seconds) runs the action. Avoids blocking confirm() dialogs.
 */
export function confirmButton(button, armedLabel, action) {
  const label = button.textContent;
  let timer = 0;
  const disarm = () => {
    clearTimeout(timer);
    button.classList.remove('is-armed');
    button.textContent = label;
  };
  button.addEventListener('click', () => {
    if (button.classList.contains('is-armed')) {
      disarm();
      action();
      return;
    }
    button.classList.add('is-armed');
    button.textContent = armedLabel;
    timer = setTimeout(disarm, 4000);
  });
}
