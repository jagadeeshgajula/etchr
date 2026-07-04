import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl } from './dom-helpers.js';
import { toPath, fromPath, getEditableChildren } from '../core/element-path.js';
import { addElement } from '../dom/dom-mutator.js';
import { createDefaultElement, ELEMENT_CATEGORIES } from '../dom/element-factory.js';

/**
 * Decides where a new element should go relative to the current selection:
 * - a selected container tag -> appended as its last child
 * - a selected non-container -> inserted as the next sibling after it
 * - nothing selected          -> appended to the end of <body>
 */
function resolvePlacement(state) {
  const el = state.selectedElements[0];
  if (!el) {
    return { parentPath: [], index: getEditableChildren(state.root).length };
  }
  const tag = el.tagName.toLowerCase();
  if (state.config.containerTags.has(tag)) {
    const parentPath = toPath(el, state.root);
    if (!parentPath) return null;
    return { parentPath, index: getEditableChildren(el).length };
  }
  const parent = el.parentElement;
  const parentPath = toPath(parent, state.root);
  if (!parentPath) return null;
  const index = getEditableChildren(parent).indexOf(el) + 1;
  return { parentPath, index };
}

export function createElementsPalette(state, modeController, hooks = {}) {
  const doc = state.editorRoot.ownerDocument;

  const panel = createEl(doc, 'aside', {
    className: cls('palette'),
    attrs: { [ATTR_IGNORE]: '', role: 'region', 'aria-label': 'Add elements panel' },
  });

  // Collapse/expand tab (always visible on the right edge).
  const tab = createEl(doc, 'button', {
    className: cls('palette-tab'),
    attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-label': 'Toggle elements panel' },
    text: 'Elements',
  });
  tab.addEventListener('click', () => setCollapsed(!collapsed));

  const inner = createEl(doc, 'div', { className: cls('palette-inner') });
  const title = createEl(doc, 'div', { className: cls('palette-title'), text: 'Add elements' });
  inner.appendChild(title);

  for (const category of ELEMENT_CATEGORIES) {
    const section = createEl(doc, 'div', { className: cls('palette-section') });
    section.appendChild(createEl(doc, 'div', { className: cls('palette-section-title'), text: category.name }));
    const grid = createEl(doc, 'div', { className: cls('palette-grid') });
    for (const { tag, label } of category.items) {
      const item = createEl(doc, 'button', {
        className: cls('palette-item'),
        attrs: { type: 'button', [ATTR_IGNORE]: '', title: `<${tag}>` },
        text: label,
      });
      item.addEventListener('click', () => insert(tag));
      grid.appendChild(item);
    }
    section.appendChild(grid);
    inner.appendChild(section);
  }

  panel.appendChild(tab);
  panel.appendChild(inner);
  state.editorRoot.appendChild(panel);

  let collapsed = true;
  function setCollapsed(next) {
    collapsed = next;
    panel.classList.toggle(cls('palette-collapsed'), collapsed);
    // Shift the main toolbar clear of the open panel (see editor.css).
    state.editorRoot.classList.toggle(cls('palette-open'), !collapsed);
    tab.setAttribute('aria-expanded', String(!collapsed));
  }
  setCollapsed(true);

  function insert(tag) {
    const placement = resolvePlacement(state);
    if (!placement) return;
    const node = createDefaultElement(doc, tag);
    addElement(state, placement.parentPath, placement.index, node);
    const parentEl = fromPath(placement.parentPath, state.root);
    const inserted = parentEl && getEditableChildren(parentEl)[placement.index];
    if (inserted) {
      modeController.selectElement(state, inserted);
      if (tag === 'img' && hooks.onImageInserted) hooks.onImageInserted(inserted);
    }
  }

  return {
    el: panel,
    open: () => setCollapsed(false),
    close: () => setCollapsed(true),
    toggle: () => setCollapsed(!collapsed),
    isOpen: () => !collapsed,
  };
}
