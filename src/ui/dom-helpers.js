import { cls, ATTR_IGNORE } from '../core/constants.js';

export function createEl(doc, tag, { className, attrs, text, html } = {}) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  if (html != null) el.innerHTML = html;
  return el;
}

export function button(doc, label, onClick, extraClass = '') {
  const btn = createEl(doc, 'button', {
    className: `${cls('btn')} ${extraClass}`.trim(),
    attrs: { type: 'button', [ATTR_IGNORE]: '' },
    text: label,
  });
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Positions `panelEl` (position:fixed) near targetRect, clamped to the viewport.
 */
export function positionNear(panelEl, targetRect, win) {
  const margin = 8;
  const panelRect = panelEl.getBoundingClientRect();
  let top = targetRect.bottom + margin;
  let left = targetRect.left;

  const viewportW = win.innerWidth;
  const viewportH = win.innerHeight;

  if (top + panelRect.height > viewportH) {
    top = Math.max(margin, targetRect.top - panelRect.height - margin);
  }
  if (left + panelRect.width > viewportW) {
    left = Math.max(margin, viewportW - panelRect.width - margin);
  }
  top = Math.max(margin, top);
  left = Math.max(margin, left);

  panelEl.style.top = `${top}px`;
  panelEl.style.left = `${left}px`;
}
