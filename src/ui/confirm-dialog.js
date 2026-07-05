import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl, button } from './dom-helpers.js';

/**
 * Neo-Brutalist replacement for window.confirm(). Appends into the given
 * editor root (host page or iframe — whichever document's chrome needs it)
 * and resolves a boolean: true for the confirm action, false otherwise.
 *
 * Escape and the cancel button both resolve false — the safe default. A
 * backdrop click does nothing: discarding work requires an explicit choice.
 */
export function confirmDialog(editorRoot, {
  title = 'Unsaved changes',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  const doc = editorRoot.ownerDocument;

  return new Promise((resolve) => {
    const backdrop = createEl(doc, 'div', {
      className: cls('confirm-backdrop'),
      attrs: { [ATTR_IGNORE]: '' },
    });
    const card = createEl(doc, 'div', {
      className: cls('confirm'),
      attrs: { [ATTR_IGNORE]: '', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
    });

    card.appendChild(createEl(doc, 'div', { className: cls('confirm-header'), text: title }));
    card.appendChild(createEl(doc, 'div', { className: cls('confirm-message'), text: message }));

    const actions = createEl(doc, 'div', { className: cls('confirm-actions') });
    const cancelBtn = button(doc, cancelLabel, () => settle(false));
    const confirmBtn = button(doc, confirmLabel, () => settle(true), danger ? cls('btn-danger') : cls('btn-primary'));
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(actions);

    // Capture-phase so an Escape here never also reaches the modal's own
    // Escape handler underneath (one dismissal per press).
    function onKeydown(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      settle(false);
    }
    doc.addEventListener('keydown', onKeydown, true);

    function settle(result) {
      doc.removeEventListener('keydown', onKeydown, true);
      backdrop.remove();
      card.remove();
      resolve(result);
    }

    editorRoot.appendChild(backdrop);
    editorRoot.appendChild(card);
    cancelBtn.focus();
  });
}
