// A pragmatic, offline English-phrase -> CSS parser. It recognizes common
// styling vocabulary (borders, colors, radius, shadow, spacing, size, text
// styles, background/gradient) and returns [{property, value}] declarations.
// It is intentionally heuristic; for true natural-language understanding, wire
// config.onAiStyle(text, context) to an LLM (see README / image below).

const NAMED_COLORS = {
  black: '#000000', white: '#ffffff', red: '#e53935', green: '#43a047', blue: '#1e88e5',
  yellow: '#fdd835', orange: '#fb8c00', purple: '#8e24aa', pink: '#ec407a', gray: '#9e9e9e',
  grey: '#9e9e9e', brown: '#6d4c41', cyan: '#00acc1', teal: '#00897b', navy: '#1a237e',
  gold: '#c9a227', silver: '#bdbdbd', maroon: '#800000', olive: '#808000', lime: '#c0ca33',
  indigo: '#3f51b5', violet: '#7e57c2', coral: '#ff7f50', crimson: '#dc143c', turquoise: '#26c6da',
  transparent: 'transparent', dark: '#222222', light: '#f5f5f5',
};

function findColors(text) {
  const found = [];
  const hexes = text.match(/#[0-9a-f]{3,8}\b/gi);
  if (hexes) found.push(...hexes);
  const rgbs = text.match(/rgba?\([^)]*\)/gi);
  if (rgbs) found.push(...rgbs);
  for (const name of Object.keys(NAMED_COLORS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) found.push(NAMED_COLORS[name]);
  }
  return found;
}

function firstColor(text) {
  return findColors(text)[0] || null;
}

function firstLength(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(px|rem|em|%|pt)?/);
  if (!m) return null;
  return `${m[1]}${m[2] || 'px'}`;
}

function findSide(text) {
  if (/\b(all sides|around|every side|all around)\b/.test(text)) return 'all';
  if (/\b(top|upper)\b/.test(text)) return 'top';
  if (/\bright(?:\s*(?:side|hand))?\b/.test(text)) return 'right';
  if (/\b(bottom|lower|underneath|below)\b/.test(text)) return 'bottom';
  if (/\bleft(?:\s*(?:side|hand))?\b/.test(text)) return 'left';
  return null;
}

function borderStyle(text) {
  if (/\bdash/.test(text)) return 'dashed';
  if (/\bdot/.test(text)) return 'dotted';
  if (/\bdouble\b/.test(text)) return 'double';
  if (/\bgroove\b/.test(text)) return 'groove';
  if (/\bridge\b/.test(text)) return 'ridge';
  return 'solid';
}

function borderThickness(text) {
  const len = firstLength(text);
  if (len) return len;
  if (/\b(very thick|extra thick|heavy|bold border)\b/.test(text)) return '6px';
  if (/\bthick\b/.test(text)) return '4px';
  if (/\b(thin|hairline|light)\b/.test(text)) return '1px';
  if (/\bmedium\b/.test(text)) return '3px';
  return '2px';
}

/**
 * Parses an English styling phrase into CSS declarations.
 * @returns {{declarations: {property,value}[], summary: string}}
 */
export function parseNaturalLanguage(input) {
  const t = ` ${input.toLowerCase()} `;
  const decl = [];
  const color = firstColor(t);
  const side = findSide(t);
  const hasBorder = /\b(border|outline|stroke)\b/.test(t);
  const hasBg = /\b(background|bg|fill|backdrop)\b/.test(t);

  if (hasBorder) {
    const w = borderThickness(t);
    const style = borderStyle(t);
    const c = (hasBorder && color) || '#333333';
    const prop = side && side !== 'all' ? `border-${side}` : 'border';
    decl.push({ property: prop, value: `${w} ${style} ${c}` });
  }

  if (/\b(rounded|round corners?|border[- ]?radius|pill|circle|circular)\b/.test(t)) {
    let r = '10px';
    if (/\b(circle|circular)\b/.test(t)) r = '50%';
    else if (/\bpill\b/.test(t)) r = '999px';
    else if (/\b(very|extra|fully|super)\b/.test(t)) r = '24px';
    else if (/\b(slightly|a little|subtle|small)\b/.test(t)) r = '4px';
    if (/radius/.test(t)) { const len = firstLength(t); if (len) r = len; }
    decl.push({ property: 'border-radius', value: r });
  }

  if (/\bshadow\b/.test(t)) {
    if (/\btext shadow\b/.test(t)) {
      decl.push({ property: 'text-shadow', value: '1px 1px 2px rgba(0,0,0,0.4)' });
    } else {
      let v = '0 4px 12px rgba(0,0,0,0.2)';
      if (/\b(soft|light|subtle|slight)\b/.test(t)) v = '0 2px 8px rgba(0,0,0,0.15)';
      else if (/\b(strong|heavy|big|large|deep)\b/.test(t)) v = '0 8px 24px rgba(0,0,0,0.35)';
      decl.push({ property: 'box-shadow', value: v });
    }
  }

  if (hasBg) {
    if (/\bgradient\b/.test(t)) {
      const cs = findColors(t);
      decl.push({ property: 'background-image', value: `linear-gradient(135deg, ${cs[0] || '#4c9ffe'}, ${cs[1] || '#8a5cf6'})` });
    } else if (color) {
      decl.push({ property: 'background-color', value: color });
    }
  }

  // Text color: explicit "text/font colo(u)r", or a bare color with no border/bg target.
  const wantsTextColor =
    /\b(text colou?r|font colou?r|colou?r of (?:the )?text)\b/.test(t) ||
    (color && /\b(text|font|word|letter)\b/.test(t) && !hasBorder && !hasBg) ||
    (color && /\bcolou?r\b/.test(t) && !hasBorder && !hasBg);
  if (wantsTextColor && color) decl.push({ property: 'color', value: color });

  // Font size
  if (/\b(bigger|larger|large text|big text|increase (?:the )?(?:font|text) size|font size|text size)\b/.test(t)) {
    const len = firstLength(t);
    decl.push({ property: 'font-size', value: len || (/\b(huge|massive|very (?:big|large))\b/.test(t) ? '32px' : '20px') });
  } else if (/\b(smaller|small text|tiny|reduce (?:the )?(?:font|text) size)\b/.test(t)) {
    decl.push({ property: 'font-size', value: firstLength(t) || '12px' });
  }

  if (/\b(bold|bolder|strong)\b/.test(t)) decl.push({ property: 'font-weight', value: '700' });
  if (/\b(italic|slanted)\b/.test(t)) decl.push({ property: 'font-style', value: 'italic' });
  if (/\bunderline\b/.test(t)) decl.push({ property: 'text-decoration', value: 'underline' });
  if (/\b(uppercase|all caps|capital)\b/.test(t)) decl.push({ property: 'text-transform', value: 'uppercase' });
  if (/\b(center|centre|middle)\b/.test(t) && /\b(text|align|content)\b/.test(t)) decl.push({ property: 'text-align', value: 'center' });
  if (/\b(align|to the) right\b/.test(t) && /\btext\b/.test(t)) decl.push({ property: 'text-align', value: 'right' });

  // Padding / margin
  if (/\b(padding|space inside|inner space|breathing room|roomy)\b/.test(t)) {
    const len = firstLength(t) || (/\b(more|lots|large|big)\b/.test(t) ? '24px' : '12px');
    decl.push({ property: side && side !== 'all' ? `padding-${side}` : 'padding', value: len });
  }
  if (/\b(margin|space outside|outer space|gap around|push away)\b/.test(t)) {
    const len = firstLength(t) || '16px';
    decl.push({ property: side && side !== 'all' ? `margin-${side}` : 'margin', value: len });
  }

  // Width / height
  const wm = t.match(/\bwidth\s*(?:of|to|=|:)?\s*(\d+(?:\.\d+)?)\s*(px|rem|em|%)?/);
  if (wm) decl.push({ property: 'width', value: `${wm[1]}${wm[2] || 'px'}` });
  const hm = t.match(/\bheight\s*(?:of|to|=|:)?\s*(\d+(?:\.\d+)?)\s*(px|rem|em|%)?/);
  if (hm) decl.push({ property: 'height', value: `${hm[1]}${hm[2] || 'px'}` });
  if (/\bfull width\b/.test(t)) decl.push({ property: 'width', value: '100%' });

  // Misc
  if (/\b(pointer|clickable|hand cursor)\b/.test(t)) decl.push({ property: 'cursor', value: 'pointer' });
  if (/\b(see-through|semi-transparent|faded)\b/.test(t)) decl.push({ property: 'opacity', value: '0.6' });

  const declarations = dedupe(decl);
  const summary = declarations.length
    ? declarations.map((d) => `${d.property}: ${d.value}`).join('; ')
    : '';
  return { declarations, summary };
}

function dedupe(decls) {
  const seen = new Map();
  for (const d of decls) seen.set(d.property, d); // later wins
  return [...seen.values()];
}
