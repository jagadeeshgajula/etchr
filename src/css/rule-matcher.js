import { splitSelectorList, computeSpecificity, compareSpecificity } from './specificity.js';

function readProperties(style) {
  const props = [];
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    props.push({
      name,
      value: style.getPropertyValue(name),
      priority: style.getPropertyPriority(name),
    });
  }
  return props;
}

/** Highest specificity among the selector-list branches that actually match el. */
function bestMatchSpecificity(el, selectorText) {
  let best = null;
  for (const branch of splitSelectorList(selectorText)) {
    let matches = false;
    try {
      matches = el.matches(branch);
    } catch {
      matches = false; // invalid/unsupported selector — skip
    }
    if (matches) {
      const spec = computeSpecificity(branch);
      if (!best || compareSpecificity(spec, best) > 0) best = spec;
    }
  }
  return best;
}

function isGroupingRule(rule) {
  return !!rule.cssRules && (!!rule.media || rule.conditionText != null);
}

function walkRuleList(rules, el, sheetIndex, mediaPath, conditionText, out) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (isGroupingRule(rule)) {
      const cond = rule.media ? `@media ${rule.media.mediaText}` : `@supports ${rule.conditionText}`;
      walkRuleList(rule.cssRules, el, sheetIndex, mediaPath.concat(i), cond, out);
      continue;
    }
    if (rule.selectorText != null && rule.style) {
      const spec = bestMatchSpecificity(el, rule.selectorText);
      if (spec) {
        out.push({
          sheetIndex,
          mediaPath,
          ruleIndex: i,
          selectorText: rule.selectorText,
          specificity: spec,
          conditionText,
          properties: readProperties(rule.style),
          rule,
        });
      }
    }
  }
}

/**
 * Finds all style rules across document.styleSheets that match `el`.
 * Returns { matched: [...sorted by specificity desc], inaccessible: [cross-origin sheets] }.
 */
export function getMatchingRules(doc, el) {
  const matched = [];
  const inaccessible = [];
  const sheets = doc.styleSheets;
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      inaccessible.push({ sheetIndex: s, href: sheet.href || '(inline)' });
      continue;
    }
    if (!rules) continue;
    walkRuleList(rules, el, s, [], null, matched);
  }
  matched.sort((a, b) => compareSpecificity(b.specificity, a.specificity));
  return { matched, inaccessible };
}

/** Re-resolves a live CSSStyleRule from its stable address. */
export function resolveRule(doc, sheetIndex, mediaPath, ruleIndex) {
  const sheet = doc.styleSheets[sheetIndex];
  if (!sheet) return null;
  let rules;
  try {
    rules = sheet.cssRules;
  } catch {
    return null;
  }
  for (const idx of mediaPath) {
    const grouping = rules[idx];
    if (!grouping || !grouping.cssRules) return null;
    rules = grouping.cssRules;
  }
  return rules[ruleIndex] || null;
}
