import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, button, positionNear } from './dom-helpers.js';
import { beginTextEdit } from '../dom/text-editor.js';
import { removeElement, removeElements } from '../dom/dom-mutator.js';

export function createToolbar(state, modeController) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;

  const bar = createEl(doc, 'div', {
    className: cls('toolbar'),
    attrs: { [ATTR_IGNORE]: '', role: 'toolbar', 'aria-label': 'Selected element actions' },
  });
  bar.style.display = 'none';

  const editTextBtn = button(doc, 'Edit text', () => {
    const el = state.selectedElements[0];
    if (el) beginTextEdit(state, el);
  });

  const deleteBtn = button(doc, 'Delete', () => {
    const els = state.selectedElements.filter((el) => el.isConnected);
    if (els.length === 1) removeElement(state, els[0]);
    else if (els.length > 1) removeElements(state, els);
    modeController.clearSelection(state);
  }, cls('btn-danger'));

  bar.appendChild(editTextBtn);
  bar.appendChild(deleteBtn);
  state.editorRoot.appendChild(bar);

  function targetRect() {
    const els = state.selectedElements.filter((el) => el.isConnected);
    if (!els.length) return null;
    // Anchor near the most recently added element so the toolbar tracks
    // whatever the user just shift-clicked, rather than jumping to the first.
    return els[els.length - 1].getBoundingClientRect();
  }

  function reposition() {
    const rect = targetRect();
    const count = state.selectedElements.length;
    if (!rect || !state.isEditModeEnabled) {
      bar.style.display = 'none';
      return;
    }
    // Text editing and CSS/Font/Image inspection only make sense for a single
    // element; multi-select narrows the toolbar to batch-safe actions.
    editTextBtn.style.display = count > 1 ? 'none' : '';
    deleteBtn.textContent = count > 1 ? `Delete (${count})` : 'Delete';
    bar.style.display = 'flex';
    positionNear(bar, rect, win);
  }

  subscribe(state, reposition);
  win.addEventListener('scroll', reposition, true);
  win.addEventListener('resize', reposition);

  return {
    el: bar,
    reposition,
    appendButton: (el) => bar.insertBefore(el, deleteBtn),
    // Lets index.js hide single-element-only buttons (CSS/Image) during multi-select.
    isMultiSelect: () => state.selectedElements.filter((el) => el.isConnected).length > 1,
  };
}
