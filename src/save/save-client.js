import { getCleanHTML } from '../serialize/html-serializer.js';
import { commitActiveEdit } from '../dom/text-editor.js';
import { notify } from '../core/editor-state.js';

/**
 * Runs the save flow: force-commits any pending text edit, serializes the
 * clean HTML, and routes it to config.onSave (if provided) or the default
 * /save-page endpoint. Shows a success/error toast either way.
 * Resolves true on success, false on decline/error.
 */
export async function saveNow(state, toast, { confirmOverwrite = false } = {}) {
  commitActiveEdit();
  const doc = state.root.ownerDocument;
  const html = getCleanHTML(doc);
  // Captured alongside the serialize: edits made while the request is in
  // flight must still read as unsaved afterwards.
  const indexAtSerialize = state.currentIndex;

  if (confirmOverwrite) {
    const win = doc.defaultView;
    if (!win.confirm('Save changes? This will overwrite the existing content.')) return false;
  }

  try {
    if (state.config.onSave) {
      await state.config.onSave(html);
    } else {
      const res = await fetch(state.config.saveEndpoint + `?path=${encodeURIComponent(doc.location.pathname)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/html' },
        body: html,
      });
      if (!res.ok) {
        let message = `Save failed (${res.status})`;
        try {
          const body = await res.json();
          if (body && body.error) message = body.error;
        } catch {
          /* response wasn't JSON — keep the generic message */
        }
        throw new Error(message);
      }
    }
    state.savedIndex = indexAtSerialize;
    notify(state);
    toast.success('Saved.');
    return true;
  } catch (err) {
    toast.error(`Save failed: ${err && err.message ? err.message : err}`);
    return false;
  }
}
