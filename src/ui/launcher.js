import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl } from './dom-helpers.js';
import { svg } from './icons.js';

/**
 * The host page's only chrome: a gradient squircle pencil button fixed to the
 * top-right corner. Clicking it opens the editor modal — no editing functions
 * are active on the host page itself.
 */
export function createLauncher(editorRoot, { onOpen }) {
  const doc = editorRoot.ownerDocument;

  const btn = createEl(doc, 'button', {
    className: cls('launcher'),
    attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Edit this page', title: 'Edit this page' },
  });
  btn.appendChild(svg(doc, 'pencil', 28));
  btn.addEventListener('click', () => onOpen());
  editorRoot.appendChild(btn);

  return {
    el: btn,
    // Disabled while the modal is open (double-open guard); re-enabled and
    // refocused when the modal fully closes.
    setOpen(open) {
      btn.disabled = open;
      if (!open) btn.focus();
    },
    destroy: () => btn.remove(),
  };
}
