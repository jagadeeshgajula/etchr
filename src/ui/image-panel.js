import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, positionNear } from './dom-helpers.js';
import { readInlineValue, previewStyle, commitStyle } from '../dom/style-mutator.js';
import { commitAttribute } from '../dom/attribute-mutator.js';

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function createImagePanel(state) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;

  const panel = createEl(doc, 'div', {
    className: cls('panel') + ' ' + cls('image-panel'),
    attrs: { [ATTR_IGNORE]: '', role: 'region', 'aria-label': 'Image panel' },
  });
  panel.style.display = 'none';

  const header = createEl(doc, 'div', { className: cls('panel-header'), text: 'Image' });
  const closeBtn = createEl(doc, 'button', { className: cls('panel-close'), attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Close panel' }, text: '×' });
  closeBtn.addEventListener('click', hide);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = createEl(doc, 'div', { className: cls('panel-body') });
  panel.appendChild(body);

  const refreshers = [];

  function targetEl() {
    const el = state.selectedElements[0];
    return el && el.tagName.toLowerCase() === 'img' ? el : null;
  }

  function group(labelText) {
    const g = createEl(doc, 'div', { className: cls('panel-group') });
    g.appendChild(createEl(doc, 'div', { className: cls('panel-group-title'), text: labelText }));
    body.appendChild(g);
    return g;
  }

  function addRow(parent, labelText, controlEl) {
    const row = createEl(doc, 'label', { className: cls('field') });
    row.appendChild(createEl(doc, 'span', { className: cls('field-label'), text: labelText }));
    row.appendChild(controlEl);
    parent.appendChild(row);
    return row;
  }

  // ---- Source group: URL + upload ----
  const srcGroup = group('Source');

  const urlInput = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'text', placeholder: 'https://…', [ATTR_IGNORE]: '' } });
  urlInput.addEventListener('change', () => {
    const el = targetEl();
    if (el && urlInput.value.trim()) commitAttribute(state, el, 'src', urlInput.value.trim());
  });
  addRow(srcGroup, 'URL', urlInput);

  const fileWrap = createEl(doc, 'div', { className: cls('file-wrap') });
  const fileInput = createEl(doc, 'input', { attrs: { type: 'file', accept: 'image/*', [ATTR_IGNORE]: '', 'aria-label': 'Upload local image' } });
  fileInput.className = cls('file-input');
  const fileLabel = createEl(doc, 'span', { className: cls('btn') + ' ' + cls('file-btn'), text: 'Upload local image' });
  fileWrap.appendChild(fileLabel);
  fileWrap.appendChild(fileInput);
  fileInput.addEventListener('change', async () => {
    const el = targetEl();
    const file = fileInput.files && fileInput.files[0];
    if (!el || !file) return;
    let url;
    try {
      url = state.config.onImageUpload ? await state.config.onImageUpload(file) : await readFileAsDataURL(file);
    } catch (err) {
      url = null;
    }
    if (url) commitAttribute(state, el, 'src', url);
    fileInput.value = '';
  });
  srcGroup.appendChild(fileWrap);

  const altInput = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'text', placeholder: 'Alt text', [ATTR_IGNORE]: '' } });
  altInput.addEventListener('change', () => {
    const el = targetEl();
    if (el) commitAttribute(state, el, 'alt', altInput.value);
  });
  addRow(srcGroup, 'Alt', altInput);

  refreshers.push((el) => {
    const src = el.getAttribute('src') || '';
    urlInput.value = src.startsWith('data:') ? '' : src;
    altInput.value = el.getAttribute('alt') || '';
  });

  // ---- Size group ----
  const sizeGroup = group('Size');

  function addStyleNumber(parent, labelText, prop, { unit = 'px', min, max, step = 1 } = {}) {
    const input = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'range', [ATTR_IGNORE]: '' } });
    if (min != null) input.min = min;
    if (max != null) input.max = max;
    input.step = step;
    let captured = null;
    input.addEventListener('input', () => {
      const el = targetEl();
      if (!el) return;
      if (captured === null) captured = readInlineValue(el, prop);
      previewStyle(el, prop, `${input.value}${unit}`);
    });
    input.addEventListener('change', () => {
      const el = targetEl();
      if (!el) return;
      commitStyle(state, el, prop, captured, `${input.value}${unit}`);
      captured = null;
    });
    addRow(parent, labelText, input);
    refreshers.push((el) => {
      const val = parseFloat(win.getComputedStyle(el).getPropertyValue(prop));
      if (Number.isFinite(val)) input.value = String(val);
    });
  }

  addStyleNumber(sizeGroup, 'Width', 'width', { unit: 'px', min: 20, max: 1000 });

  const presetRow = createEl(doc, 'div', { className: cls('preset-row') });
  for (const [label, value] of [['S', '160px'], ['M', '320px'], ['L', '640px'], ['Full', '100%']]) {
    const b = createEl(doc, 'button', { className: cls('btn') + ' ' + cls('preset-btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: label });
    b.addEventListener('click', () => {
      const el = targetEl();
      if (el) commitStyle(state, el, 'width', readInlineValue(el, 'width'), value);
    });
    presetRow.appendChild(b);
  }
  sizeGroup.appendChild(presetRow);

  // ---- Shape / border group ----
  const shapeGroup = group('Shape & border');
  addStyleNumber(shapeGroup, 'Corner radius', 'border-radius', { unit: 'px', min: 0, max: 400 });

  const circleRow = createEl(doc, 'div', { className: cls('preset-row') });
  for (const [label, value] of [['Square', '0'], ['Rounded', '12px'], ['Circle', '50%']]) {
    const b = createEl(doc, 'button', { className: cls('btn') + ' ' + cls('preset-btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: label });
    b.addEventListener('click', () => {
      const el = targetEl();
      if (el) commitStyle(state, el, 'border-radius', readInlineValue(el, 'border-radius'), value);
    });
    circleRow.appendChild(b);
  }
  shapeGroup.appendChild(circleRow);

  addStyleNumber(shapeGroup, 'Border width', 'border-width', { unit: 'px', min: 0, max: 40 });

  const borderColor = createEl(doc, 'input', { className: cls('control') + ' ' + cls('control-color'), attrs: { type: 'color', [ATTR_IGNORE]: '' } });
  let bcCaptured = null;
  borderColor.addEventListener('input', () => {
    const el = targetEl();
    if (!el) return;
    if (bcCaptured === null) bcCaptured = readInlineValue(el, 'border-color');
    previewStyle(el, 'border-style', 'solid');
    previewStyle(el, 'border-color', borderColor.value);
  });
  borderColor.addEventListener('change', () => {
    const el = targetEl();
    if (!el) return;
    // Ensure border-style is solid so the color is visible; record both.
    commitStyle(state, el, 'border-style', readInlineValue(el, 'border-style'), 'solid');
    commitStyle(state, el, 'border-color', bcCaptured, borderColor.value);
    bcCaptured = null;
  });
  addRow(shapeGroup, 'Border color', borderColor);

  // ---- Background gradient group ----
  const gradGroup = group('Background gradient');
  const gStart = createEl(doc, 'input', { className: cls('control') + ' ' + cls('control-color'), attrs: { type: 'color', [ATTR_IGNORE]: '' } });
  const gEnd = createEl(doc, 'input', { className: cls('control') + ' ' + cls('control-color'), attrs: { type: 'color', [ATTR_IGNORE]: '' } });
  gStart.value = '#4c9ffe';
  gEnd.value = '#8a5cf6';
  addRow(gradGroup, 'From', gStart);
  addRow(gradGroup, 'To', gEnd);
  const applyGrad = createEl(doc, 'button', { className: cls('btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: 'Apply gradient' });
  applyGrad.addEventListener('click', () => {
    const el = targetEl();
    if (!el) return;
    const value = `linear-gradient(135deg, ${gStart.value}, ${gEnd.value})`;
    commitStyle(state, el, 'background-image', readInlineValue(el, 'background-image'), value);
  });
  const clearGrad = createEl(doc, 'button', { className: cls('btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: 'Clear' });
  clearGrad.addEventListener('click', () => {
    const el = targetEl();
    if (el) commitStyle(state, el, 'background-image', readInlineValue(el, 'background-image'), null);
  });
  const gradBtns = createEl(doc, 'div', { className: cls('preset-row') });
  gradBtns.appendChild(applyGrad);
  gradBtns.appendChild(clearGrad);
  gradGroup.appendChild(gradBtns);

  state.editorRoot.appendChild(panel);

  function refresh() {
    const el = targetEl();
    if (!el) return;
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

  subscribe(state, () => {
    if (!state.isEditModeEnabled || !targetEl()) {
      hide();
      return;
    }
    if (isOpen()) refresh();
  });

  win.addEventListener('scroll', reposition, true);
  win.addEventListener('resize', reposition);

  return { el: panel, show, hide, isOpen, isImageSelected: () => !!targetEl() };
}
