import { fromPath, getEditableChildren, toPath } from '../core/element-path.js';
import { registerHandler, addChange } from '../core/history.js';

export function nodeFromOuterHTML(outerHTML, doc) {
  const template = doc.createElement('template');
  template.innerHTML = outerHTML.trim();
  return template.content.firstElementChild;
}

/**
 * Inserts a node as the `index`-th editable child of the element at parentPath.
 */
export function insertAtPath(root, doc, parentPath, index, node) {
  const parent = fromPath(parentPath, root);
  if (!parent) throw new Error('insertAtPath: parent not found for path ' + JSON.stringify(parentPath));
  const siblings = getEditableChildren(parent);
  const refNode = siblings[index] || null;
  parent.insertBefore(node, refNode);
  return node;
}

/**
 * Removes and returns the editable child at index under parentPath.
 */
export function removeAtPath(root, parentPath, index) {
  const parent = fromPath(parentPath, root);
  if (!parent) throw new Error('removeAtPath: parent not found for path ' + JSON.stringify(parentPath));
  const siblings = getEditableChildren(parent);
  const node = siblings[index];
  if (!node) throw new Error('removeAtPath: no element at index ' + index);
  node.remove();
  return node;
}

/**
 * Moves the LIVE editable node at (fromParentPath, fromIndex) so it becomes the
 * (toIndex)-th editable child of the element at toParentPath. Unlike
 * remove-element + add-element (which re-parse from outerHTML and thus mint a
 * brand-new node), this relocates the exact same DOM node — so a live selection
 * reference held by a panel/overlay stays valid across the move, and across
 * undo/redo of it. Indices are resolved live AFTER the node is detached, mirroring
 * insertAtPath's ref-node semantics.
 */
export function reparentByPath(root, fromParentPath, fromIndex, toParentPath, toIndex) {
  const fromParent = fromPath(fromParentPath, root);
  if (!fromParent) throw new Error('reparentByPath: from-parent not found for path ' + JSON.stringify(fromParentPath));
  const node = getEditableChildren(fromParent)[fromIndex];
  if (!node) throw new Error('reparentByPath: no element at from-index ' + fromIndex);
  node.remove();
  const toParent = fromPath(toParentPath, root);
  if (!toParent) throw new Error('reparentByPath: to-parent not found for path ' + JSON.stringify(toParentPath));
  const siblings = getEditableChildren(toParent);
  const refNode = siblings[toIndex] || null;
  toParent.insertBefore(node, refNode);
  return node;
}

registerHandler('move-element', {
  forward(state, entry) {
    reparentByPath(state.root, entry.fromParentPath, entry.fromIndex, entry.toParentPath, entry.toIndex);
  },
  inverse(state, entry) {
    // On inverse the node currently sits at (toParentPath, toIndex); send it home.
    reparentByPath(state.root, entry.toParentPath, entry.toIndex, entry.fromParentPath, entry.fromIndex);
  },
});

registerHandler('remove-element', {
  forward(state, entry) {
    removeAtPath(state.root, entry.parentPath, entry.index);
  },
  inverse(state, entry) {
    const node = nodeFromOuterHTML(entry.outerHTML, state.root.ownerDocument);
    insertAtPath(state.root, state.root.ownerDocument, entry.parentPath, entry.index, node);
  },
});

registerHandler('add-element', {
  forward(state, entry) {
    const node = nodeFromOuterHTML(entry.outerHTML, state.root.ownerDocument);
    insertAtPath(state.root, state.root.ownerDocument, entry.parentPath, entry.index, node);
  },
  inverse(state, entry) {
    removeAtPath(state.root, entry.parentPath, entry.index);
  },
});

/**
 * Builds and applies a remove-element change for `el`, capturing enough info to undo it.
 */
export function removeElement(state, el) {
  const parent = el.parentElement;
  const parentPath = toPath(parent, state.root);
  if (parentPath === null) return;
  const siblings = getEditableChildren(parent);
  const index = siblings.indexOf(el);
  addChange(state, {
    type: 'remove-element',
    parentPath,
    index,
    tagName: el.tagName.toLowerCase(),
    outerHTML: el.outerHTML,
  });
}

/**
 * Builds and applies an add-element change inserting `node` at (parentPath, index).
 */
export function addElement(state, parentPath, index, node) {
  addChange(state, {
    type: 'add-element',
    parentPath,
    index,
    tagName: node.tagName.toLowerCase(),
    outerHTML: node.outerHTML,
  });
}

/**
 * Removes multiple elements (multi-select delete) as ONE undoable batch.
 *
 * Two correctness subtleties, worth spelling out:
 *  1. Descendant filtering — if both a container and one of its own children
 *     are selected, removing the container already removes the child; trying
 *     to independently remove the (now-detached) child afterward would throw
 *     inside removeAtPath (its parentPath no longer resolves), which — since
 *     it'd happen mid-batch, before the entry is recorded — would leave some
 *     elements removed from the DOM with NO history entry to undo them. So we
 *     drop any selected element that has another selected element as an
 *     ancestor before building the batch.
 *  2. Ordering — batch.forward() runs children in array order, and each
 *     remove-element re-resolves siblings live (it doesn't work off a single
 *     upfront snapshot). Removing two siblings under the same parent in
 *     ascending-index order would shift the second one's index out from under
 *     it. Sorting descending by index removes the highest position first, so
 *     earlier positions are never disturbed. Because batch.inverse() replays
 *     children in REVERSE order, undo naturally reinserts in ascending order —
 *     which is exactly the order that correctly rebuilds the original layout.
 */
export function removeElements(state, elements) {
  const targets = elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));

  const children = [];
  for (const el of targets) {
    const parent = el.parentElement;
    const parentPath = toPath(parent, state.root);
    if (parentPath === null) continue;
    const index = getEditableChildren(parent).indexOf(el);
    children.push({ type: 'remove-element', parentPath, index, tagName: el.tagName.toLowerCase(), outerHTML: el.outerHTML });
  }
  if (!children.length) return;
  children.sort((a, b) => b.index - a.index);
  addChange(state, { type: 'batch', label: `delete ${children.length} elements`, children });
}
