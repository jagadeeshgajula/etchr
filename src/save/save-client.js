import { getCleanHTML } from '../serialize/html-serializer.js';
import { commitActiveEdit } from '../dom/text-editor.js';

/**
 * Runs the save flow: force-commits any pending text edit, serializes the
 * clean HTML, and routes it to config.onSave (if provided) or the default
 * /save-page endpoint. Shows a success/error toast either way.
 */
export async function saveNow(state, toast, { confirmOverwrite = false } = {}) {
  commitActiveEdit();
  const doc = state.root.ownerDocument;
  const html = getCleanHTML(doc);

  if (confirmOverwrite) {
    const win = doc.defaultView;
    if (!win.confirm('Save changes? This will overwrite the existing content.')) return;
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
    toast.success('Saved.');
  } catch (err) {
    toast.error(`Save failed: ${err && err.message ? err.message : err}`);
  }
}
