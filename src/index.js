import { ROOT_ID, ATTR_IGNORE, EMBED_PARAM } from './core/constants.js';
import { createConfig } from './core/config.js';
import { createEditorState } from './core/editor-state.js';
import { createModeController } from './dom/mode-controller.js';
import { createResizeController } from './dom/resize-controller.js';
import { createMoveController } from './dom/move-controller.js';
import { installKeyboardShortcuts } from './dom/keyboard-shortcuts.js';
import { createContextMenu } from './ui/context-menu.js';
import { createMainToolbar } from './ui/main-toolbar.js';
import { createToolbar } from './ui/toolbar.js';
import { createStylePanel } from './ui/style-panel.js';
import { createCssPanel } from './ui/css-panel.js';
import { createQuickStylePanel } from './ui/quick-style-panel.js';
import { createElementsPalette } from './ui/elements-palette.js';
import { createImagePanel } from './ui/image-panel.js';
import { createBreadcrumbBar } from './ui/breadcrumb-bar.js';
import { createToastHost } from './ui/toast.js';
import { createLauncher } from './ui/launcher.js';
import { openEditorModal } from './ui/editor-modal.js';
import { button } from './ui/dom-helpers.js';
import { subscribe } from './core/editor-state.js';
import { saveNow } from './save/save-client.js';
import { getCleanHTML } from './serialize/html-serializer.js';
import { isEditingText } from './dom/text-editor.js';
import * as history from './core/history.js';

let instance = null;

function ensureEditorRoot(doc) {
  let root = doc.getElementById(ROOT_ID);
  if (!root) {
    root = doc.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute(ATTR_IGNORE, '');
    doc.body.appendChild(root);
  }
  return root;
}

function init(options = {}) {
  if (instance) return instance;

  const doc = options.document || document;
  const root = doc.body;
  const editorRoot = ensureEditorRoot(doc);
  const config = createConfig(options);
  const state = createEditorState({ root, editorRoot, config });

  const modeController = createModeController(state);
  const resizeController = config.enableResize !== false
    ? createResizeController(state, modeController.overlay, config)
    : null;
  const moveController = config.enableMove !== false
    ? createMoveController(state, modeController, config)
    : null;
  const contextMenu = config.enableLayering !== false
    ? createContextMenu(state, modeController)
    : null;
  const toast = createToastHost(editorRoot);

  // Running inside the editor-modal iframe? The host set an expando bridge on
  // our <iframe> element before assigning src (see ui/editor-modal.js).
  const win = doc.defaultView;
  const bridge = (config.embedded && win && win.frameElement && win.frameElement.__etchrBridge) || null;

  const confirmBeforeSave = config.confirmBeforeSave !== undefined ? config.confirmBeforeSave : !config.onSave;
  const doSave = async () => {
    const ok = await saveNow(state, toast, { confirmOverwrite: confirmBeforeSave });
    if (ok && bridge) bridge.notifySaved();
    return ok;
  };
  installKeyboardShortcuts(state, { onSave: doSave });
  const mainToolbar = createMainToolbar(state, modeController, {
    onSave: doSave,
    showModeToggle: config.allowModeToggle !== false,
    showSave: !config.embedded,
  });
  const toolbar = createToolbar(state, modeController);
  const stylePanel = createStylePanel(state);
  const cssPanel = createCssPanel(state);
  const quickPanel = createQuickStylePanel(state);
  const imagePanel = createImagePanel(state);
  const breadcrumbBar = createBreadcrumbBar(state, modeController);
  const palette = createElementsPalette(state, modeController, {
    // When an image is dropped in, immediately open the image panel so the user
    // can set its source right away.
    onImageInserted: () => imagePanel.show(),
  });

  // Helper: only one styling panel open at a time keeps the canvas uncluttered.
  const stylingPanels = [stylePanel, cssPanel, quickPanel, imagePanel];
  const openOnly = (target) => {
    for (const p of stylingPanels) if (p !== target) p.hide();
    if (target.isOpen()) target.hide();
    else target.show();
  };

  // Per-element toolbar "Style ✨" button — the easy, describe-in-words panel.
  // Works for both single and multi-select (see quick-style-panel.js).
  toolbar.appendButton(button(doc, 'Style ✨', () => openOnly(quickPanel)));

  // Per-element toolbar "Font" button toggles the style panel. Also supports
  // multi-select batch-editing (see style-panel.js).
  toolbar.appendButton(button(doc, 'Font', () => openOnly(stylePanel)));

  // Per-element toolbar "CSS" button — only meaningful for a single element
  // (a stylesheet rule matches by selector, not by "which elements are selected").
  const cssBtn = button(doc, 'CSS', () => openOnly(cssPanel));
  toolbar.appendButton(cssBtn);

  // Per-element toolbar "Image" button — only meaningful when exactly one <img> is selected.
  const imageBtn = button(doc, 'Image', () => openOnly(imagePanel));
  imageBtn.style.display = 'none';
  toolbar.appendButton(imageBtn);
  subscribe(state, () => {
    const single = !toolbar.isMultiSelect();
    cssBtn.style.display = single ? '' : 'none';
    imageBtn.style.display = single && imagePanel.isImageSelected() ? '' : 'none';
    // If the selection just became multi/changed away from an img, close
    // whichever single-element panel no longer applies.
    if (!single) {
      if (cssPanel.isOpen()) cssPanel.hide();
      if (imagePanel.isOpen() && !imagePanel.isImageSelected()) imagePanel.hide();
    }
  });

  // Main-toolbar "Add" button opens the elements palette.
  const addBtn = button(doc, 'Add', () => palette.toggle());
  mainToolbar.appendButton(addBtn);

  // Escape closes whichever floating UI is open, in priority order, before
  // falling back to clearing the selection — never more than one thing per
  // press. In embedded mode, an Escape with nothing left to dismiss asks the
  // host modal to close.
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !state.isEditModeEnabled) return;
    const openPanel = stylingPanels.find((p) => p.isOpen());
    if (openPanel) {
      openPanel.hide();
    } else if (palette.isOpen()) {
      palette.close();
    } else if (state.selectedElements.length) {
      modeController.clearSelection(state);
    } else if (bridge) {
      bridge.requestClose();
    }
  });

  // Keep the host modal's Save button in sync with whether there is anything
  // to save (dirty tracking lives in state.savedIndex vs state.currentIndex).
  if (bridge) subscribe(state, () => bridge.notifyDirty(isDirty()));

  if (config.startInEditMode) modeController.enable();

  instance = {
    state,
    modeController,
    resizeController,
    moveController,
    contextMenu,
    mainToolbar,
    toolbar,
    stylePanel,
    cssPanel,
    quickPanel,
    imagePanel,
    palette,
    breadcrumbBar,
    undo: () => history.undo(state),
    redo: () => history.redo(state),
    save: doSave,
    getCleanHTML: () => getCleanHTML(doc),
    getState: () => state,
    destroy() {
      modeController.disable();
      if (resizeController) resizeController.destroy();
      if (moveController) moveController.destroy();
      if (contextMenu) contextMenu.destroy();
      editorRoot.remove();
      instance = null;
    },
  };
  return instance;
}

function getState() {
  return instance ? instance.state : null;
}

function getInstance() {
  return instance;
}

// True when there are edits the user hasn't saved. An open contenteditable
// session counts as dirty even before it commits — conservative, but closing
// mid-edit should always warn.
function isDirty() {
  if (!instance) return false;
  const s = instance.state;
  return s.currentIndex !== s.savedIndex || isEditingText();
}

// ---- Host-page launcher (pencil button) + editor modal ----

let launcher = null;

// Opens the editor modal: the current page reloaded in a same-origin iframe
// with the embed flag, where auto-init boots the editor in embedded mode.
function openEditor() {
  const editorRoot = ensureEditorRoot(document);
  const url = new URL(document.defaultView.location.href);
  url.searchParams.set(EMBED_PARAM, '1');
  if (launcher) launcher.setOpen(true);
  return openEditorModal(editorRoot, {
    url: url.toString(),
    onFullyClosed: () => { if (launcher) launcher.setOpen(false); },
  });
}

function mountLauncher() {
  if (launcher) return launcher;
  launcher = createLauncher(ensureEditorRoot(document), { onOpen: openEditor });
  return launcher;
}

// Capture the embedding <script> synchronously: document.currentScript is only
// valid during initial execution, and becomes null inside a deferred callback.
const embeddingScript = typeof document !== 'undefined' ? document.currentScript : null;

function autoInit() {
  const script = embeddingScript;
  if (script && script.dataset.autoInit === 'false') return;
  // data-mode: 'launcher' (default) shows only the pencil button and edits in
  // a modal; 'inline' is the pre-modal behavior (editor directly on the page);
  // 'off' disables auto-init entirely (same as data-auto-init="false").
  const mode = (script && script.dataset.mode) || 'launcher';
  if (mode === 'off') return;
  const options = {};
  if (script && script.dataset.saveEndpoint) options.saveEndpoint = script.dataset.saveEndpoint;

  const isEmbedded = new URLSearchParams(window.location.search).has(EMBED_PARAM);
  if (isEmbedded) {
    init({
      ...options,
      embedded: true,
      startInEditMode: true,
      paletteSide: 'left',
      confirmBeforeSave: false, // the host's Save click is already deliberate
      allowModeToggle: false, // "edit mode off inside the modal" is a dead state
    });
  } else if (mode === 'inline') {
    init(options);
  } else {
    mountLauncher();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
}

export { init, getState, getInstance, isDirty, openEditor };
