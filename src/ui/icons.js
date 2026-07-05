/**
 * Tiny hand-authored inline-SVG icon set for the editor chrome. No icon font,
 * no external requests — strings only, materialized per-document via svg().
 *
 * The pencil is drawn as a white body with a black outline and two black
 * bands near the eraser end; the gradient squircle behind it is the launcher
 * button's CSS, not part of the SVG.
 */
export const icons = {
  pencil: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M3 17.25V21h3.75L17.81 10.19l-3.75-3.75L3 17.25z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12.56 7.94l3.75 3.75M11.06 9.44l3.75 3.75" stroke="#111" stroke-width="1.6"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/>
  </svg>`,
  maximize: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="5" y="5" width="14" height="14" stroke="currentColor" stroke-width="2.4"/>
  </svg>`,
  restore: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M9 9h10v10H9z" stroke="currentColor" stroke-width="2.2"/>
    <path d="M5 15V5h10" stroke="currentColor" stroke-width="2.2"/>
  </svg>`,
};

export function svg(doc, name, size = 20) {
  const wrap = doc.createElement('span');
  wrap.innerHTML = icons[name];
  const el = wrap.firstElementChild;
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  return el;
}
