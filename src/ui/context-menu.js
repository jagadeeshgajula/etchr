import { cls, ATTR_IGNORE } from '../core/constants.js';
import { createEl } from './dom-helpers.js';
import { applyLayer } from '../dom/layer-mutator.js';

const ITEMS = [
  { label: 'Bring to Front', direction: 'front' },
  { label: 'Bring Forward', direction: 'forward' },
  { label: 'Send Backward', direction: 'backward' },
  { label: 'Send to Back', direction: 'back' },
];

function isEditorOwned(el) {
  return !!(el && el.closest(`[${ATTR_IGNORE}]`));
}

/**
 * Right-click layering menu (PowerPoint's "Bring to Front / Send to Back" family).
 * Right-clicking an element selects it and opens the menu at the cursor; each
 * item runs an undoable z-index change via layer-mutator. Right-clicks that land
 * on the move surface (which sits over the selected element) are treated as a
 * right-click on that element rather than swallowed as editor chrome.
 */
export function createContextMenu(state, modeController) {
  const doc = state.editorRoot.ownerDocument;
  const win = doc.defaultView;
  const overlay = modeController.overlay;

  const menu = createEl(doc, 'div', {
    className: cls('context-menu'),
    attrs: { [ATTR_IGNORE]: '', role: 'menu', 'aria-label': 'Layering' },
  });
  menu.style.display = 'none';

  ITEMS.forEach(({ label, direction }) => {
    const item = createEl(doc, 'button', {
      className: cls('context-menu-item'),
      attrs: { type: 'button', role: 'menuitem', [ATTR_IGNORE]: '' },
      text: label,
    });
    item.addEventListener('click', () => {
      const el = state.selectedElements[0];
      if (el && el.isConnected) applyLayer(state, el, direction);
      close();
    });
    menu.appendChild(item);
  });

  state.editorRoot.appendChild(menu);

  let open = false;

  function openAt(x, y) {
    menu.style.display = 'block';
    open = true;
    // Clamp to the viewport so the menu never spills off-screen.
    const r = menu.getBoundingClientRect();
    const left = Math.min(x, win.innerWidth - r.width - 4);
    const top = Math.min(y, win.innerHeight - r.height - 4);
    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top = `${Math.max(4, top)}px`;
  }

  function close() {
    if (!open) return;
    menu.style.display = 'none';
    open = false;
  }

  function onContextMenu(e) {
    if (!state.isEditModeEnabled) return;
    const onMoveSurface = e.target === overlay.moveSurface;
    // Ignore right-clicks on editor chrome — except the move surface, which is a
    // proxy for the selected element beneath it.
    if (isEditorOwned(e.target) && !onMoveSurface) return;
    const el = onMoveSurface ? state.selectedElements[0] : e.target;
    if (!el) return;
    e.preventDefault();
    if (!state.selectedElements.includes(el)) modeController.selectElement(state, el);
    // Show after selection so the menu reflects the just-selected element.
    openAt(e.clientX, e.clientY);
  }

  // A left/right click anywhere outside the menu dismisses it. Menu-item clicks
  // stopPropagation via close() running first is unnecessary — the item handler
  // already closes, and this fires on the capture phase before the item's bubble
  // handler would re-open, so guard by target.
  function onDocPointerDown(e) {
    if (open && !menu.contains(e.target)) close();
  }
  function onScrollOrResize() { close(); }
  function onKeyDown(e) {
    // Consume Escape while open so index.js's Escape chain (close panel → close
    // palette → clear selection) doesn't also fire on the same press.
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
  }

  doc.addEventListener('contextmenu', onContextMenu, true);
  doc.addEventListener('pointerdown', onDocPointerDown, true);
  win.addEventListener('scroll', onScrollOrResize, true);
  win.addEventListener('resize', onScrollOrResize);
  doc.addEventListener('keydown', onKeyDown, true);

  return {
    close,
    isOpen: () => open,
    destroy() {
      doc.removeEventListener('contextmenu', onContextMenu, true);
      doc.removeEventListener('pointerdown', onDocPointerDown, true);
      win.removeEventListener('scroll', onScrollOrResize, true);
      win.removeEventListener('resize', onScrollOrResize);
      doc.removeEventListener('keydown', onKeyDown, true);
      menu.remove();
    },
  };
}
