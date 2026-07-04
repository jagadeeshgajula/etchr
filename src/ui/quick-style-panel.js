import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, positionNear } from './dom-helpers.js';
import { applyStyleBatch, applyStyleBatchToMany, removeInlineStyle, listInlineStyles } from '../dom/style-mutator.js';
import { parseNaturalLanguage } from '../css/nl-parser.js';
import { getSuggestionsForElement } from '../css/style-suggestions.js';

export function createQuickStylePanel(state) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;

  const panel = createEl(doc, 'div', {
    className: cls('panel') + ' ' + cls('quick-panel'),
    attrs: { [ATTR_IGNORE]: '', role: 'region', 'aria-label': 'Style helper panel' },
  });
  panel.style.display = 'none';

  const header = createEl(doc, 'div', { className: cls('panel-header') });
  const titleEl = createEl(doc, 'span', { text: 'Style helper' });
  const closeBtn = createEl(doc, 'button', { className: cls('panel-close'), attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Close panel' }, text: '×' });
  closeBtn.addEventListener('click', hide);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = createEl(doc, 'div', { className: cls('panel-body') });
  panel.appendChild(body);
  state.editorRoot.appendChild(panel);

  // First selected element drives display (suggestions computed for its tag,
  // "Applied styles" lists its inline styles); the NL box and suggestion
  // chips apply to ALL selected elements as one batch when more than one is selected.
  function targetEl() {
    return state.selectedElements[0] || null;
  }

  function targetEls() {
    return state.selectedElements.filter((el) => el.isConnected);
  }

  function applyDeclarations(declarations, label) {
    const els = targetEls();
    if (els.length <= 1) {
      if (els[0]) applyStyleBatch(state, els[0], declarations, label);
    } else {
      applyStyleBatchToMany(state, els, declarations, label);
    }
  }

  // ---- Natural-language box ----
  const nlGroup = createEl(doc, 'div', { className: cls('panel-group') });
  nlGroup.appendChild(createEl(doc, 'div', { className: cls('panel-group-title'), text: 'Describe a style' }));
  const nlInput = createEl(doc, 'textarea', {
    className: cls('control') + ' ' + cls('nl-input'),
    attrs: { rows: '2', placeholder: 'e.g. "black dashed border on the right, thick" or "rounded with a soft shadow"', [ATTR_IGNORE]: '' },
  });
  const nlHint = createEl(doc, 'div', { className: cls('nl-hint') });
  const applyBtn = createEl(doc, 'button', { className: cls('btn') + ' ' + cls('btn-active'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: 'Apply' });

  async function applyNl() {
    const el = targetEl();
    if (!el) return;
    const text = nlInput.value.trim();
    if (!text) return;
    let declarations = null;
    if (state.config.onAiStyle) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Thinking…';
      try {
        declarations = await state.config.onAiStyle(text, { tag: el.tagName.toLowerCase(), currentStyles: listInlineStyles(el) });
      } catch (err) {
        nlHint.textContent = 'AI request failed — using built-in parser.';
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
      }
    }
    if (!declarations || !declarations.length) {
      declarations = parseNaturalLanguage(text).declarations;
    }
    if (!declarations.length) {
      nlHint.textContent = "Couldn't map that to CSS. Try words like border, rounded, shadow, padding, bigger, blue.";
      return;
    }
    nlHint.textContent = 'Applied: ' + declarations.map((x) => `${x.property}: ${x.value}`).join('; ');
    applyDeclarations(declarations, 'describe: ' + text.slice(0, 40));
    nlInput.value = '';
  }
  applyBtn.addEventListener('click', applyNl);
  nlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applyNl();
  });
  nlGroup.appendChild(nlInput);
  nlGroup.appendChild(applyBtn);
  nlGroup.appendChild(nlHint);
  body.appendChild(nlGroup);

  // ---- Suggestions ----
  const sugGroup = createEl(doc, 'div', { className: cls('panel-group') });
  sugGroup.appendChild(createEl(doc, 'div', { className: cls('panel-group-title'), text: 'Suggestions' }));
  const sugGrid = createEl(doc, 'div', { className: cls('sug-grid') });
  sugGroup.appendChild(sugGrid);
  body.appendChild(sugGroup);

  // ---- Applied styles (with remove) ----
  const appliedGroup = createEl(doc, 'div', { className: cls('panel-group') });
  appliedGroup.appendChild(createEl(doc, 'div', { className: cls('panel-group-title'), text: 'Applied styles' }));
  const appliedList = createEl(doc, 'div', { className: cls('applied-list') });
  appliedGroup.appendChild(appliedList);
  body.appendChild(appliedGroup);

  function renderSuggestions(el) {
    sugGrid.innerHTML = '';
    const { suggestions } = getSuggestionsForElement(el);
    for (const s of suggestions) {
      const chip = createEl(doc, 'button', { className: cls('sug-chip'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: s.label });
      chip.addEventListener('click', () => applyDeclarations(s.decl, 'suggestion: ' + s.label));
      sugGrid.appendChild(chip);
    }
  }

  function renderApplied(el) {
    appliedList.innerHTML = '';
    const styles = listInlineStyles(el);
    if (!styles.length) {
      appliedList.appendChild(createEl(doc, 'div', { className: cls('css-empty'), text: 'No inline styles on this element yet.' }));
      return;
    }
    for (const s of styles) {
      const row = createEl(doc, 'div', { className: cls('applied-row') });
      row.appendChild(createEl(doc, 'span', { className: cls('applied-name'), text: s.name }));
      row.appendChild(createEl(doc, 'span', { className: cls('applied-value'), text: s.value }));
      const rm = createEl(doc, 'button', { className: cls('applied-remove'), attrs: { type: 'button', [ATTR_IGNORE]: '', title: 'Remove', 'aria-label': `Remove ${s.name}` }, text: '×' });
      rm.addEventListener('click', () => {
        const target = targetEl();
        if (target) removeInlineStyle(state, target, s.name);
      });
      row.appendChild(rm);
      appliedList.appendChild(row);
    }
  }

  let lastEl = null;
  let lastIndex = -2;

  function render() {
    const el = targetEl();
    if (!el) return;
    lastEl = el;
    lastIndex = state.currentIndex;
    const count = targetEls().length;
    titleEl.textContent = count > 1 ? `Style helper (${count} selected)` : 'Style helper';
    renderSuggestions(el);
    renderApplied(el);
  }

  function reposition() {
    const el = targetEl();
    if (!el || !isOpen()) return;
    positionNear(panel, el.getBoundingClientRect(), win);
  }

  function show() {
    if (!targetEl()) return;
    panel.style.display = 'block';
    render();
    positionNear(panel, targetEl().getBoundingClientRect(), win);
  }

  function hide() {
    panel.style.display = 'none';
  }

  function isOpen() {
    return panel.style.display !== 'none';
  }

  subscribe(state, () => {
    if (!state.isEditModeEnabled || !targetEl()) {
      hide();
      return;
    }
    if (!isOpen()) return;
    const el = targetEl();
    if (el === lastEl && state.currentIndex === lastIndex) return;
    render();
  });

  win.addEventListener('scroll', reposition, true);
  win.addEventListener('resize', reposition);

  return { el: panel, show, hide, isOpen };
}
