import { registerHandler, addChange } from '../core/history.js';
import { toPath, fromPath } from '../core/element-path.js';
import { ATTR_EDITING } from '../core/constants.js';

registerHandler('text-edit', {
  forward(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) el.textContent = entry.newText;
  },
  inverse(state, entry) {
    const el = fromPath(entry.elementPath, state.root);
    if (el) el.textContent = entry.oldText;
  },
});

let activeEditingElement = null;

export function isEditingText() {
  return activeEditingElement !== null;
}

/**
 * Force-commits any in-progress contenteditable session (via blur, which
 * synchronously runs its commit handler). Called before button-triggered
 * undo/redo so a pending text edit is never silently dropped or left
 * straddling an unrelated structural change.
 */
export function commitActiveEdit() {
  if (activeEditingElement) activeEditingElement.blur();
}

export function beginTextEdit(state, el) {
  if (activeEditingElement) return;
  activeEditingElement = el;
  const oldText = el.textContent;
  el.setAttribute('contenteditable', 'true');
  el.setAttribute(ATTR_EDITING, '');
  el.focus();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    el.removeEventListener('blur', commit);
    el.removeEventListener('keydown', onKeydown);
    el.removeAttribute('contenteditable');
    el.removeAttribute(ATTR_EDITING);
    activeEditingElement = null;
    const newText = el.textContent;
    if (newText !== oldText) {
      const path = toPath(el, state.root);
      if (path) addChange(state, { type: 'text-edit', elementPath: path, oldText, newText });
    }
  };

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      el.textContent = oldText;
      el.blur();
    }
  }

  el.addEventListener('blur', commit);
  el.addEventListener('keydown', onKeydown);
}
