// Category icons, drawn for this project. Each entry is the inner markup of a
// 24x24 SVG; shapes are filled with currentColor unless they say otherwise.
// To add an icon: add an entry here and use its key as "icon" in
// data/categories.json.

const LINE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

const ICONS = {
  dot: '<circle cx="12" cy="12" r="5"/>',
  house: '<path d="M12 3 2.5 11.5H5V20h5.5v-5.5h3V20H19v-8.5h2.5z"/>',
  flag: '<path d="M5 3h2v18H5z"/><path d="M8.5 4H20l-2.8 4L20 12H8.5z"/>',
  box: `<path d="M3.5 7.5 12 3.5l8.5 4v9l-8.5 4-8.5-4z" ${LINE}/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" ${LINE}/>`,
  camera: '<path fill-rule="evenodd" d="M3 7h4l1.5-2.5h7L17 7h4v12.5H3zm9 2.5a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"/>',
  chevrons: '<path d="M3 5h5l5 7-5 7H3l5-7z"/><path d="M12 5h5l5 7-5 7h-5l5-7z"/>',
  ramp: '<path d="M2 20h20V5C13 6.5 6 12 2 20z"/>',
  shirt: '<path d="M8.5 3 3 6l2 4.2 2.2-1V21h9.6V9.200l2.200 1L21 6l-5.500-3c-.6 1.500-1.800 2.300-3.500 2.300S9.100 4.500 8.500 3z"/>',
  wrench: '<path d="M20.700 6.800 17.400 10.100l-3.500-3.500 3.300-3.300a5.200 5.200 0 0 0-6.700 6.600l-7 7a2.300 2.300 0 0 0 3.300 3.300l7-7a5.200 5.200 0 0 0 6.900-6.400z"/>',
  cart: `<path d="M2.500 4h3l2.300 10h9.900L20 7.500H7" ${LINE}/><circle cx="9.500" cy="18.500" r="1.800"/><circle cx="16.500" cy="18.500" r="1.800"/>`,
  star: '<path d="m12 2.500 2.900 6.100 6.600.9-4.800 4.600 1.200 6.600-5.900-3.200-5.900 3.200 1.200-6.600L2.500 9.500l6.600-.9z"/>',
  diamond: '<path d="M12 2.500 21.500 12 12 21.500 2.500 12z"/>',
  glass: '<path d="M4.500 4h15L13 12.200V18h3.500v2h-9v-2H11v-5.800z"/>',
  anchor: `<circle cx="12" cy="5" r="2" ${LINE}/><path d="M12 7v13M8 11h8M4.500 14a7.500 7.500 0 0 0 15 0" ${LINE}/>`,
  bridge: `<path d="M2 17h20M4 17V9M20 17V9M4 9c4 5 12 5 16 0" ${LINE}/>`,
  eye: `<path d="M2 12c2.500-4.500 6-6.500 10-6.500s7.500 2 10 6.500c-2.500 4.500-6 6.500-10 6.500S4.500 16.500 2 12z" ${LINE}/><circle cx="12" cy="12" r="3"/>`,
  book: `<path d="M4 4.500h6.500A1.500 1.500 0 0 1 12 6v14a2 2 0 0 0-2-1.500H4zM20 4.500h-6.500A1.500 1.500 0 0 0 12 6v14a2 2 0 0 1 2-1.500h6z" ${LINE}/>`,
  note: `<path d="M9 18V5l11-2v13" ${LINE}/><circle cx="6.500" cy="18" r="2.800"/><circle cx="17.500" cy="16" r="2.800"/>`,
  heart: '<path d="M12 20.500 3.800 12.300a4.900 4.900 0 0 1 7-6.900L12 6.600l1.200-1.200a4.900 4.900 0 0 1 7 6.900z"/>',
  phone: `<rect x="7" y="2.500" width="10" height="19" rx="2" ${LINE}/><path d="M11 18h2" ${LINE}/>`,
  card: `<rect x="2.500" y="5.500" width="19" height="13" rx="2" ${LINE}/><path d="M2.500 10h19" ${LINE}/>`,
  coin: `<circle cx="12" cy="12" r="9" ${LINE}/><path d="M12 6.500v11M14.800 9.300C14.200 8.500 13.200 8 12 8c-1.700 0-3 .9-3 2s1.300 2 3 2 3 .9 3 2-1.300 2-3 2c-1.200 0-2.200-.5-2.800-1.300" ${LINE}/>`,
  lock: `<rect x="5" y="10.500" width="14" height="10" rx="2"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" ${LINE}/>`,
  person: '<circle cx="12" cy="7.500" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7z"/>',
  target: `<circle cx="12" cy="12" r="7.500" ${LINE}/><circle cx="12" cy="12" r="2.500"/><path d="M12 1.500v4M12 18.500v4M1.500 12h4M18.500 12h4" ${LINE}/>`,
  burger: `<path d="M3.500 10.500a8.500 6.500 0 0 1 17 0z"/><path d="M3 13.800h18" ${LINE}/><path d="M4 16.500h16v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/>`,
  spray: `<rect x="6" y="9" width="8" height="12.500" rx="1.500"/><path d="M8 9V6h4v3M16.500 5h.01M19.500 3h.01M19.500 7h.01" ${LINE}/>`,
  fuel: `<path d="M4 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16z"/><path d="M13 11h2a1.500 1.500 0 0 1 1.500 1.500v4a1.500 1.500 0 0 0 3 0V8.500L17 6" ${LINE}/>`,
  car: '<path d="M3 17v-4.500l2.200-5A2 2 0 0 1 7 6.300h10a2 2 0 0 1 1.800 1.200l2.200 5V17h-2.200a2.300 2.300 0 0 1-4.600 0H9.800a2.300 2.300 0 0 1-4.600 0z"/>',
  garage: `<path d="M3 21V9.500L12 4l9 5.500V21h-3.500v-8h-11v8z"/><path d="M8.500 16h7M8.500 19h7" ${LINE}/>`,
  gamepad: `<rect x="2.500" y="7.500" width="19" height="10" rx="5" ${LINE}/><path d="M7.500 11v3M6 12.500h3" ${LINE}/><circle cx="16" cy="12.500" r="1.400"/>`,
  paw: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.500" r="2"/><circle cx="17" cy="9" r="2"/><path d="M12 11.500c-3 0-5.500 2.800-5.500 5.300 0 1.700 1.300 2.700 2.800 2.700 1.100 0 1.700-.5 2.700-.5s1.600.5 2.700.5c1.500 0 2.800-1 2.800-2.700 0-2.500-2.500-5.300-5.500-5.300z"/>',
  building: '<path fill-rule="evenodd" d="M5 21V3h14v18zM8.500 6.500V9H11V6.500zm4.500 0V9h2.500V6.500zM8.500 11.500V14H11v-2.500zm4.500 0V14h2.500v-2.500zM10.500 16.500V21h3v-4.500z"/>',
  tree: '<path d="M12 2.500 5 12h3.500l-4 6H11v3.500h2V18h6.500l-4-6H19z"/>',
  bed: `<path d="M2.500 18.500v-13M2.500 15h19v3.500M21.500 15v-2.500a3 3 0 0 0-3-3H10V15" ${LINE}/><circle cx="6.300" cy="11" r="1.800"/>`,
  bus: '<path fill-rule="evenodd" d="M5 4.500A2.500 2.500 0 0 1 7.500 2h9A2.500 2.500 0 0 1 19 4.500V18h-1.500v2.500H15V18H9v2.500H6.500V18H5zM7.500 5v6h9V5zM8 13.500a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600zm8 0a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600z"/>',
  bag: `<path d="M5 8h14l1 13H4z"/><path d="M8.500 8V6.500a3.500 3.500 0 0 1 7 0V8" ${LINE}/>`,
  ticket: '<path d="M3 7h18v3.500a1.500 1.500 0 0 0 0 3V17H3v-3.500a1.500 1.500 0 0 0 0-3z"/>',
  columns: '<path d="M12 3 3 8v2h18V8zM5 11.500h2.500V18H5zM10.800 11.500h2.500V18h-2.500zM16.500 11.500H19V18h-2.500zM3 19.500h18V21H3z"/>',
  factory: '<path d="M3 21V10l5.500 3.500V10l5.500 3.500V4h4.500v17z"/>',
};

export function iconSvg(name) {
  const body = ICONS[name] || ICONS.dot;
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
}
