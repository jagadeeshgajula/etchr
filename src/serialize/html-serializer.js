import { ATTR_IGNORE, ATTR_EDITING, ATTR_CREATED_SHEET } from '../core/constants.js';

// Attributes stripped from real content elements (kept, marker removed) —
// as opposed to [data-vve-ignore] subtrees, which are transient UI chrome
// removed wholesale. Order doesn't matter; contenteditable is a browser
// attribute the editor adds/removes itself, not one of our data-vve-* markers.
const CONTENT_MARKER_ATTRS = [ATTR_EDITING, ATTR_CREATED_SHEET, 'contenteditable'];

/**
 * Produces the full, clean HTML string for the current document: doctype +
 * <html> with all editor chrome removed and content markers stripped.
 * Clones first — NEVER mutates the live, actively-editing document.
 */
export function getCleanHTML(doc) {
  const clone = doc.documentElement.cloneNode(true);

  // Rules added through the CSSOM (insertRule — used by the CSS rule editor and
  // the auto-responsive resize breakpoints) live only on the live stylesheet
  // object; they never update the <style> element's text node, so a naive clone
  // serializes them as an empty <style></style> and the rules are lost on save.
  // Materialize each editor-created sheet's current rules into the CLONED
  // <style> before serializing — reading the live CSSOM but writing only into
  // the throwaway clone, so the actively-editing document is never mutated.
  const liveCreatedSheets = doc.querySelectorAll(`style[${ATTR_CREATED_SHEET}]`);
  const clonedCreatedSheets = clone.querySelectorAll(`style[${ATTR_CREATED_SHEET}]`);
  clonedCreatedSheets.forEach((cloneStyle, i) => {
    const liveSheet = liveCreatedSheets[i] && liveCreatedSheets[i].sheet;
    if (!liveSheet) return;
    try {
      cloneStyle.textContent = Array.from(liveSheet.cssRules).map((r) => r.cssText).join('\n');
    } catch {
      /* cross-origin or otherwise unreadable — leave whatever text it had */
    }
  });

  // Remove all editor UI chrome (the entire #vve-root subtree and anything
  // else marked transient) in one pass.
  clone.querySelectorAll(`[${ATTR_IGNORE}]`).forEach((el) => el.remove());

  // Strip bookkeeping markers from real content, keeping the element itself.
  for (const attr of CONTENT_MARKER_ATTRS) {
    clone.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  }

  const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) : '<!DOCTYPE html>';
  return `${doctype}\n${clone.outerHTML}`;
}
