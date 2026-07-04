import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl, positionNear } from './dom-helpers.js';
import { getMatchingRules, resolveRule } from '../css/rule-matcher.js';
import { formatSpecificity } from '../css/specificity.js';
import { commitCssEdit, addCssRule } from '../css/css-mutator.js';
import { debounce } from '../core/debounce.js';

export function createCssPanel(state) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;

  const panel = createEl(doc, 'div', {
    className: cls('panel') + ' ' + cls('css-panel'),
    attrs: { [ATTR_IGNORE]: '', role: 'region', 'aria-label': 'CSS rules panel' },
  });
  panel.style.display = 'none';

  const header = createEl(doc, 'div', { className: cls('panel-header'), text: 'CSS rules' });
  const closeBtn = createEl(doc, 'button', { className: cls('panel-close'), attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Close panel' }, text: '×' });
  closeBtn.addEventListener('click', hide);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const body = createEl(doc, 'div', { className: cls('panel-body') });
  panel.appendChild(body);
  state.editorRoot.appendChild(panel);

  // Rules created this session via the "add rule" form, so we can keep showing
  // their editor even when the selector doesn't match the current selection.
  const addedRules = [];

  function targetEl() {
    return state.selectedElements[0] || null;
  }

  function propRow(address, name, value, priority) {
    const row = createEl(doc, 'div', { className: cls('css-prop') });
    const nameEl = createEl(doc, 'span', { className: cls('css-prop-name'), text: name });
    const valInput = createEl(doc, 'input', { className: cls('control') + ' ' + cls('css-prop-value'), attrs: { type: 'text', [ATTR_IGNORE]: '' } });
    valInput.value = priority ? `${value} !${priority}` : value;
    valInput.addEventListener('change', () => {
      let v = valInput.value.trim();
      let prio = '';
      if (/!\s*important$/i.test(v)) {
        prio = 'important';
        v = v.replace(/!\s*important$/i, '').trim();
      }
      commitCssEdit(state, address, name, v, prio);
    });
    const rm = createEl(doc, 'button', { className: cls('css-prop-remove'), attrs: { type: 'button', [ATTR_IGNORE]: '', title: 'Remove property', 'aria-label': `Remove ${name}` }, text: '×' });
    rm.addEventListener('click', () => commitCssEdit(state, address, name, null, ''));
    row.appendChild(nameEl);
    row.appendChild(valInput);
    row.appendChild(rm);
    return row;
  }

  function ruleBlock(address, selectorText, specificity, conditionText, properties, editable) {
    const block = createEl(doc, 'div', { className: cls('css-rule') });

    const head = createEl(doc, 'div', { className: cls('css-rule-head') });
    if (conditionText) head.appendChild(createEl(doc, 'span', { className: cls('css-cond'), text: conditionText }));
    head.appendChild(createEl(doc, 'span', { className: cls('css-selector'), text: selectorText }));
    if (specificity) head.appendChild(createEl(doc, 'span', { className: cls('css-spec'), text: formatSpecificity(specificity), attrs: { title: 'specificity (id, class, type)' } }));
    block.appendChild(head);

    for (const p of properties) {
      block.appendChild(propRow(address, p.name, p.value, p.priority));
    }

    if (editable) {
      const addRow = createEl(doc, 'div', { className: cls('css-add-prop') });
      const nameInput = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'text', placeholder: 'property', [ATTR_IGNORE]: '' } });
      const valInput = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'text', placeholder: 'value', [ATTR_IGNORE]: '' } });
      const addBtn = createEl(doc, 'button', { className: cls('btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: '+' });
      const apply = () => {
        const name = nameInput.value.trim();
        const value = valInput.value.trim();
        if (!name || !value) return;
        commitCssEdit(state, address, name, value, '');
        nameInput.value = '';
        valInput.value = '';
      };
      addBtn.addEventListener('click', apply);
      valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
      addRow.appendChild(nameInput);
      addRow.appendChild(valInput);
      addRow.appendChild(addBtn);
      block.appendChild(addRow);
    }

    return block;
  }

  function render() {
    body.innerHTML = '';
    const el = targetEl();
    if (!el) return;

    // Add-rule form.
    const addForm = createEl(doc, 'div', { className: cls('css-add-rule') });
    const selInput = createEl(doc, 'input', { className: cls('control'), attrs: { type: 'text', placeholder: 'selector, e.g. .my-class', [ATTR_IGNORE]: '' } });
    const addBtn = createEl(doc, 'button', { className: cls('btn'), attrs: { type: 'button', [ATTR_IGNORE]: '' }, text: 'Add rule' });
    const submit = () => {
      const selector = selInput.value.trim();
      if (!selector) return;
      const addr = addCssRule(state, selector);
      if (addr) addedRules.push({ address: addr, selectorText: selector });
      selInput.value = '';
    };
    addBtn.addEventListener('click', submit);
    selInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    addForm.appendChild(selInput);
    addForm.appendChild(addBtn);
    body.appendChild(addForm);

    // Session-added rules that still exist.
    const liveAdded = addedRules.filter((r) => resolveRule(doc, r.address.sheetIndex, r.address.mediaPath, r.address.ruleIndex));
    addedRules.length = 0;
    addedRules.push(...liveAdded);
    if (liveAdded.length) {
      body.appendChild(createEl(doc, 'div', { className: cls('css-section-title'), text: 'Added rules' }));
      for (const r of liveAdded) {
        const rule = resolveRule(doc, r.address.sheetIndex, r.address.mediaPath, r.address.ruleIndex);
        const props = [];
        for (let i = 0; i < rule.style.length; i++) {
          const name = rule.style[i];
          props.push({ name, value: rule.style.getPropertyValue(name), priority: rule.style.getPropertyPriority(name) });
        }
        body.appendChild(ruleBlock(r.address, rule.selectorText, null, null, props, true));
      }
    }

    // Matching rules (excluding session-added rules already shown above).
    const addedKeys = new Set(liveAdded.map((r) => `${r.address.sheetIndex}:${r.address.mediaPath.join('.')}:${r.address.ruleIndex}`));
    const { matched, inaccessible } = getMatchingRules(doc, el);
    const shown = matched.filter((m) => !addedKeys.has(`${m.sheetIndex}:${m.mediaPath.join('.')}:${m.ruleIndex}`));
    body.appendChild(createEl(doc, 'div', { className: cls('css-section-title'), text: 'Matching rules' }));
    if (!shown.length) {
      body.appendChild(createEl(doc, 'div', { className: cls('css-empty'), text: 'No stylesheet rules match this element.' }));
    }
    for (const m of shown) {
      const address = { sheetIndex: m.sheetIndex, mediaPath: m.mediaPath, ruleIndex: m.ruleIndex };
      body.appendChild(ruleBlock(address, m.selectorText, m.specificity, m.conditionText, m.properties, true));
    }

    if (inaccessible.length) {
      const note = createEl(doc, 'div', { className: cls('css-note') });
      note.textContent = `${inaccessible.length} cross-origin stylesheet(s) can't be read or edited (CORS): ` + inaccessible.map((s) => s.href).join(', ');
      body.appendChild(note);
    }
  }

  let lastEl = null;
  let lastIndex = -2;

  function reposition() {
    const el = targetEl();
    if (!el || !isOpen()) return;
    positionNear(panel, el.getBoundingClientRect(), win);
  }

  function show() {
    if (!targetEl()) return;
    panel.style.display = 'block';
    lastEl = targetEl();
    lastIndex = state.currentIndex;
    render();
    positionNear(panel, targetEl().getBoundingClientRect(), win);
  }

  function hide() {
    panel.style.display = 'none';
  }

  function isOpen() {
    return panel.style.display !== 'none';
  }

  // Re-walking document.styleSheets on every notify() would be wasteful during
  // a rapid burst of changes (e.g. undoing/redoing several edits quickly while
  // this panel is open) — debounce the rescan, per the spec's explicit call-out.
  // Re-checks current conditions at fire time since the debounce may resolve
  // after several more notify()s have already coalesced into it.
  const debouncedRescan = debounce(() => {
    if (!state.isEditModeEnabled || !isOpen() || !targetEl()) return;
    lastEl = targetEl();
    lastIndex = state.currentIndex;
    render();
  }, state.config.debounceMs);

  subscribe(state, () => {
    if (!state.isEditModeEnabled || !targetEl()) {
      hide();
      return;
    }
    if (!isOpen()) return;
    const el = targetEl();
    if (el === lastEl && state.currentIndex === lastIndex) return; // avoid clobbering focus mid-edit
    debouncedRescan();
  });

  win.addEventListener('scroll', reposition, true);
  win.addEventListener('resize', reposition);

  return { el: panel, show, hide, isOpen };
}
