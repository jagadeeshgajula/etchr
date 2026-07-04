import { cls, ATTR_IGNORE } from '../core/constants.js';
import { subscribe } from '../core/editor-state.js';
import { createEl } from './dom-helpers.js';
import { getAncestorChain } from '../core/element-path.js';

function describeElement(el) {
  let label = el.tagName.toLowerCase();
  if (el.id) label += `#${el.id}`;
  else if (el.classList.length) label += `.${el.classList[0]}`;
  return label;
}

export function createBreadcrumbBar(state, modeController) {
  const doc = state.editorRoot.ownerDocument;

  const bar = createEl(doc, 'nav', {
    className: cls('breadcrumb'),
    attrs: { [ATTR_IGNORE]: '', 'aria-label': 'Selected element ancestry' },
  });
  bar.style.display = 'none';
  state.editorRoot.appendChild(bar);

  function render() {
    bar.innerHTML = '';
    const el = state.selectedElements[0];
    // Only meaningful for a single selection — a multi-select ancestry chain
    // would be ambiguous (which element's chain would we even show?).
    if (!el || state.selectedElements.length !== 1 || !el.isConnected) {
      bar.style.display = 'none';
      return;
    }
    const chain = getAncestorChain(el, state.root);
    if (chain.length <= 1) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    chain.forEach((node, i) => {
      if (i > 0) bar.appendChild(createEl(doc, 'span', { className: cls('crumb-sep'), text: '›' }));
      const isCurrent = node === el;
      const crumb = createEl(doc, 'button', {
        className: cls('crumb') + (isCurrent ? ' ' + cls('crumb-current') : ''),
        attrs: { type: 'button', [ATTR_IGNORE]: '', 'aria-current': isCurrent ? 'true' : 'false' },
        text: describeElement(node),
      });
      crumb.addEventListener('click', () => modeController.selectElement(state, node));
      bar.appendChild(crumb);
    });
  }

  subscribe(state, () => {
    if (!state.isEditModeEnabled) {
      bar.style.display = 'none';
      return;
    }
    render();
  });

  return { el: bar };
}
