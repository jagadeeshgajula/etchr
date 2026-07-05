import { toPath } from '../core/element-path.js';

// Module-level, seeded once from the live document so class names stay unique
// across page reloads (a fresh page load re-seeds from whatever `vve-rN`
// classes already exist in the markup).
let counter = 0;
let seeded = false;

function seedCounter(doc) {
  let max = 0;
  doc.querySelectorAll('[class]').forEach((el) => {
    el.classList.forEach((c) => {
      const m = /^vve-r(\d+)$/.exec(c);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  });
  counter = max;
  seeded = true;
}

function existingStableClass(el) {
  for (const c of el.classList) {
    if (/^vve-r\d+$/.test(c)) return c;
  }
  return null;
}

/**
 * Non-committing: determines the selector to target `el` with for an
 * auto-injected CSS rule, plus (if it doesn't already carry a stable class) a
 * `set-attribute` descriptor to merge into the caller's own batch. Reuses the
 * existing 'set-attribute' history handler — no new handler needed. Returns
 * { selector: null, descriptor: null } if `el` can't be addressed (detached).
 */
export function describeStableSelector(state, el) {
  const existing = existingStableClass(el);
  if (existing) return { selector: `.${existing}`, descriptor: null };

  const doc = state.root.ownerDocument;
  if (!seeded) seedCounter(doc);
  const path = toPath(el, state.root);
  if (!path) return { selector: null, descriptor: null };

  counter += 1;
  const name = `vve-r${counter}`;
  const currentClass = el.getAttribute('class');
  const newClass = currentClass ? `${currentClass} ${name}` : name;
  return {
    selector: `.${name}`,
    descriptor: { type: 'set-attribute', elementPath: path, attribute: 'class', oldValue: currentClass, newValue: newClass },
  };
}
