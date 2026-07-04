import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, button } from './dom-helpers.js';
import { undo, redo, canUndo, canRedo } from '../core/history.js';
import { commitActiveEdit } from '../dom/text-editor.js';

export function createMainToolbar(state, modeController, { onSave } = {}) {
  const doc = state.editorRoot.ownerDocument;

  const bar = createEl(doc, 'div', {
    className: cls('main-toolbar'),
    attrs: { [ATTR_IGNORE]: '', role: 'toolbar', 'aria-label': 'Editor toolbar' },
  });

  const modeToggle = button(doc, 'Enable editing', () => modeController.toggle());
  // Force-commit any in-progress text edit first so undo/redo never straddles
  // an uncommitted contenteditable session (see commitActiveEdit doc comment).
  const undoBtn = button(doc, 'Undo', () => { commitActiveEdit(); undo(state); });
  const redoBtn = button(doc, 'Redo', () => { commitActiveEdit(); redo(state); });

  bar.appendChild(modeToggle);
  bar.appendChild(undoBtn);
  bar.appendChild(redoBtn);

  let saveBtn = null;
  if (onSave) {
    saveBtn = button(doc, 'Save', onSave, cls('btn-active'));
    bar.appendChild(saveBtn);
  }

  state.editorRoot.appendChild(bar);

  subscribe(state, () => {
    modeToggle.textContent = state.isEditModeEnabled ? 'Exit editing' : 'Enable editing';
    modeToggle.classList.toggle(cls('btn-active'), state.isEditModeEnabled);
    undoBtn.disabled = !canUndo(state);
    redoBtn.disabled = !canRedo(state);
  });

  return { el: bar, appendButton: (el) => bar.appendChild(el) };
}
