import { cls, ATTR_IGNORE } from '../core/constants.js';

// Clockwise from top-left — order only matters for iteration, not behavior.
const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_SIZE = 8;

export function createSelectionOverlay(editorRoot, { enableMove = true } = {}) {
  const doc = editorRoot.ownerDocument;

  const hover = doc.createElement('div');
  hover.className = cls('outline-hover');
  hover.setAttribute(ATTR_IGNORE, '');
  hover.style.display = 'none';
  editorRoot.appendChild(hover);

  // Transparent drag surface laid over a single selected element so it can be
  // dragged to move (see move-controller.js). Kept below the resize handles in
  // the stacking order so edge/corner drags still resize; only the interior
  // moves. Never shown for multi-select (no single unambiguous move target).
  const moveSurface = doc.createElement('div');
  moveSurface.className = cls('move-surface');
  moveSurface.setAttribute(ATTR_IGNORE, '');
  moveSurface.style.display = 'none';
  editorRoot.appendChild(moveSurface);

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

  // Fixed set of 8 resize handles, only ever shown for a single-element
  // selection (resizing a multi-select doesn't have a well-defined target).
  const handles = HANDLE_DIRS.map((dir) => {
    const div = doc.createElement('div');
    div.className = `${cls('resize-handle')} ${cls('resize-handle-' + dir)}`;
    div.dataset.vveResizeDir = dir;
    div.setAttribute(ATTR_IGNORE, '');
    div.style.display = 'none';
    editorRoot.appendChild(div);
    return { el: div, dir };
  });

  function positionHandles(targetEl) {
    if (!targetEl || !targetEl.isConnected) {
      hideHandles();
      return;
    }
    const r = targetEl.getBoundingClientRect();
    const half = HANDLE_SIZE / 2;
    const at = {
      nw: [r.top, r.left],
      n: [r.top, r.left + r.width / 2],
      ne: [r.top, r.right],
      e: [r.top + r.height / 2, r.right],
      se: [r.bottom, r.right],
      s: [r.bottom, r.left + r.width / 2],
      sw: [r.bottom, r.left],
      w: [r.top + r.height / 2, r.left],
    };
    handles.forEach(({ el, dir }) => {
      const [top, left] = at[dir];
      el.style.display = 'block';
      el.style.top = `${top - half}px`;
      el.style.left = `${left - half}px`;
    });
  }

  function hideHandles() {
    handles.forEach(({ el }) => (el.style.display = 'none'));
  }

  function positionMoveSurface(targetEl) {
    // No surface for unmovable targets: the editable root itself (usually
    // <body>) or anything containing it (e.g. <html>). Reparenting those would
    // throw, and covering the whole page with a move surface over <body> hijacks
    // every click. Keeping the surface off lets normal selection work there.
    const root = editorRoot.ownerDocument.body;
    const unmovable = targetEl && (targetEl === root || (targetEl.contains && targetEl.contains(root)) || !targetEl.parentElement);
    if (!enableMove || !targetEl || !targetEl.isConnected || unmovable) {
      moveSurface.style.display = 'none';
      return;
    }
    const r = targetEl.getBoundingClientRect();
    moveSurface.style.display = 'block';
    moveSurface.style.top = `${r.top}px`;
    moveSurface.style.left = `${r.left}px`;
    moveSurface.style.width = `${r.width}px`;
    moveSurface.style.height = `${r.height}px`;
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
    // Resize handles + move surface only make sense for a single, unambiguous target.
    if (elements.length === 1 && elements[0].isConnected) {
      positionHandles(elements[0]);
      positionMoveSurface(elements[0]);
    } else {
      hideHandles();
      moveSurface.style.display = 'none';
    }
  }

  function hideSelected() {
    selectedPool.forEach((div) => (div.style.display = 'none'));
    hideHandles();
    moveSurface.style.display = 'none';
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
    handles,
    moveSurface,
    reposition(hoveredEl, selectedElements) {
      positionOverlay(hover, hoveredEl);
      showSelectedMany(selectedElements || []);
    },
    destroy() {
      hover.remove();
      selectedPool.forEach((d) => d.remove());
      handles.forEach(({ el }) => el.remove());
      moveSurface.remove();
    },
  };
}
