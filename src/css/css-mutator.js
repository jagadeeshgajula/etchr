import { registerHandler, addChange } from '../core/history.js';
import { resolveRule } from './rule-matcher.js';
import { getOrCreateEditableStylesheet, indexOfSheet } from './stylesheet-registry.js';

function setOrRemove(style, property, value, priority) {
  if (value === null || value === '') {
    style.removeProperty(property);
  } else {
    style.setProperty(property, value, priority || '');
  }
}

// ---- edit-css-rule: change one property on an existing rule ----
registerHandler('edit-css-rule', {
  forward(state, entry) {
    const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
    if (rule) setOrRemove(rule.style, entry.property, entry.newValue, entry.newPriority);
  },
  inverse(state, entry) {
    const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
    if (rule) setOrRemove(rule.style, entry.property, entry.oldValue, entry.oldPriority);
  },
});

// ---- add-css-rule: append a brand-new rule to the editable sheet ----
registerHandler('add-css-rule', {
  forward(state, entry) {
    const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
    // If it doesn't exist yet (initial apply or redo), (re)insert it.
    if (rule && rule.selectorText === entry.selectorText) return;
    const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
    if (!sheet) return;
    const body = entry.properties.map((p) => `${p.name}: ${p.value}${p.priority ? ' !' + p.priority : ''};`).join(' ');
    sheet.insertRule(`${entry.selectorText} { ${body} }`, entry.ruleIndex);
  },
  inverse(state, entry) {
    const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
    if (sheet) sheet.deleteRule(entry.ruleIndex);
  },
});

/**
 * Records a property edit on a matched rule (identified by its stable address).
 */
export function commitCssEdit(state, address, property, newValue, newPriority = '') {
  const rule = resolveRule(state.root.ownerDocument, address.sheetIndex, address.mediaPath, address.ruleIndex);
  if (!rule) return;
  const oldRaw = rule.style.getPropertyValue(property);
  const oldValue = oldRaw === '' ? null : oldRaw;
  const oldPriority = rule.style.getPropertyPriority(property);
  const normNew = newValue === '' ? null : newValue;
  if (oldValue === normNew && oldPriority === newPriority) return;
  addChange(state, {
    type: 'edit-css-rule',
    sheetIndex: address.sheetIndex,
    mediaPath: address.mediaPath,
    ruleIndex: address.ruleIndex,
    property,
    oldValue,
    oldPriority,
    newValue: normNew,
    newPriority,
  });
}

/**
 * Creates a new empty rule with the given selector in the editable sheet.
 * Returns the address of the created rule, or null on failure.
 */
export function addCssRule(state, selectorText) {
  const doc = state.root.ownerDocument;
  const sheet = getOrCreateEditableStylesheet(state);
  const sheetIndex = indexOfSheet(doc, sheet);
  if (sheetIndex === -1) return null;
  const ruleIndex = sheet.cssRules.length; // append-only
  addChange(state, {
    type: 'add-css-rule',
    sheetIndex,
    mediaPath: [],
    ruleIndex,
    selectorText,
    properties: [],
  });
  return { sheetIndex, mediaPath: [], ruleIndex };
}
