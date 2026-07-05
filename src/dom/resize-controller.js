import { previewStyle, readInlineValue, describeStyleChanges } from './style-mutator.js';
import { addChange } from '../core/history.js';
import { describeResponsiveInjection } from './responsive-injector.js';

function cursorFor(dir) {
  if (dir === 'nw' || dir === 'se') return 'nwse-resize';
  if (dir === 'ne' || dir === 'sw') return 'nesw-resize';
  if (dir === 'n' || dir === 's') return 'ns-resize';
  return 'ew-resize';
}

/**
 * Wires pointerdown/move/up on the selection overlay's 8 resize handles into
 * live width/height dragging, following the same preview-then-commit split as
 * style-panel.js's sliders (previewStyle every frame, one commit on release).
 */
export function createResizeController(state, overlay, config) {
  const doc = state.root.ownerDocument;
  const win = doc.defaultView;
  const MIN_SIZE = config.resizeMinSize || 24;
  let drag = null;

  function onHandleDown(e, dir) {
    if (!state.isEditModeEnabled || state.selectedElements.length !== 1) return;
    const target = state.selectedElements[0];
    e.preventDefault();
    e.stopPropagation();

    const computed = win.getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    const startMarginLeft = parseFloat(computed.marginLeft) || 0;
    const startMarginTop = parseFloat(computed.marginTop) || 0;
    drag = {
      dir,
      target,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startMarginLeft,
      startMarginTop,
      lastWidth: rect.width,
      lastHeight: rect.height,
      lastMarginLeft: startMarginLeft,
      lastMarginTop: startMarginTop,
      // Captured BEFORE any preview mutation — required for correct undo,
      // since previewStyle below will overwrite el.style as the drag proceeds.
      oldWidth: readInlineValue(target, 'width'),
      oldHeight: readInlineValue(target, 'height'),
      oldMarginLeft: readInlineValue(target, 'margin-left'),
      oldMarginTop: readInlineValue(target, 'margin-top'),
      oldBoxSizing: readInlineValue(target, 'box-sizing'),
      oldDisplay: readInlineValue(target, 'display'),
      startBoxSizing: computed.boxSizing,
      startDisplay: computed.display,
      normalized: false,
      prevCursor: doc.body.style.cursor,
      prevUserSelect: doc.body.style.userSelect,
    };
    doc.body.style.cursor = cursorFor(dir);
    doc.body.style.userSelect = 'none';
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', onUp);
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.normalized) {
      // Deferred to the first real move so a plain click-without-drag on a
      // handle stays a true no-op (nothing queued to commit on pointerup).
      if (drag.startBoxSizing !== 'border-box') previewStyle(drag.target, 'box-sizing', 'border-box');
      if (drag.startDisplay === 'inline') previewStyle(drag.target, 'display', 'inline-block');
      drag.normalized = true;
    }

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { dir } = drag;

    if (dir.includes('e')) drag.lastWidth = Math.max(MIN_SIZE, drag.startWidth + dx);
    if (dir.includes('w')) drag.lastWidth = Math.max(MIN_SIZE, drag.startWidth - dx);
    if (dir.includes('s')) drag.lastHeight = Math.max(MIN_SIZE, drag.startHeight + dy);
    if (dir.includes('n')) drag.lastHeight = Math.max(MIN_SIZE, drag.startHeight - dy);

    // Margin-compensation ("resize from that edge" simulation for elements in
    // normal document flow): derived from the CLAMPED size so it stays correct
    // even once MIN_SIZE has capped the raw drag distance.
    if (dir.includes('w')) drag.lastMarginLeft = drag.startMarginLeft + drag.startWidth - drag.lastWidth;
    if (dir.includes('n')) drag.lastMarginTop = drag.startMarginTop + drag.startHeight - drag.lastHeight;

    if (dir.includes('e') || dir.includes('w')) previewStyle(drag.target, 'width', `${drag.lastWidth}px`);
    if (dir.includes('n') || dir.includes('s')) previewStyle(drag.target, 'height', `${drag.lastHeight}px`);
    if (dir.includes('w')) previewStyle(drag.target, 'margin-left', `${drag.lastMarginLeft}px`);
    if (dir.includes('n')) previewStyle(drag.target, 'margin-top', `${drag.lastMarginTop}px`);

    // Re-glue the outline + handles to the live, changing rect every frame.
    overlay.showSelectedMany(state.selectedElements);
  }

  function onUp() {
    win.removeEventListener('pointermove', onMove);
    win.removeEventListener('pointerup', onUp);
    doc.body.style.cursor = drag.prevCursor;
    doc.body.style.userSelect = drag.prevUserSelect;

    if (!drag.normalized) {
      drag = null;
      return; // click without drag — nothing changed, nothing to commit
    }

    const { dir, target } = drag;
    const entries = [];
    const widthChanged = dir.includes('e') || dir.includes('w');
    const heightChanged = dir.includes('n') || dir.includes('s');
    if (widthChanged) entries.push({ property: 'width', oldValue: drag.oldWidth, newValue: `${drag.lastWidth}px` });
    if (heightChanged) entries.push({ property: 'height', oldValue: drag.oldHeight, newValue: `${drag.lastHeight}px` });
    if (dir.includes('w')) entries.push({ property: 'margin-left', oldValue: drag.oldMarginLeft, newValue: `${drag.lastMarginLeft}px` });
    if (dir.includes('n')) entries.push({ property: 'margin-top', oldValue: drag.oldMarginTop, newValue: `${drag.lastMarginTop}px` });
    if (drag.startBoxSizing !== 'border-box') entries.push({ property: 'box-sizing', oldValue: drag.oldBoxSizing, newValue: 'border-box' });
    if (drag.startDisplay === 'inline') entries.push({ property: 'display', oldValue: drag.oldDisplay, newValue: 'inline-block' });

    const children = describeStyleChanges(state, target, entries);

    if (config.autoResponsiveCss !== false) {
      children.push(
        ...describeResponsiveInjection(
          state,
          target,
          { widthChanged, widthPx: drag.lastWidth, usedWestMargin: dir.includes('w') },
          config
        )
      );
    }

    if (children.length) addChange(state, { type: 'batch', label: 'resize', children });
    // Snap overlay/handles to the committed (possibly no-op-reverted) values.
    overlay.showSelectedMany(state.selectedElements);
    drag = null;
  }

  const listeners = overlay.handles.map(({ el, dir }) => {
    const handler = (e) => onHandleDown(e, dir);
    el.addEventListener('pointerdown', handler);
    return { el, handler };
  });

  return {
    destroy() {
      listeners.forEach(({ el, handler }) => el.removeEventListener('pointerdown', handler));
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
    },
  };
}
