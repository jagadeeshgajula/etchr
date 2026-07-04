### Prompt start

You are a senior front-end engineer. I want to build a **production-quality open-source  lightweight, embeddable JavaScript framework** that, when included in any website, allows the user to:

1. **Select any HTML element** on the page and:
   - Edit its text content.
   - Edit font-related properties (font-family, font-size, font-weight, line-height, letter-spacing, text-align, color, etc.) per element.
2. **Add new elements** (e.g., paragraphs, headings, divs, images) into the page.
3. **Remove elements**.
4. **Add and edit CSS rules** that affect the page:
   - Show all CSS rules that apply to the selected element (with specificity).
   - Allow editing any CSS property; changes should be **instantly visible** in the page.
5. **Undo/Redo** all changes.
6. **Save changes back to the same HTML file** on the server (overwriting the original file).

I want a **detailed implementation plan and code** for this framework, split into incremental milestones.

### Constraints & preferences

- Use **vanilla JavaScript** only (no React, no framework runtime).
- Target modern browsers; you may use:
  - `document.querySelector` / `querySelectorAll`
  - `MutationObserver`
  - `CSSStyleDeclaration`
  - `window.getComputedStyle`
  - `fetch` / `XMLHttpRequest`
- The framework should be embeddable via a single `<script>` tag and optionally a small CSS file.
- Assume there is a **save endpoint** on the same origin (e.g. `/save-page`) that accepts the updated HTML string and writes it back to the same file.

### Inspiration from existing projects

Take inspiration from these open-source projects (but do not copy code; just ideas and patterns):

- **VvvebJs** – vanilla JS page builder with:
  - Component/section drag-and-drop and in-page insert
  - Undo/Redo
  - Live code editor
  - Page save via PHP/Node endpoint (`save.php` / `save.js`)
  - Theme global typography and color palette editor
- **PlugNedit** – drag-and-drop HTML5 editor with:
  - Two-document architecture: canvas layer (page) + editor layer (UI)
  - CSS imported into editor for exact matching of styles
  - Server-side save of the HTML
- **Amagon HTML Editor** – desktop visual HTML editor with:
  - Visual drag-and-drop + inline text editing
  - Theme system: colors, typography, spacing, borders, custom CSS backed by CSS variables
  - Visual canvas ↔ code editor sync
  - Export to clean HTML (no editor artifacts), self-contained HTML file

### Milestone 1 – Core selection & text editing

1. Implement a **selection mode**:
   - User clicks a toggle button or presses a shortcut (e.g. `Ctrl+E`) to enable editing mode.
   - When the user hovers over elements, draw an overlay outline (like Chrome DevTools) showing which element will be selected.
   - On click, **select** that element:
     - Store a reference to the element.
     - Show a floating toolbar near the element with at least:
       - “Edit text” button.
       - “Delete element” button.
2. Implement **inline text editing**:
   - When “Edit text” is clicked, make the element’s text content editable (`contenteditable="true"`).
   - On blur or on a “Done” button, set `contenteditable="false"` and update the internal model.
3. Maintain a **simple EditorState** object:
   - Track:
     - `selectedElement`
     - `originalHTML` (snapshot of the page’s `<body>` innerHTML before any edits)
     - `history` array of changes (for undo/redo)
   - Provide functions:
     - `applyChange(change)` – updates DOM and EditorState
     - `undo()` and `redo()`

**Deliverable**:

- A minimal HTML page with a few paragraphs and headings, plus the embedded editor script.
- User can:
  - Enable editing mode.
  - Hover to see outlines.
  - Click an element to select it.
  - Edit its text inline.
  - Delete an element.
- No CSS editing yet.

---

### Milestone 2 – Per-element font property editing

1. Extend the floating toolbar for the selected element to include a **Font properties** button.
2. When clicked, open a **property panel** (initially a simple floating div) showing:
   - font-family (dropdown of web-safe fonts + a few Google Fonts)
   - font-size (input field, px)
   - font-weight (dropdown: 100–900)
   - line-height (input field)
   - letter-spacing (input field)
   - text-align (buttons: left/center/right/justify)
   - color (color input)
3. On any change:
   - Apply the style directly to `selectedElement.style`.
   - Record the change in `history` as:
     ```js
     {
       type: 'set-style',
       elementPath: /* path from body to selectedElement */,
       property: 'fontSize',
       oldValue: '16px',
       newValue: '24px'
     }
     ```
4. Implement **undo/redo** for style changes:
   - Undo restores the previous `style` values or removes the inline style if it was added by the editor.

**Deliverable**:

- User can select an element and modify its font properties via the panel.
- Changes are reflected immediately.
- Undo/redo works for text and style changes.

---

### Milestone 3 – Add / remove elements

1. Add an “Add element” button to the main editor toolbar.
2. When clicked, show a dropdown of element types:
   - Paragraph (`p`)
   - Heading (`h1`–`h6`)
   - Div (`div`)
   - Image (`img`)
   - Span (`span`)
3. For container elements (`div`, `p`, `h1`–`h6`):
   - Insert a new element as a **child** of the currently selected element (or after it if no selection / selection is not a container).
   - Set default text content.
4. For `img`:
   - Insert an `<img>` with a placeholder `src` and a default `alt`.
5. Remove element:
   - Already implemented in Milestone 1, but ensure:
     - The removal is recorded in `history` with enough info to recreate the element (tag, attributes, content, parent path).
     - Undo reinserts the element in the exact same position.
6. Track element structure in EditorState:
   - Store a simplified DOM tree (or just rely on live DOM + paths) for undo/redo.

**Deliverable**:

- User can add new paragraphs, headings, divs, images, spans.
- User can delete elements and undo/redo the additions/deletions.

---

### Milestone 4 – CSS editing with instant preview

1. Implement a **CSS editor panel**:
   - A sidebar or modal with:
     - A dropdown or list of CSS rules that affect the `selectedElement`.
     - For each rule:
       - Selector (read-only)
       - A list of properties and values (editable inputs).
2. Populate the list using:
   - `document.styleSheets`
   - For each sheet, iterate `cssRules`.
   - For each rule, check if `selectedElement.matches(rule.selectorText)`.
   - Show:
     - Rule selector
     - Properties that apply to the element (e.g. `color`, `font-size`, etc.)
3. When the user edits a property:
   - Update the rule’s style object in the stylesheet:
     ```js
     rule.style.setProperty('color', 'red', '');
     ```
   - Record the change in `history`:
     ```js
     {
       type: 'edit-css-rule',
       sheetIndex: 0,
       ruleIndex: 5,
       property: 'color',
       oldValue: 'blue',
       newValue: 'red'
     }
     ```
4. Implement **add new rule**:
   - User can type a selector (e.g. `.my-class`) and add a new empty rule to the first editable stylesheet.
   - Any properties they add in the panel are written to that rule.
5. Undo/redo for CSS:
   - Undo edits the rule back to `oldValue` or removes the rule if it was newly added.

**Deliverable**:

- User can see which CSS rules affect the selected element.
- User can edit any CSS property and see the change instantly.
- Undo/redo works for CSS changes.

---

### Milestone 5 – Undo / Redo system

1. Refine the `history` array and `currentIndex` pointer:
   - Each entry describes a single atomic change (text edit, style change, element add/remove, CSS rule edit).
2. Implement:
   - `undo()`:
     - If `currentIndex > 0`, decrement `currentIndex` and apply the inverse change.
   - `redo()`:
     - If `currentIndex < history.length - 1`, increment `currentIndex` and apply the change.
3. Add UI buttons or shortcuts:
   - Undo: `Ctrl+Z`
   - Redo: `Ctrl+Y` / `Ctrl+Shift+Z`
4. Ensure that:
   - Any change (text, style, element add/remove, CSS) goes through a single `addChange(change)` function that pushes to `history` and updates `currentIndex`.
   - Undo/redo always keeps EditorState and the live DOM in sync.

**Deliverable**:

- Full undo/redo for all operations so far.
- No corrupted state after multiple undos/redos.

---

### Milestone 6 – Save changes back to the same HTML file

1. Implement a **“Save”** button (e.g. `Ctrl+S`).
2. When clicked:
   - Reconstruct the full HTML of the page from the live DOM (including `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`).
   - Important:
     - Remove any editor UI elements from the serialized HTML (e.g. editor toolbar, panels, overlays).
     - Normalize any editor-specific attributes or classes you added.
   - Send the HTML string to the save endpoint via `fetch`:
     ```js
     const html = getCleanHTMLString(); // e.g. new XMLSerializer().serializeToString(document)
     fetch('/save-page', {
       method: 'POST',
       headers: { 'Content-Type': 'text/html' },
       body: html
     });
     ```
3. Server side:
   - Assume a simple endpoint (you can provide example Node/Express or PHP code) that:
     - Receives the HTML body.
     - Writes it to the same file from which the page was served.
4. Error handling:
   - Show success/error toasts.
   - Optionally confirm before overwriting.

**Deliverable**:

- User can make edits, click Save, and the original HTML file on the server is updated.
- On next page load, the edits are present.

---

### Milestone 7 – UX & robustness

1. Highlighting & selection:
   - Show outlines on hover (as in Milestone 1).
   - Show a breadcrumb bar near the selected element (like VvvebJs’s element breadcrumb)【turn12fetch0】.
2. Multiple selection:
   - Optional: Allow selecting multiple elements (e.g. Shift+click) and batch-edit common properties.
3. Responsive behavior:
   - When the window resizes, reposition floating toolbars and panels so they don’t overflow.
4. Performance:
   - Debounce expensive operations (e.g. re-querying `document.styleSheets` on every selection change).
5. Edge cases:
   - Handle shadow DOM if you want (optional).
   - Handle cross-origin stylesheets (show a note that they cannot be edited).
6. Accessibility:
   - Ensure editor UI is keyboard-navigable and has appropriate ARIA attributes.

**Deliverable**:

- A polished, embeddable editor that feels like a mini DevTools + WYSIWYG hybrid.

---

### Final output expectations

For each milestone, please:

1. Provide the **JavaScript code** for the editor (and any CSS).
2. Provide a **sample HTML page** that includes the editor and demonstrates the milestone’s features.
3. Briefly explain:
   - How you implemented the core EditorState and history.
   - How CSS editing and rule matching are implemented.
   - How the save functionality works and how to set up the server endpoint.

---

### Prompt end
