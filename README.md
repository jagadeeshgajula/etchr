# Etchr

**Etchr** is a lightweight, embeddable, framework-free (vanilla JavaScript) **visual HTML/CSS editor**. Drop a single `<script>` tag onto any page and it becomes a live editing surface: hover to highlight elements, click to select, edit text in place, change fonts and styles, add or remove elements, edit CSS rules with specificity awareness, undo/redo everything, and save the result back to the source.

It is designed for two use cases:

1. **Standalone** — embed it in any static HTML page and save edits straight back to the `.html` file via a tiny Node/Express endpoint.
2. **Embedded in an app (e.g. React)** — render AI-generated or DB-stored HTML inside a same-origin `<iframe srcdoc>`, hand editing control to Etchr, and receive the cleaned HTML back through a `Promise`-based `onSave(html)` callback so your app can persist it wherever it likes (a DB row, an API, etc.).

No build step is required to *use* it — just the bundled `dist/editor.js` and `dist/editor.css`.

---

## Features

- **Select anything** — hover outline + click-to-select any element on the page.
- **Inline text editing** — edit text content directly, plain-text-safe (no pasted markup leaks in).
- **Font & style panel** — change font family, size, color, weight, alignment, spacing, etc. live.
- **Describe-a-style box (plain English)** — type things like *"add a thick dashed black border on the right"* and Etchr turns it into CSS. No CSS knowledge required. Optionally route this to your own LLM endpoint via `onAiStyle` for smarter understanding.
- **Element-aware suggestions** — 10+ ready-made style presets tailored to the type of element you're editing (heading, button, image, input, container, link, list…).
- **Add / remove elements** — a collapsible right-side palette of HTML elements grouped by category; drop them into containers or after existing elements.
- **Image handling** — insert images by URL or local upload (embedded as a data URL, or routed through your own asset store via `onImageUpload`), then adjust size, shape, border, and gradients — all saved as CSS alongside the HTML.
- **CSS rule editor** — inspect and edit the actual stylesheet rules matching an element, with DevTools-style specificity; cross-origin sheets are shown read-only without errors.
- **Full undo / redo** — every operation (text, style, add/remove, CSS rule, batch multi-select) flows through a single history engine. `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`.
- **Multi-select** — `Shift+click` to select several elements and batch-edit or delete them as one undoable step.
- **Clean save** — serialization strips all editor UI, helper classes, and bookkeeping attributes so the saved HTML is exactly your content and nothing of Etchr's.
- **Zero dependencies at runtime in the browser** — pure vanilla JS. Express is only used by the optional demo save-server.

---

## Repository structure

```
.
├── src/                     # ES-module source (bundled by esbuild)
│   ├── core/                # history engine, state, config, element-path, constants
│   ├── dom/                 # mode controller, selection overlay, text/style/attr mutators, element factory, keyboard shortcuts
│   ├── css/                 # rule matcher, specificity, stylesheet registry, css mutator, NL parser, suggestions
│   ├── ui/                  # toolbars, panels (style, css, quick-style, image, palette), breadcrumb, toast
│   ├── serialize/           # clean-HTML serializer
│   ├── save/                # pluggable save client
│   └── index.js             # entry point + public API + auto-init
├── dist/                    # bundled output: editor.js (IIFE) + editor.css  (generated)
├── demo/
│   ├── demo.html            # standalone editable demo page (saves to disk)
│   └── iframe-embed-example.html  # simulates a host app embedding via iframe srcdoc + onSave callback
├── server/
│   ├── server.js            # Express: static serve + POST /save-page
│   └── save-page.js         # path-traversal-safe file writer
├── esbuild.config.mjs       # build script (JS IIFE + CSS)
└── package.json
```

---

## How to run

### Prerequisites
- Node.js 18+ and npm.

### Install
```bash
npm install
```

### Build the bundle
```bash
npm run build      # produces dist/editor.js and dist/editor.css
# or, during development:
npm run watch      # rebuilds on source change
```

### Run the demo
```bash
npm run serve
```
Then open **http://localhost:5173/demo.html**.

- Click **Edit** (or press `Ctrl+E`) to enter edit mode.
- Hover to highlight, click to select, and use the toolbar/panels to edit.
- Click **Save** (or `Ctrl+S`) to write your changes back to `demo/demo.html`.

> Tip: after rebuilding, hard-refresh the browser (`Ctrl+Shift+R`) to bypass the cached bundle.

To try the embedded-host flow (iframe + `onSave` callback), open **http://localhost:5173/iframe-embed-example.html**.

---

## How to use it in your own page (standalone)

Build once, then include the two artifacts. Etchr auto-initializes on load.

```html
<link rel="stylesheet" href="/dist/editor.css" />
<script src="/dist/editor.js" data-save-endpoint="/save-page"></script>
```

- `data-save-endpoint` — where the raw edited HTML is POSTed (`Content-Type: text/html`). Defaults to `/save-page`.
- `data-auto-init="false"` — disable auto-init if you want to call `VisualEditor.init(...)` yourself.

You'll need a server route that accepts the saved HTML. The included `server/save-page.js` shows a safe implementation (rejects path traversal, only writes `.html`/`.htm`).

---

## How to use it inside an app (React / iframe)

Etchr isolates the edited document from your app's DOM and styles by living inside a **same-origin `<iframe srcdoc>`**. The bundle is loaded *inside* that iframe, so `VisualEditor` exists on the iframe's `contentWindow`.

1. Fetch your HTML (e.g. AI-generated, stored in a DB by id) and build an iframe whose `srcdoc` contains that document plus, in its `<head>`/end of `<body>`:
   ```html
   <link rel="stylesheet" href="https://your-cdn/dist/editor.css" />
   <script src="https://your-cdn/dist/editor.js" data-auto-init="false"></script>
   ```
2. When the user clicks **Edit**, initialize with your save callback:
   ```js
   iframe.contentWindow.VisualEditor.init({
     startInEditMode: true,
     onSave: async (html) => {
       // html is fully cleaned — no editor artifacts.
       await saveTemplate(id, html);   // your DB/API call
       // resolving = success toast; throwing/rejecting = error toast
     },
   });
   ```
3. Saving inside the framework (Save button or `Ctrl+S`) runs your `onSave`. The returned Promise **is** the report-back channel: resolve → success toast; reject → error toast showing the message. No separate event bus needed.

Because it's same-origin, you can pass a real function reference directly to `init` — no `postMessage` plumbing required.

---

## Public API

`window.VisualEditor` (the global; `VisualEditor` inside an iframe host):

| Method | Description |
|--------|-------------|
| `init(options)` | Initialize the editor (idempotent — returns the existing instance if already inited). Returns the instance. |
| `getState()` | Current editor state (selection, history, edit-mode flag…). |

The instance returned by `init()` also exposes: `undo()`, `redo()`, `save()`, `getCleanHTML()`, `getState()`, and `destroy()`.

### `init(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `document` | `Document` | `document` | The document to edit (pass the iframe's document if initializing from outside). |
| `onSave` | `(html) => Promise` | `null` | Custom save handler. If set, replaces the POST-to-endpoint behavior. Resolve = success, reject/throw = error. |
| `saveEndpoint` | `string` | `'/save-page'` | Where to POST raw HTML when no `onSave` is given. |
| `onImageUpload` | `(File) => Promise<string url>` | `null` | Route local image uploads to your asset store. Falls back to an inline data URL. |
| `onAiStyle` | `(text, {tag, currentStyles}) => Promise<{property,value}[]>` | `null` | Route the "describe a style" box to your own LLM for true NL understanding. Falls back to the built-in phrase parser. |
| `confirmBeforeSave` | `boolean` | auto | Show a native confirm before saving. Defaults to `true` only for the file-write path. |
| `startInEditMode` | `boolean` | `false` | Enter edit mode immediately on init. |
| `debounceMs` | `number` | `150` | Debounce for CSS rescans on selection change. |
| `fontFamilies` / `googleFonts` | `string[]` | built-in lists | Customize the font pickers. |

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+E` | Toggle edit mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save |
| `Shift+Click` | Add/remove element from multi-selection |
| `Escape` | Close the open panel / palette, or clear selection |

---

## How it works (architecture notes)

- **Single source of truth for mutations.** Every undoable change (`text-edit`, `set-style`, `add-element`, `remove-element`, `edit-css-rule`, `add-css-rule`, `set-attribute`, `batch`) is described as data and applied through one `addChange()` / `undo()` / `redo()` engine (`src/core/history.js`). UI modules never mutate the DOM directly — they compute old/new values and dispatch a change. This keeps undo/redo provably consistent.
- **Positional element paths.** Elements are addressed by an array of child-element indices from the root (`src/core/element-path.js`), skipping editor-owned nodes and text-node whitespace, so paths stay valid across a linear history.
- **All UI is contained.** Every injected element lives under `#vve-root` (marked `data-vve-ignore`) and uses a `vve-` class prefix, so save-time stripping is a single subtree removal plus attribute cleanup.
- **Clean serialization.** `src/serialize/html-serializer.js` clones the document, removes the editor subtree, strips bookkeeping attributes/classes, and returns exactly your content.

---

## Limitations (v1)

- Path stability assumes all DOM mutation goes through Etchr's history engine; a host page's own scripts mutating the editable region during edit mode is out of scope.
- Inline text editing commits plain text only.
- Shadow DOM content and true cross-origin iframes are out of scope (the script can't be injected into a document it doesn't control). Same-origin iframes are fully supported.

---

## License

MIT (see `LICENSE` if present, or add one before publishing).
