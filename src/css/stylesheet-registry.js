import { ATTR_CREATED_SHEET } from '../core/constants.js';

/**
 * Returns the dedicated, editor-owned <style> sheet used for newly-added rules,
 * creating it in <head> on first use. New rules are always appended to this one
 * flat sheet so previously-recorded ruleIndex addresses never shift.
 */
export function getOrCreateEditableStylesheet(state) {
  const existing = state.editableStylesheet;
  if (existing && existing.ownerNode && existing.ownerNode.isConnected) return existing;

  const doc = state.root.ownerDocument;
  let styleEl = doc.querySelector(`style[${ATTR_CREATED_SHEET}]`);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.setAttribute(ATTR_CREATED_SHEET, '');
    doc.head.appendChild(styleEl);
  }
  state.editableStylesheet = styleEl.sheet;
  return state.editableStylesheet;
}

/** Index of a given CSSStyleSheet within document.styleSheets, or -1. */
export function indexOfSheet(doc, sheet) {
  for (let i = 0; i < doc.styleSheets.length; i++) {
    if (doc.styleSheets[i] === sheet) return i;
  }
  return -1;
}
