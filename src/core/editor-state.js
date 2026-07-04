export function createEditorState({ root, editorRoot, config }) {
  return {
    root,
    editorRoot,
    config,
    isEditModeEnabled: false,
    selectedElements: [],
    hoveredElement: null,
    history: [],
    currentIndex: -1,
    editableStylesheet: null,
    stylesheetCache: {
      signature: 0,
      rulesByElementPath: new Map(),
    },
    listeners: new Set(),
  };
}

export function subscribe(state, fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function notify(state) {
  for (const fn of state.listeners) fn(state);
}
