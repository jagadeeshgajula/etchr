import { cls, ATTR_IGNORE } from '../core/constants.js';

export function createSelectionOverlay(editorRoot) {
  const doc = editorRoot.ownerDocument;

  const hover = doc.createElement('div');
  hover.className = cls('outline-hover');
  hover.setAttribute(ATTR_IGNORE, '');
  hover.style.display = 'none';
  editorRoot.appendChild(hover);

  // Pool of reusable outline divs for multi-select — grown on demand, never
  // shrunk (excess divs are just hidden), so repeated selection changes don't
  // churn the DOM.
  const selectedPool = [];

  function ensurePoolSize(count) {
    while (selectedPool.length < count) {
      const div = doc.createElement('div');
      div.className = cls('outline-selected');
      div.setAttribute(ATTR_IGNORE, '');
      div.style.display = 'none';
      editorRoot.appendChild(div);
      selectedPool.push(div);
    }
  }

  function positionOverlay(overlayEl, targetEl) {
    if (!targetEl || !targetEl.isConnected) {
      overlayEl.style.display = 'none';
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    overlayEl.style.display = 'block';
    overlayEl.style.top = `${rect.top}px`;
    overlayEl.style.left = `${rect.left}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;
  }

  function showSelectedMany(elements) {
    ensurePoolSize(elements.length);
    selectedPool.forEach((div, i) => {
      if (i < elements.length) positionOverlay(div, elements[i]);
      else div.style.display = 'none';
    });
  }

  function hideSelected() {
    selectedPool.forEach((div) => (div.style.display = 'none'));
  }

  return {
    showHover(el) {
      positionOverlay(hover, el);
    },
    hideHover() {
      hover.style.display = 'none';
    },
    showSelectedMany,
    hideSelected,
    reposition(hoveredEl, selectedElements) {
      positionOverlay(hover, hoveredEl);
      showSelectedMany(selectedElements || []);
    },
    destroy() {
      hover.remove();
      selectedPool.forEach((d) => d.remove());
    },
  };
}
