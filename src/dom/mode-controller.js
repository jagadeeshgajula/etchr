import { ATTR_IGNORE, ATTR_EDITING } from '../core/constants.js';
import { notify, subscribe } from '../core/editor-state.js';
import { createSelectionOverlay } from './selection-overlay.js';

function isEditorOwned(el) {
  return !!(el && (el.closest(`[${ATTR_IGNORE}]`) || el.id === 'vve-root'));
}

export function createModeController(state) {
  const doc = state.root.ownerDocument;
  const win = doc.defaultView;
  const overlay = createSelectionOverlay(state.editorRoot, { enableMove: state.config.enableMove !== false });
  let attached = false;

  function onMouseOver(e) {
    const target = e.target;
    if (isEditorOwned(target)) return;
    state.hoveredElement = target;
    overlay.showHover(target);
  }

  function onMouseOut(e) {
    if (isEditorOwned(e.target)) return;
    state.hoveredElement = null;
    overlay.hideHover();
  }

  function onClick(e) {
    const target = e.target;
    if (isEditorOwned(target)) return;
    if (target.closest(`[${ATTR_EDITING}]`)) return; // let contenteditable handle its own clicks
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) toggleSelectElement(state, target);
    else selectElement(state, target);
  }

  function onScrollOrResize() {
    overlay.reposition(state.hoveredElement, state.selectedElements);
  }

  function selectElement(st, el) {
    st.selectedElements = [el];
    notify(st); // overlay sync happens in the subscribe() below, from a single source of truth
  }

  // Shift+click: add el to the selection, or remove it if already selected.
  function toggleSelectElement(st, el) {
    const idx = st.selectedElements.indexOf(el);
    st.selectedElements = idx === -1 ? [...st.selectedElements, el] : st.selectedElements.filter((x) => x !== el);
    notify(st);
  }

  function clearSelection(st) {
    st.selectedElements = [];
    notify(st);
  }

  // Keeps the selection outline(s) in sync with state.selectedElements no
  // matter WHY it changed — direct clicks, or history.js pruning a
  // stale/detached element after undo/redo (see history.js's
  // pruneStaleSelection). Without this, undoing the removal of a selected
  // element left the outline box floating over its old position until the
  // next scroll/resize.
  subscribe(state, () => {
    overlay.showSelectedMany(state.selectedElements.filter((el) => el.isConnected));
  });

  function enable() {
    if (attached) return;
    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    win.addEventListener('scroll', onScrollOrResize, true);
    win.addEventListener('resize', onScrollOrResize);
    attached = true;
    state.isEditModeEnabled = true;
    notify(state);
  }

  function disable() {
    if (!attached) return;
    doc.removeEventListener('mouseover', onMouseOver, true);
    doc.removeEventListener('mouseout', onMouseOut, true);
    doc.removeEventListener('click', onClick, true);
    win.removeEventListener('scroll', onScrollOrResize, true);
    win.removeEventListener('resize', onScrollOrResize);
    attached = false;
    state.isEditModeEnabled = false;
    state.hoveredElement = null;
    overlay.hideHover();
    clearSelection(state);
    notify(state);
  }

  function toggle() {
    if (attached) disable();
    else enable();
  }

  if (state.config.allowModeToggle !== false) {
    doc.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggle();
      }
    });
  }

  return { enable, disable, toggle, selectElement, toggleSelectElement, clearSelection, overlay, isEnabled: () => attached };
}
