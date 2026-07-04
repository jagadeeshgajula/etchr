import { registerHandler, addChange } from '../core/history.js';
import { toPath, fromPath } from '../core/element-path.js';

function applyAttr(el, name, value) {
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

registerHandler('set-attribute', {
  forward(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) applyAttr(el, entry.attribute, entry.newValue);
  },
  inverse(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) applyAttr(el, entry.attribute, entry.oldValue);
  },
});

/**
 * Records a set-attribute change. oldValue is captured from the live element.
 * Empty newValue is normalized to null (attribute removed).
 */
export function commitAttribute(state, el, attribute, newValue) {
  const oldValue = el.getAttribute(attribute); // string | null
  const normNew = newValue === '' ? null : newValue;
  if (oldValue === normNew) return;
  const path = toPath(el, state.root);
  if (!path) return;
  addChange(state, { type: 'set-attribute', elementPath: path, attribute, oldValue, newValue: normNew });
}
