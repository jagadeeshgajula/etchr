export const CLASS_PREFIX = 'vve-';

export const ROOT_ID = 'vve-root';

export const ATTR_IGNORE = 'data-vve-ignore';
export const ATTR_EDITING = 'data-vve-editing';
export const ATTR_CREATED_SHEET = 'data-vve-created-sheet';

// Query-string flag marking a page loaded inside the editor-modal iframe.
// Lives only in location.search, so saved HTML (keyed on pathname) stays clean.
export const EMBED_PARAM = '__etchr';

export const cls = (name) => `${CLASS_PREFIX}${name}`;
