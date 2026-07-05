import { registerHandler, addChange } from '../core/history.js';
import { resolveRule, resolveRuleContainer } from './rule-matcher.js';
import { getOrCreateEditableStylesheet, indexOfSheet, ensureMediaRule } from './stylesheet-registry.js';

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

// ---- add-media-rule: append a brand-new, empty @media block to the editable sheet ----
registerHandler('add-media-rule', {
  forward(state, entry) {
    const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
    if (!sheet) return;
    const already = sheet.cssRules[entry.ruleIndex];
    if (already && already.media && already.media.mediaText === entry.mediaText) return;
    sheet.insertRule(`@media ${entry.mediaText} { }`, entry.ruleIndex);
  },
  inverse(state, entry) {
    const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
    if (sheet) sheet.deleteRule(entry.ruleIndex);
  },
});

// ---- insert-css-rule: like add-css-rule, but into ANY resolved container
// (a plain sheet or a nested grouping rule such as an @media block) ----
registerHandler('insert-css-rule', {
  forward(state, entry) {
    const container = resolveRuleContainer(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath);
    if (!container) return;
    const existing = container.cssRules[entry.ruleIndex];
    if (existing && existing.selectorText === entry.selectorText) return;
    const body = entry.properties.map((p) => `${p.name}: ${p.value}${p.priority ? ' !' + p.priority : ''};`).join(' ');
    container.insertRule(`${entry.selectorText} { ${body} }`, entry.ruleIndex);
  },
  inverse(state, entry) {
    const container = resolveRuleContainer(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath);
    if (container) container.deleteRule(entry.ruleIndex);
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

/**
 * Non-committing upsert: finds-or-creates `mediaText`'s @media block, then
 * either EDITS an existing rule matching `selectorText` inside it (skipping
 * no-op properties) or INSERTS a brand-new rule with all declarations —
 * so repeatedly resizing the same element updates its breakpoint rule in
 * place instead of piling up duplicates. Returns descriptors to merge into
 * the caller's own {type:'batch'}; does NOT call addChange itself.
 *
 * `pendingInserts` is a Map the caller creates ONCE per batch (e.g. once per
 * resize commit) and passes to every describeResponsiveUpsert call in that
 * batch. It's required because none of these descriptors' forward() runs
 * until the whole batch is committed — so if two different selectors both
 * need a NEW rule inserted into the same container (a still-nonexistent
 * @media block, or an existing one neither has been added to yet) within one
 * batch, reading the container's live rule count for each independently would
 * compute the SAME insertion index for both, and the second insertRule call
 * would push the first rule to a different index than the one recorded in its
 * own descriptor — desyncing undo. Tracking a running per-container count
 * here keeps every insert's recorded ruleIndex correct.
 */
export function describeResponsiveUpsert(state, mediaText, selectorText, declarations, pendingInserts) {
  const doc = state.root.ownerDocument;
  const { sheetIndex, mediaPath, descriptor: mediaDescriptor } = ensureMediaRule(state, mediaText);
  const children = [];
  const containerKey = `${sheetIndex}:${mediaPath.join('.')}`;

  if (mediaDescriptor) {
    // First selector to target this not-yet-existing block also creates it;
    // a second selector targeting the same brand-new block must NOT queue a
    // second (duplicate) add-media-rule descriptor, or undo would delete the
    // block twice and remove whatever rule shifted into its place.
    if (!pendingInserts.has(containerKey)) children.push(mediaDescriptor);
  } else {
    // Container already exists live — look for a rule to edit in place.
    const container = resolveRuleContainer(doc, sheetIndex, mediaPath);
    const rules = container ? container.cssRules : [];
    let foundIndex = -1;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].selectorText === selectorText) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex !== -1) {
      const rule = rules[foundIndex];
      for (const { name, value } of declarations) {
        const oldRaw = rule.style.getPropertyValue(name);
        const oldValue = oldRaw === '' ? null : oldRaw;
        if (oldValue === value) continue;
        children.push({
          type: 'edit-css-rule',
          sheetIndex,
          mediaPath,
          ruleIndex: foundIndex,
          property: name,
          oldValue,
          oldPriority: '',
          newValue: value,
          newPriority: '',
        });
      }
      return children;
    }
  }

  const baseCount = mediaDescriptor ? 0 : resolveRuleContainer(doc, sheetIndex, mediaPath).cssRules.length;
  const already = pendingInserts.get(containerKey) || 0;
  const ruleIndex = baseCount + already;
  pendingInserts.set(containerKey, already + 1);

  children.push({
    type: 'insert-css-rule',
    sheetIndex,
    mediaPath,
    ruleIndex,
    selectorText,
    properties: declarations.map((d) => ({ name: d.name, value: d.value, priority: '' })),
  });
  return children;
}
