import { notify } from './editor-state.js';

const handlers = new Map();

let nextId = 1;

/**
 * Registers the {forward, inverse} DOM-mutation pair for a change type.
 * This is the only way feature modules may cause a mutation that participates in undo/redo.
 */
export function registerHandler(type, { forward, inverse }) {
  handlers.set(type, { forward, inverse });
}

function getHandler(type) {
  const handler = handlers.get(type);
  if (!handler) throw new Error(`No history handler registered for change type "${type}"`);
  return handler;
}

/**
 * Structural changes (add/remove-element, and any batch that may contain them)
 * can detach the exact DOM node a selection panel is holding onto, or replace it
 * with a freshly-parsed node on redo. Rather than track per-selection paths,
 * we drop any selected element that's no longer connected after a mutation —
 * cheap, and guarantees no panel is ever left anchored to an orphaned node.
 */
function pruneStaleSelection(state) {
  const before = state.selectedElements.length;
  state.selectedElements = state.selectedElements.filter((el) => el.isConnected);
  return state.selectedElements.length !== before;
}

/**
 * Applies a new change: runs its forward mutation, truncates any redo tail, and records it.
 */
export function addChange(state, change) {
  const entry = { ...change, id: nextId++, timestamp: Date.now() };
  const handler = getHandler(entry.type);
  handler.forward(state, entry);
  state.history.splice(state.currentIndex + 1);
  state.history.push(entry);
  state.currentIndex = state.history.length - 1;
  pruneStaleSelection(state);
  notify(state);
  return entry;
}

// A batch groups several child change descriptors so they undo/redo as one unit.
// Children are plain descriptors ({type, ...}) dispatched through their own handlers.
registerHandler('batch', {
  forward(state, entry) {
    for (const child of entry.children) getHandler(child.type).forward(state, child);
  },
  inverse(state, entry) {
    for (let i = entry.children.length - 1; i >= 0; i--) {
      getHandler(entry.children[i].type).inverse(state, entry.children[i]);
    }
  },
});

export function canUndo(state) {
  return state.currentIndex >= 0;
}

export function canRedo(state) {
  return state.currentIndex < state.history.length - 1;
}

export function undo(state) {
  if (!canUndo(state)) return;
  const entry = state.history[state.currentIndex];
  const handler = getHandler(entry.type);
  handler.inverse(state, entry);
  state.currentIndex--;
  pruneStaleSelection(state);
  notify(state);
}

export function redo(state) {
  if (!canRedo(state)) return;
  state.currentIndex++;
  const entry = state.history[state.currentIndex];
  const handler = getHandler(entry.type);
  handler.forward(state, entry);
  // redo of add-element inserts a brand-new parsed node, never the one the user
  // had selected before undo — so a stale reference is always dropped here too.
  pruneStaleSelection(state);
  notify(state);
}
