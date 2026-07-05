import { toPath, getEditableChildren } from '../core/element-path.js';
import { addChange } from '../core/history.js';

/**
 * z-index layering, PowerPoint-style: bring-to-front / send-to-back (jump past
 * every sibling) and bring-forward / send-backward (one step). Peers are the
 * element's editable siblings — the elements it can actually overlap and thus
 * stack against. Everything is expressed as `set-style` change descriptors and
 * committed as one undoable batch, reusing the existing set-style history handler.
 */

function effectiveZ(el, win) {
  const n = parseInt(win.getComputedStyle(el).zIndex, 10);
  return Number.isNaN(n) ? 0 : n; // 'auto' and non-numeric both stack as 0
}

function inlineValue(el, property) {
  const v = el.style.getPropertyValue(property);
  return v === '' ? null : v;
}

export function applyLayer(state, el, direction) {
  const root = state.root;
  const win = root.ownerDocument.defaultView;
  const parent = el.parentElement;
  if (!parent) return;

  const group = getEditableChildren(parent); // DOM order, includes el
  const domIndex = new Map(group.map((n, i) => [n, i]));
  const others = group.filter((n) => n !== el);
  const myZ = effectiveZ(el, win);

  const children = [];
  const setStyle = (target, property, value) => {
    const path = toPath(target, root);
    if (!path) return;
    const oldValue = inlineValue(target, property);
    const newValue = value == null ? null : String(value);
    if ((oldValue == null ? null : oldValue) === newValue) return;
    children.push({ type: 'set-style', elementPath: path, property, oldValue, newValue });
  };

  // z-index has no effect on a statically-positioned box. Promote to relative
  // (keeps it in flow, unlike the move gesture's absolute) so layering actually
  // reorders paint — matches how overlapping objects behave in PowerPoint.
  if (win.getComputedStyle(el).position === 'static') {
    setStyle(el, 'position', 'relative');
  }

  if (direction === 'front') {
    const max = others.length ? Math.max(...others.map((n) => effectiveZ(n, win))) : 0;
    if (myZ <= max) setStyle(el, 'z-index', max + 1);
  } else if (direction === 'back') {
    const min = others.length ? Math.min(...others.map((n) => effectiveZ(n, win))) : 0;
    if (myZ >= min) setStyle(el, 'z-index', min - 1);
  } else if (direction === 'forward' || direction === 'backward') {
    // Paint-order stack: ascending z, DOM order breaks ties (later sibling paints
    // on top). Step one slot toward front/back and swap with that neighbor; when
    // the neighbor ties on z, nudge past it by ±1 so the step is always visible.
    const stack = group.slice().sort((a, b) => effectiveZ(a, win) - effectiveZ(b, win) || domIndex.get(a) - domIndex.get(b));
    const pos = stack.indexOf(el);
    if (direction === 'forward' && pos < stack.length - 1) {
      const target = stack[pos + 1];
      const tz = effectiveZ(target, win);
      if (tz > myZ) { setStyle(el, 'z-index', tz); setStyle(target, 'z-index', myZ); }
      else setStyle(el, 'z-index', tz + 1);
    } else if (direction === 'backward' && pos > 0) {
      const target = stack[pos - 1];
      const tz = effectiveZ(target, win);
      if (tz < myZ) { setStyle(el, 'z-index', tz); setStyle(target, 'z-index', myZ); }
      else setStyle(el, 'z-index', tz - 1);
    }
  }

  if (children.length) addChange(state, { type: 'batch', label: `layer:${direction}`, children });
}
