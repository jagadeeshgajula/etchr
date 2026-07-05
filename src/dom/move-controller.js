import { previewStyle, readInlineValue } from './style-mutator.js';
import { addChange } from '../core/history.js';
import { toPath, getEditableChildren } from '../core/element-path.js';
import { ATTR_IGNORE } from '../core/constants.js';

// Min pointer travel (px) before a press on the move surface becomes a real
// drag. Below this it's treated as a plain click and forwarded to selection
// (so clicking a selected element can still pick a nested child), matching the
// resize-controller's "click without drag is a no-op" discipline.
const DRAG_THRESHOLD = 3;

// Inline props the promote-to-absolute gesture writes; captured up front (before
// any live preview mutates el.style) so undo restores the element exactly. Margin
// is captured/reset as individual longhands, not the `margin` shorthand: an
// element resized first (which sets margin-left/margin-top longhands) must have
// those exact longhands restored on undo — the shorthand would wipe them.
const MOVE_PROPS = ['position', 'left', 'top', 'width', 'height', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'box-sizing'];

function isEditorOwned(el) {
  return !!(el && el.closest(`[${ATTR_IGNORE}]`));
}

/**
 * Freeform "drag to move anywhere" for the single selected element. On the first
 * real drag it promotes the element to `position:absolute`, freezes its rendered
 * size, and reparents it to the document body so its left/top become true PAGE
 * coordinates — the PowerPoint-canvas model where an object floats above the flow
 * and can overlap anything. Follows resize-controller's preview-then-commit split:
 * every frame is a throwaway `previewStyle`, and pointerup reverts the preview and
 * records one undoable `batch` (a `move-element` reparent + the `set-style`s).
 */
export function createMoveController(state, modeController, config) {
  const doc = state.root.ownerDocument;
  const win = doc.defaultView;
  const root = state.root;
  const overlay = modeController.overlay;
  const surface = overlay.moveSurface;
  let drag = null;

  function onDown(e) {
    if (e.button !== 0) return; // left-drag only; right-click opens the layer menu
    if (!state.isEditModeEnabled || state.selectedElements.length !== 1) return;
    const target = state.selectedElements[0];
    // Guard unmovable targets: the root (usually <body>), anything that CONTAINS
    // the root (e.g. <html>), or a detached node with no parent. Reparenting any
    // of these under root throws HierarchyRequestError ("new child contains the
    // parent"), so we simply don't start a move — a plain click still selects.
    if (!target.isConnected || !target.parentElement || target === root || target.contains(root)) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = target.getBoundingClientRect();
    drag = {
      target,
      startX: e.clientX,
      startY: e.clientY,
      // Viewport-space top-left of the element at gesture start — the visual
      // position we must preserve exactly through promotion + reparenting.
      viewLeft: rect.left,
      viewTop: rect.top,
      frozenWidth: rect.width,
      frozenHeight: rect.height,
      // Exact original DOM slot, for a precise revert before the clean commit.
      origParent: target.parentElement,
      origNextSibling: target.nextSibling,
      // Old inline values, captured BEFORE any preview mutation (mirrors resize).
      oldInline: Object.fromEntries(MOVE_PROPS.map((p) => [p, readInlineValue(target, p)])),
      // Placed offset (added to viewLeft/Top each frame) — resolved in promote()
      // so the element lands pixel-exact regardless of its containing block.
      baseLeft: 0,
      baseTop: 0,
      lastLeft: 0,
      lastTop: 0,
      moved: false,
      promoted: false,
      prevCursor: doc.body.style.cursor,
      prevUserSelect: doc.body.style.userSelect,
      shiftKey: e.shiftKey,
    };
    try { surface.setPointerCapture(e.pointerId); } catch { /* not all pointers capturable */ }
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', onUp);
  }

  function promote() {
    const t = drag.target;
    // Freeze the rendered box so pulling it out of normal flow doesn't collapse it.
    previewStyle(t, 'box-sizing', 'border-box');
    previewStyle(t, 'width', `${drag.frozenWidth}px`);
    previewStyle(t, 'height', `${drag.frozenHeight}px`);
    previewStyle(t, 'margin-top', '0px');
    previewStyle(t, 'margin-right', '0px');
    previewStyle(t, 'margin-bottom', '0px');
    previewStyle(t, 'margin-left', '0px');
    previewStyle(t, 'position', 'absolute');
    // Reparent to <body> so the element floats above the flow and can overlap
    // anything. Skip when it's already a direct root child (avoids a gratuitous
    // reorder — layering commands own restacking).
    if (drag.origParent !== root) root.appendChild(t);
    // Now measure-and-correct: an absolutely-positioned element is placed
    // relative to its containing block's PADDING box, which — when <body> is
    // centered (margin:auto) or itself positioned — is NOT the viewport origin.
    // Set a provisional left/top, read where the element actually landed, and
    // offset by the delta so its viewport position matches where it was grabbed.
    // This is what keeps placement pixel-exact instead of drifting sideways.
    previewStyle(t, 'left', '0px');
    previewStyle(t, 'top', '0px');
    const at0 = t.getBoundingClientRect();
    drag.baseLeft = drag.viewLeft - at0.left; // containing-block origin in viewport space
    drag.baseTop = drag.viewTop - at0.top;
    previewStyle(t, 'left', `${drag.baseLeft}px`);
    previewStyle(t, 'top', `${drag.baseTop}px`);
    drag.promoted = true;
  }

  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      promote();
      doc.body.style.cursor = 'move';
      doc.body.style.userSelect = 'none';
    }
    drag.lastLeft = drag.baseLeft + dx;
    drag.lastTop = drag.baseTop + dy;
    previewStyle(drag.target, 'left', `${drag.lastLeft}px`);
    previewStyle(drag.target, 'top', `${drag.lastTop}px`);
    // Re-glue the outline + handles + surface to the live rect every frame.
    overlay.showSelectedMany(state.selectedElements);
  }

  function onUp(e) {
    win.removeEventListener('pointermove', onMove);
    win.removeEventListener('pointerup', onUp);
    try { surface.releasePointerCapture(e.pointerId); } catch { /* was never captured */ }
    const active = drag;
    drag = null;

    if (!active.moved) {
      // Plain click on the surface — forward to selection so a nested child can
      // still be picked. elementFromPoint needs the surface out of the way.
      forwardClick(active, e);
      return;
    }

    doc.body.style.cursor = active.prevCursor;
    doc.body.style.userSelect = active.prevUserSelect;

    const { target } = active;

    // Fully revert the live preview FIRST — styles back to captured originals,
    // node back to its exact original slot — so the batch below is the single
    // source of truth (batch.forward re-applies everything from a clean base).
    // Paths must be read AFTER this revert, from the element's real home.
    for (const p of MOVE_PROPS) {
      const v = active.oldInline[p];
      if (v == null) target.style.removeProperty(p);
      else target.style.setProperty(p, v);
    }
    if (active.origParent !== root) active.origParent.insertBefore(target, active.origNextSibling);

    const oldPath = toPath(target, root); // original location, post-revert
    const children = [];
    let newPath = oldPath;
    if (active.origParent !== root) {
      const oldParentPath = oldPath.slice(0, -1);
      const oldIndex = oldPath[oldPath.length - 1];
      const toIndex = getEditableChildren(root).length; // append (element is not a body child post-revert)
      children.push({ type: 'move-element', fromParentPath: oldParentPath, fromIndex: oldIndex, toParentPath: [], toIndex });
      newPath = [toIndex];
    }

    const entries = [
      { property: 'box-sizing', oldValue: active.oldInline['box-sizing'], newValue: 'border-box' },
      { property: 'width', oldValue: active.oldInline['width'], newValue: `${active.frozenWidth}px` },
      { property: 'height', oldValue: active.oldInline['height'], newValue: `${active.frozenHeight}px` },
      // Zero each margin longhand individually — mirrors promote()'s `margin:0`
      // while restoring cleanly to whatever longhands a prior resize had set.
      { property: 'margin-top', oldValue: active.oldInline['margin-top'], newValue: '0px' },
      { property: 'margin-right', oldValue: active.oldInline['margin-right'], newValue: '0px' },
      { property: 'margin-bottom', oldValue: active.oldInline['margin-bottom'], newValue: '0px' },
      { property: 'margin-left', oldValue: active.oldInline['margin-left'], newValue: '0px' },
      { property: 'position', oldValue: active.oldInline['position'], newValue: 'absolute' },
      { property: 'left', oldValue: active.oldInline['left'], newValue: `${active.lastLeft}px` },
      { property: 'top', oldValue: active.oldInline['top'], newValue: `${active.lastTop}px` },
    ];
    // describeStyleChanges resolves the path itself; but it reads it live from the
    // element's CURRENT location (pre-move). We need the POST-move path so the
    // children replay after move-element. Build the set-style descriptors directly.
    for (const { property, oldValue, newValue } of entries) {
      const normOld = oldValue === '' ? null : oldValue;
      const normNew = newValue === '' || newValue == null ? null : newValue;
      if (normOld === normNew) continue;
      children.push({ type: 'set-style', elementPath: newPath, property, oldValue: normOld, newValue: normNew });
    }

    if (children.length) addChange(state, { type: 'batch', label: 'move', children });
    overlay.showSelectedMany(state.selectedElements);
  }

  // On a no-drag click, replicate mode-controller's selection using the element
  // physically under the pointer (the surface has intercepted the real target).
  function forwardClick(active, e) {
    surface.style.display = 'none';
    const under = doc.elementFromPoint(e.clientX, e.clientY);
    surface.style.display = 'block';
    if (!under || isEditorOwned(under)) return;
    if (active.shiftKey) modeController.toggleSelectElement(state, under);
    else modeController.selectElement(state, under);
  }

  const downHandler = (e) => onDown(e);
  surface.addEventListener('pointerdown', downHandler);

  return {
    destroy() {
      surface.removeEventListener('pointerdown', downHandler);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
    },
  };
}
