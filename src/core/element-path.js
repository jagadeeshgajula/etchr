import { ATTR_IGNORE } from './constants.js';

function getEditableChildren(parent) {
  return Array.from(parent.children).filter((el) => !el.hasAttribute(ATTR_IGNORE) && !el.closest(`[${ATTR_IGNORE}]`));
}

export function toPath(el, root) {
  const path = [];
  let node = el;
  while (node && node !== root) {
    const parent = node.parentElement;
    if (!parent) return null;
    const siblings = getEditableChildren(parent);
    const index = siblings.indexOf(node);
    if (index === -1) return null;
    path.unshift(index);
    node = parent;
  }
  if (node !== root) return null;
  return path;
}

export function fromPath(path, root) {
  let node = root;
  for (const index of path) {
    const siblings = getEditableChildren(node);
    node = siblings[index];
    if (!node) return null;
  }
  return node;
}

/** Returns [root, ..., parent, el] — the ancestor chain from root down to el inclusive. */
export function getAncestorChain(el, root) {
  const chain = [];
  let node = el;
  while (node) {
    chain.unshift(node);
    if (node === root) break;
    node = node.parentElement;
  }
  return chain[0] === root ? chain : [];
}

export { getEditableChildren };
