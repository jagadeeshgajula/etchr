import { undo, redo } from '../core/history.js';
import { isEditingText } from './text-editor.js';

const NATIVE_TEXT_INPUTS = new Set(['input', 'textarea', 'select']);

/**
 * True while focus is somewhere that should keep its own native undo/redo
 * (a page contenteditable session mid-edit, or any of the editor's own form
 * controls — CSS selector/value boxes, the style-helper textarea, etc.).
 * Editor Ctrl+Z/Y must not steal keystrokes from either.
 */
function shouldYieldToNativeUndo(doc) {
  if (isEditingText()) return true;
  const active = doc.activeElement;
  if (!active) return false;
  if (active.isContentEditable) return true;
  return NATIVE_TEXT_INPUTS.has(active.tagName.toLowerCase());
}

/**
 * Installs editor undo/redo/save keybindings on the editable document.
 * `onSave` (Ctrl+S) always prevents the browser's native save-page dialog and
 * fires regardless of focus — unlike undo/redo, there's no native "save" a
 * form control would otherwise perform that we'd want to preserve.
 */
export function installKeyboardShortcuts(state, { onSave } = {}) {
  const doc = state.root.ownerDocument;

  doc.addEventListener('keydown', (e) => {
    if (!state.isEditModeEnabled) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();

    if (key === 's' && onSave) {
      e.preventDefault();
      onSave();
      return;
    }
    if (key !== 'z' && key !== 'y') return;
    if (shouldYieldToNativeUndo(doc)) return;

    e.preventDefault();
    if (key === 'z') {
      if (e.shiftKey) redo(state);
      else undo(state);
    } else {
      redo(state);
    }
  });
}
