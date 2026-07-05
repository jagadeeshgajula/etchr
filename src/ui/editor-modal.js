import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl, button } from './dom-helpers.js';
import { svg } from './icons.js';
import { confirmDialog } from './confirm-dialog.js';

let current = null;

/**
 * Host-side editor modal: blurred backdrop + a framed popup (20% inset from
 * every screen edge) whose body is a same-origin iframe of the current page
 * with the editor running inside it in embedded mode.
 *
 * All host↔iframe wiring lives here:
 * - host → iframe: direct contentWindow.VisualEditor calls (save, isDirty),
 *   acquired at the iframe's load event (auto-init runs at the iframe's
 *   DOMContentLoaded, which always precedes load).
 * - iframe → host: an expando bridge set on the <iframe> element BEFORE src
 *   is assigned, read inside via window.frameElement.__etchrBridge.
 */
export function openEditorModal(editorRoot, { url, onFullyClosed }) {
  if (current) return current;

  const doc = editorRoot.ownerDocument;
  const win = doc.defaultView;

  const backdrop = createEl(doc, 'div', {
    className: cls('modal-backdrop'),
    attrs: { [ATTR_IGNORE]: '' },
  });
  const modal = createEl(doc, 'div', {
    className: cls('modal'),
    attrs: { [ATTR_IGNORE]: '', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit page' },
  });

  // Header: title left, Save / Maximize / Close right.
  const header = createEl(doc, 'div', { className: cls('modal-header') });
  header.appendChild(createEl(doc, 'div', { className: cls('modal-title'), text: 'Edit page' }));
  const actions = createEl(doc, 'div', { className: cls('modal-actions') });

  const saveBtn = button(doc, 'Save', onSaveClick, cls('btn-primary'));
  saveBtn.disabled = true; // until the editor instance is acquired

  let maximized = false;
  const maxBtn = button(doc, '', onMaximizeClick, cls('modal-iconbtn'));
  maxBtn.setAttribute('aria-label', 'Maximize');
  maxBtn.title = 'Maximize';
  maxBtn.appendChild(svg(doc, 'maximize', 16));

  const closeBtn = button(doc, '', () => { attemptClose(); }, cls('modal-iconbtn'));
  closeBtn.setAttribute('aria-label', 'Close editor');
  closeBtn.title = 'Close';
  closeBtn.appendChild(svg(doc, 'close', 16));

  actions.appendChild(saveBtn);
  actions.appendChild(maxBtn);
  actions.appendChild(closeBtn);
  header.appendChild(actions);
  modal.appendChild(header);

  const body = createEl(doc, 'div', { className: cls('modal-body') });
  const iframe = createEl(doc, 'iframe', {
    className: cls('modal-frame'),
    attrs: { title: 'Page editor' },
  });
  body.appendChild(iframe);
  modal.appendChild(body);

  let editorInstance = null;
  let didSave = false;
  let confirming = false;

  // The bridge must exist before any iframe script runs, so set it before src.
  iframe.__etchrBridge = {
    requestClose: () => attemptClose(),
    notifyDirty: (dirty) => saveBtn.classList.toggle(cls('btn-attention'), dirty),
    notifySaved: () => { didSave = true; },
  };
  iframe.src = url;

  const loadTimeout = win.setTimeout(() => {
    if (!editorInstance) showError();
  }, 12000);

  iframe.addEventListener('load', () => {
    win.clearTimeout(loadTimeout);
    const api = editorApi();
    editorInstance = api && api.getInstance ? api.getInstance() : null;
    if (editorInstance) saveBtn.disabled = false;
    else showError();
  });

  function editorApi() {
    try {
      return iframe.contentWindow ? iframe.contentWindow.VisualEditor : null;
    } catch {
      return null; // cross-origin navigation inside the frame — treat as gone
    }
  }

  function showError() {
    editorInstance = null;
    saveBtn.disabled = true;
    iframe.remove();
    const panel = createEl(doc, 'div', { className: cls('modal-error') });
    panel.appendChild(createEl(doc, 'div', { text: "Couldn't load the editor for this page." }));
    panel.appendChild(button(doc, 'Close', () => teardown()));
    body.appendChild(panel);
  }

  async function onSaveClick() {
    if (!editorInstance) return;
    saveBtn.disabled = true;
    const prevLabel = saveBtn.textContent;
    saveBtn.textContent = 'Saving…';
    try {
      await editorInstance.save();
    } finally {
      saveBtn.textContent = prevLabel;
      saveBtn.disabled = false;
    }
  }

  function onMaximizeClick() {
    maximized = !maximized;
    modal.classList.toggle(cls('modal-max'), maximized);
    maxBtn.replaceChild(svg(doc, maximized ? 'restore' : 'maximize', 16), maxBtn.firstElementChild);
    const label = maximized ? 'Restore size' : 'Maximize';
    maxBtn.setAttribute('aria-label', label);
    maxBtn.title = label;
  }

  function isDirtySafe() {
    const api = editorApi();
    try {
      return !!(api && api.isDirty && api.isDirty());
    } catch {
      return false;
    }
  }

  async function attemptClose() {
    if (confirming) return;
    if (isDirtySafe()) {
      confirming = true;
      const discard = await confirmDialog(editorRoot, {
        title: 'Unsaved changes',
        message: 'Are you sure you want to close? There are unsaved changes.',
        confirmLabel: 'Close without saving',
        cancelLabel: 'Keep editing',
        danger: true,
      });
      confirming = false;
      if (!discard) return;
    }
    teardown();
  }

  function onHostKeydown(e) {
    if (e.key === 'Escape') attemptClose();
  }

  function onBeforeUnload(e) {
    if (isDirtySafe()) e.preventDefault();
  }

  doc.addEventListener('keydown', onHostKeydown);
  win.addEventListener('beforeunload', onBeforeUnload);

  // Lock host scroll behind the modal; restore the exact prior inline value.
  const prevOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';

  function teardown() {
    doc.removeEventListener('keydown', onHostKeydown);
    win.removeEventListener('beforeunload', onBeforeUnload);
    doc.body.style.overflow = prevOverflow;
    backdrop.remove();
    modal.remove();
    current = null;
    if (onFullyClosed) onFullyClosed();
    // The host page still shows pre-edit content; reload it once so the user
    // sees what was saved. Only when a save actually happened this session.
    if (didSave) win.location.reload();
  }

  editorRoot.appendChild(backdrop);
  editorRoot.appendChild(modal);
  closeBtn.focus();

  current = { close: (force) => (force ? teardown() : attemptClose()), isOpen: () => current !== null };
  return current;
}
