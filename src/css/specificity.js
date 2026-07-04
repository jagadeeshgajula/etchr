/**
 * Splits a selector list on top-level commas only (ignoring commas inside
 * :not(), :is(), [attr=","], etc.). Returns individual complex selectors.
 */
export function splitSelectorList(selectorText) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorText) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Computes {a, b, c} specificity for a single complex selector (no comma lists).
 *   a = #id count
 *   b = .class / [attr] / :pseudo-class count
 *   c = element / ::pseudo-element count
 * :where() contributes 0; :is()/:not() recurse into their arguments (max branch).
 * This is a pragmatic approximation of the CSS Selectors L4 algorithm.
 */
export function computeSpecificity(selector) {
  let a = 0;
  let b = 0;
  let c = 0;
  let s = selector;

  // Zero-specificity :where(...) — strip its contents entirely.
  s = s.replace(/:where\([^)]*\)/gi, ' ');

  // :is(...) / :not(...) / :has(...) contribute the max specificity of their args.
  const funcRe = /:(is|not|has|matches)\(([^()]*)\)/gi;
  let m;
  while ((m = funcRe.exec(s)) !== null) {
    const branches = splitSelectorList(m[2]);
    let best = { a: 0, b: 0, c: 0 };
    for (const branch of branches) {
      const spec = computeSpecificity(branch);
      if (compareSpecificity(spec, best) > 0) best = spec;
    }
    a += best.a;
    b += best.b;
    c += best.c;
  }
  s = s.replace(funcRe, ' ');

  // #id
  const ids = s.match(/#[\w-]+/g);
  if (ids) a += ids.length;
  s = s.replace(/#[\w-]+/g, ' ');

  // .class and [attribute]
  const classes = s.match(/\.[\w-]+/g);
  if (classes) b += classes.length;
  s = s.replace(/\.[\w-]+/g, ' ');
  const attrs = s.match(/\[[^\]]+\]/g);
  if (attrs) b += attrs.length;
  s = s.replace(/\[[^\]]+\]/g, ' ');

  // ::pseudo-element (must be counted before single-colon pseudo-classes)
  const pseudoEls = s.match(/::[\w-]+/g);
  if (pseudoEls) c += pseudoEls.length;
  s = s.replace(/::[\w-]+/g, ' ');

  // :pseudo-class
  const pseudoClasses = s.match(/:[\w-]+/g);
  if (pseudoClasses) b += pseudoClasses.length;
  s = s.replace(/:[\w-]+/g, ' ');

  // element / type selectors (skip the universal selector *)
  const types = s.match(/[a-zA-Z][\w-]*/g);
  if (types) c += types.length;

  return { a, b, c };
}

export function compareSpecificity(x, y) {
  if (x.a !== y.a) return x.a - y.a;
  if (x.b !== y.b) return x.b - y.b;
  return x.c - y.c;
}

export function formatSpecificity(spec) {
  return `${spec.a},${spec.b},${spec.c}`;
}
