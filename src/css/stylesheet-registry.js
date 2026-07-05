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

/** Index of a top-level rule in `sheet` whose .media.mediaText matches, or -1. */
export function findTopLevelMediaRuleIndex(sheet, mediaText) {
  for (let i = 0; i < sheet.cssRules.length; i++) {
    const rule = sheet.cssRules[i];
    if (rule.media && rule.media.mediaText === mediaText) return i;
  }
  return -1;
}

/**
 * Non-committing find-or-create for a top-level @media block in the editable
 * sheet. New media rules are always appended flat (never nested), so any
 * mediaPath this returns is length 1. If the block doesn't exist yet, returns
 * a `descriptor` the caller must merge into its own addChange/batch — this
 * function itself never mutates the stylesheet or history.
 */
export function ensureMediaRule(state, mediaText) {
  const doc = state.root.ownerDocument;
  const sheet = getOrCreateEditableStylesheet(state);
  const sheetIndex = indexOfSheet(doc, sheet);
  const existingIndex = findTopLevelMediaRuleIndex(sheet, mediaText);
  if (existingIndex !== -1) return { sheetIndex, mediaPath: [existingIndex], descriptor: null };
  const ruleIndex = sheet.cssRules.length;
  return {
    sheetIndex,
    mediaPath: [ruleIndex],
    descriptor: { type: 'add-media-rule', sheetIndex, ruleIndex, mediaText },
  };
}
