import { registerHandler, addChange } from '../core/history.js';
import { toPath, fromPath } from '../core/element-path.js';

function applyStyle(el, property, value) {
  if (value === null || value === '') {
    el.style.removeProperty(property);
  } else {
    el.style.setProperty(property, value);
  }
}

registerHandler('set-style', {
  forward(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) applyStyle(el, entry.property, entry.newValue);
  },
  inverse(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) applyStyle(el, entry.property, entry.oldValue);
  },
});

export function readInlineValue(el, property) {
  const v = el.style.getPropertyValue(property);
  return v === '' ? null : v;
}

/**
 * Live preview only: mutate inline style directly, WITHOUT recording history.
 * Used while a slider/color picker is being dragged; finalized by commitStyle.
 */
export function previewStyle(el, property, value) {
  applyStyle(el, property, value);
}

/**
 * Records a set-style change with an explicitly supplied oldValue (the inline
 * value captured before any live preview began). No-op if nothing changed.
 */
export function commitStyle(state, el, property, oldValue, newValue) {
  const normOld = oldValue === '' ? null : oldValue;
  const normNew = newValue === '' ? null : newValue;
  if (normOld === normNew) return;
  const path = toPath(el, state.root);
  if (!path) return;
  addChange(state, { type: 'set-style', elementPath: path, property, oldValue: normOld, newValue: normNew });
}

/**
 * Applies a set of {property, value} declarations to `el` as ONE undoable unit.
 * Reads each current inline value as its oldValue. Skips no-op declarations.
 */
export function applyStyleBatch(state, el, declarations, label = 'style') {
  const path = toPath(el, state.root);
  if (!path) return;
  const children = [];
  for (const { property, value } of declarations) {
    const cur = el.style.getPropertyValue(property);
    const oldValue = cur === '' ? null : cur;
    const newValue = value === '' || value == null ? null : value;
    if (oldValue === newValue) continue;
    children.push({ type: 'set-style', elementPath: path, property, oldValue, newValue });
  }
  if (!children.length) return;
  addChange(state, { type: 'batch', label, children });
}

/** Removes a single inline style property (undoable). */
export function removeInlineStyle(state, el, property) {
  commitStyle(state, el, property, readInlineValue(el, property), null);
}

/**
 * Applies ONE property/value to MULTIPLE elements (multi-select batch-edit)
 * as a single undoable unit. Each element's oldValue is read fresh right
 * before building the batch — safe because, unlike the single-element
 * slider/color controls, multi-select editing never live-previews mid-drag,
 * so nothing has mutated these elements between "selected" and "commit".
 */
export function applyStyleToMany(state, elements, property, value, label = 'style') {
  const children = [];
  for (const el of elements) {
    const path = toPath(el, state.root);
    if (!path) continue;
    const cur = el.style.getPropertyValue(property);
    const oldValue = cur === '' ? null : cur;
    const newValue = value === '' || value == null ? null : value;
    if (oldValue === newValue) continue;
    children.push({ type: 'set-style', elementPath: path, property, oldValue, newValue });
  }
  if (!children.length) return;
  addChange(state, { type: 'batch', label, children });
}

/** Same idea as applyStyleBatch, but applies the full declaration set to MULTIPLE elements. */
export function applyStyleBatchToMany(state, elements, declarations, label = 'style') {
  const children = [];
  for (const el of elements) {
    const path = toPath(el, state.root);
    if (!path) continue;
    for (const { property, value } of declarations) {
      const cur = el.style.getPropertyValue(property);
      const oldValue = cur === '' ? null : cur;
      const newValue = value === '' || value == null ? null : value;
      if (oldValue === newValue) continue;
      children.push({ type: 'set-style', elementPath: path, property, oldValue, newValue });
    }
  }
  if (!children.length) return;
  addChange(state, { type: 'batch', label, children });
}

/** Lists the element's current inline style declarations. */
export function listInlineStyles(el) {
  const out = [];
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style[i];
    out.push({ name, value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name) });
  }
  return out;
}
