import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, positionNear } from './dom-helpers.js';
import { readInlineValue, previewStyle, commitStyle, applyStyleToMany } from '../dom/style-mutator.js';
import { ensureGoogleFont } from './google-fonts.js';

const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'];

function rgbToHex(value) {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return value.startsWith('#') ? value : '#000000';
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

function currentValue(el, doc, prop) {
  const inline = readInlineValue(el, prop);
  if (inline != null) return inline;
  return doc.defaultView.getComputedStyle(el).getPropertyValue(prop);
}

export function createStylePanel(state) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;

  const panel = createEl(doc, 'div', {
    className: cls('panel') + ' ' + cls('style-panel'),
    attrs: { [ATTR_IGNORE]: '', role: 'region', 'aria-label': 'Text styles panel' },
  });
  panel.style.display = 'none';

  const header = createEl(doc, 'div', { className: cls('panel-header') });
  const titleEl = createEl(doc, 'span', { text: 'Text styles' });
  const closeBtn = createEl(doc, 'button', { className: cls('panel-close'), attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Close panel' }, text: '×' });
  closeBtn.addEventListener('click', () => hide());
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = createEl(doc, 'div', { className: cls('panel-body') });
  panel.appendChild(body);

  const refreshers = [];

  function addRow(labelText, controlEl) {
    const row = createEl(doc, 'label', { className: cls('field') });
    row.appendChild(createEl(doc, 'span', { className: cls('field-label'), text: labelText }));
    row.appendChild(controlEl);
    body.appendChild(row);
  }

  // The first selected element drives what the panel DISPLAYS (its current
  // values are shown as the starting point); commits apply to every selected
  // element via targetEls(), so multi-select batch-edits in one undo step.
  function targetEl() {
    return state.selectedElements[0] || null;
  }

  function targetEls() {
    return state.selectedElements.filter((el) => el.isConnected);
  }

  // Applies one property/value either to the single selection (existing
  // commitStyle, preserving its precise old-value handling) or to all
  // selected elements as one batch.
  function commit(prop, value, singleOldValue) {
    const els = targetEls();
    if (els.length <= 1) {
      const el = els[0];
      if (el) commitStyle(state, el, prop, singleOldValue !== undefined ? singleOldValue : readInlineValue(el, prop), value);
      return;
    }
    applyStyleToMany(state, els, prop, value, prop);
  }

  // --- Select-based controls (commit immediately on change) ---
  function addSelect(labelText, prop, options, onApply) {
    const select = createEl(doc, 'select', { className: cls('control'), attrs: { [ATTR_IGNORE]: '' } });
    for (const opt of options) {
      const o = createEl(doc, 'option', { text: opt.label, attrs: { value: opt.value } });
      select.appendChild(o);
    }
    select.addEventListener('change', () => {
      if (!targetEls().length) return;
      if (onApply) targetEls().forEach((el) => onApply(el, select.value));
      commit(prop, select.value);
    });
    addRow(labelText, select);
    refreshers.push((el) => {
      const val = currentValue(el, doc, prop).trim();
      const match = options.find((o) => o.value === val || val.startsWith(o.value));
      select.value = match ? match.value : options[0].value;
    });
  }

  // --- Number controls with unit (live preview only for a single selection;
  //     multi-select commits directly on change, see commit()) ---
  function addNumber(labelText, prop, { unit = 'px', min, max, step = 1 } = {}) {
    const input = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'number', [ATTR_IGNORE]: '' } });
    if (min != null) input.min = min;
    if (max != null) input.max = max;
    input.step = step;
    let captured = null;
    const toValue = () => (input.value === '' ? '' : `${input.value}${unit}`);
    input.addEventListener('input', () => {
      const els = targetEls();
      if (els.length !== 1) return; // live preview only makes sense for one element
      if (captured === null) captured = readInlineValue(els[0], prop);
      previewStyle(els[0], prop, toValue());
    });
    input.addEventListener('change', () => {
      if (!targetEls().length) return;
      const oldValue = captured;
      captured = null;
      commit(prop, toValue(), oldValue);
    });
    addRow(labelText, input);
    refreshers.push((el) => {
      const val = currentValue(el, doc, prop).trim();
      const num = parseFloat(val);
      input.value = Number.isFinite(num) ? String(num) : '';
    });
  }

  // --- Color control (live preview only for a single selection) ---
  function addColor(labelText, prop) {
    const input = createEl(doc, 'input', { className: cls('control') + ' ' + cls('control-color'), attrs: { type: 'color', [ATTR_IGNORE]: '' } });
    let captured = null;
    input.addEventListener('input', () => {
      const els = targetEls();
      if (els.length !== 1) return;
      if (captured === null) captured = readInlineValue(els[0], prop);
      previewStyle(els[0], prop, input.value);
    });
    input.addEventListener('change', () => {
      if (!targetEls().length) return;
      const oldValue = captured;
      captured = null;
      commit(prop, input.value, oldValue);
    });
    addRow(labelText, input);
    refreshers.push((el) => {
      input.value = rgbToHex(currentValue(el, doc, prop).trim());
    });
  }

  const fontOptions = [
    ...state.config.fontFamilies.map((f) => ({ label: f.split(',')[0].replace(/["']/g, ''), value: f })),
    ...state.config.googleFonts.map((f) => ({ label: `${f} (Google)`, value: `'${f}', sans-serif` })),
  ];

  addSelect('Font', 'font-family', fontOptions, (el, value) => {
    const google = state.config.googleFonts.find((f) => value.includes(f));
    if (google) ensureGoogleFont(doc, google);
  });
  addNumber('Size', 'font-size', { unit: 'px', min: 8, max: 200 });
  addSelect('Weight', 'font-weight', FONT_WEIGHTS.map((w) => ({ label: w, value: w })));
  addNumber('Line height', 'line-height', { unit: '', min: 0.5, max: 4, step: 0.1 });
  addNumber('Letter spacing', 'letter-spacing', { unit: 'px', min: -5, max: 20, step: 0.1 });
  addSelect('Align', 'text-align', TEXT_ALIGNS.map((a) => ({ label: a, value: a })));
  addColor('Color', 'color');

  state.editorRoot.appendChild(panel);

  function refresh() {
    const el = targetEl();
    if (!el) return;
    const count = targetEls().length;
    titleEl.textContent = count > 1 ? `Text styles (${count} selected)` : 'Text styles';
    for (const fn of refreshers) fn(el);
  }

  function reposition() {
    const el = targetEl();
    if (!el || !isOpen()) return;
    positionNear(panel, el.getBoundingClientRect(), win);
  }

  function show() {
    const el = targetEl();
    if (!el) return;
    panel.style.display = 'block';
    refresh();
    positionNear(panel, el.getBoundingClientRect(), win);
  }

  function hide() {
    panel.style.display = 'none';
  }

  function isOpen() {
    return panel.style.display !== 'none';
  }

  // Keep in sync when selection changes or history mutates the selected element.
  subscribe(state, () => {
    if (!state.isEditModeEnabled || !targetEl()) {
      hide();
      return;
    }
    if (isOpen()) refresh();
  });

  win.addEventListener('scroll', reposition, true);
  win.addEventListener('resize', reposition);

  return { el: panel, show, hide, isOpen };
}
