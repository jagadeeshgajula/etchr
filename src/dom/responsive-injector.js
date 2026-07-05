import { readInlineValue, describeStyleChanges } from './style-mutator.js';
import { describeStableSelector } from '../css/element-selector.js';
import { describeResponsiveUpsert } from '../css/css-mutator.js';

const BREAKPOINTS = [
  { name: 'tablet', mediaText: '(max-width: 768px)' },
  { name: 'mobile', mediaText: '(max-width: 480px)' },
];

/**
 * Builds the full set of "keep the layout from breaking" change descriptors
 * for a resize commit: same-viewport reflow fixes (plain inline styles, since
 * we're fixing the CURRENT viewport with live element references in hand) plus
 * cross-viewport @media breakpoint rules (since there's no way to simulate an
 * actual narrower viewport against the live host document, these use a
 * conservative width:100%+max-width cap that can only ever shrink the element
 * relative to its authored desktop size, so it's safe to apply unconditionally).
 * Returns descriptors to merge into the caller's own {type:'batch'}; does NOT
 * call addChange itself.
 */
export function describeResponsiveInjection(state, target, { widthChanged, widthPx, usedWestMargin }, config) {
  const children = [];
  const win = state.root.ownerDocument.defaultView;

  // (a) Same-viewport reflow.
  children.push(
    ...describeStyleChanges(state, target, [{ property: 'max-width', oldValue: readInlineValue(target, 'max-width'), newValue: '100%' }])
  );

  const parent = target.parentElement;
  let parentIsFlex = false;
  if (parent && parent !== state.editorRoot) {
    const parentDisplay = win.getComputedStyle(parent).display;
    parentIsFlex = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const overflowing = parent.scrollWidth > parent.clientWidth + 1;
    if (parentIsFlex && overflowing) {
      children.push(
        ...describeStyleChanges(state, parent, [{ property: 'flex-wrap', oldValue: readInlineValue(parent, 'flex-wrap'), newValue: 'wrap' }])
      );
    }
  }

  // (b) Cross-viewport breakpoints — width changes only. A fixed pixel height
  // doesn't need viewport-width-based adaptation, and skipping keeps generated
  // CSS from growing on every north/south-only drag.
  if (!widthChanged) return children;
  const enabledTiers = config.responsiveBreakpoints || [];
  if (!enabledTiers.length) return children;

  // Resolve each element's stable selector exactly ONCE per commit: its
  // set-attribute descriptor (if newly assigned) hasn't been applied to the
  // live DOM yet — addChange runs after this whole batch is assembled — so a
  // second lookup on the same element would see no class yet and mint another.
  const targetSel = describeStableSelector(state, target);
  if (!targetSel.selector) return children;
  if (targetSel.descriptor) children.push(targetSel.descriptor);

  let parentSel = null;
  if (parentIsFlex) {
    parentSel = describeStableSelector(state, parent);
    if (parentSel.descriptor) children.push(parentSel.descriptor);
  }

  const pendingInserts = new Map();
  for (const bp of BREAKPOINTS) {
    if (!enabledTiers.includes(bp.name)) continue;

    const decl = [
      { name: 'box-sizing', value: 'border-box' },
      { name: 'width', value: '100%' },
      { name: 'max-width', value: `${Math.round(widthPx)}px` },
    ];
    // The negative-margin "resize from the left" trick can introduce horizontal
    // scroll at very narrow widths — reset it at the narrowest tier only.
    if (bp.name === 'mobile' && usedWestMargin) {
      decl.push({ name: 'margin-left', value: '0' }, { name: 'margin-right', value: '0' });
    }
    children.push(...describeResponsiveUpsert(state, bp.mediaText, targetSel.selector, decl, pendingInserts));

    if (parentSel && parentSel.selector) {
      children.push(
        ...describeResponsiveUpsert(state, bp.mediaText, parentSel.selector, [{ name: 'flex-wrap', value: 'wrap' }], pendingInserts)
      );
    }
  }

  return children;
}
