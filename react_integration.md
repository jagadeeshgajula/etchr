# Integrating Etchr into a React App

Etchr is a framework-free visual HTML/CSS editor. It ships as a plain script
(`dist/editor.js`, exposing a global `VisualEditor`) plus a stylesheet
(`dist/editor.css`), so it can be embedded in any React setup — Create React
App, Vite, Next.js, Remix — without adapters. This guide covers the one
architectural rule you must follow, the setup steps, a complete working
example, and the API surface a React host cares about.

---

## 1. The golden rule: Etchr edits *content*, not your React components

React owns the DOM it renders: components re-render from JSX, and reconciliation
overwrites anything else that touched those nodes. Etchr works the opposite way —
it mutates the live DOM directly (inline styles, moved elements, text edits,
injected CSS rules).

Two consequences:

1. **Edits made to React-rendered UI are ephemeral.** The next re-render of that
   component wipes them.
2. **Saved output is HTML, not JSX.** `getCleanHTML()` returns serialized HTML;
   there is no way to write edits back into your component source code.

So the correct integration pattern is:

> Use Etchr to edit **HTML content your app stores as a string** — a landing
> page, CMS block, email template, user-authored page — rendered into a region
> React deliberately does not manage (`dangerouslySetInnerHTML` or an iframe).
> On save, persist the HTML string back to your backend.

Do **not** point Etchr at your app shell, navigation, or any component that
re-renders while editing.

---

## 2. Setup

### 2.1 Build the bundle

```bash
npm install
npm run build
# → dist/editor.js  (IIFE, global name: VisualEditor)
# → dist/editor.css
```

### 2.2 Add the files to your React app

Copy `dist/editor.js` and `dist/editor.css` into your React app's `public/`
folder (or serve them from your CDN), then reference them in your HTML template:

```html
<!-- public/index.html (CRA) or index.html (Vite) -->
<link rel="stylesheet" href="/editor.css" />
<script src="/editor.js" data-auto-init="false"></script>
```

> **`data-auto-init="false"` is required.** By default the script initializes
> the editor as soon as it loads (that is the zero-config static-page embed
> path). In a React app you want to control when the editor starts and stops,
> so disable auto-init and call `window.VisualEditor.init()` yourself.

### 2.3 Optional: an ESM build for direct `import`

If you prefer `import { init } from 'etchr'` over a global, add a second output
to `esbuild.config.mjs`:

```js
const esmOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/editor.esm.js',
  sourcemap: true,
  target: ['es2020'],
};
```

Note the ESM entry still runs the auto-init logic on import; it respects
`document.currentScript` being absent, but to be explicit you can import it only
inside the effect that starts editing. The examples below use the global-script
approach, which is the simplest and works everywhere.

---

## 3. Minimal React example

A page editor with an Edit / Done toggle. The editable content is an HTML
string from your backend, rendered with `dangerouslySetInnerHTML`.

```jsx
import { useEffect, useRef, useState } from 'react';

/**
 * Renders stored HTML and lets the user visually edit it with Etchr.
 *
 * @param {string}   initialHtml - the page content, as an HTML string
 * @param {Function} onPersist   - async (html) => void, saves to your backend
 */
export default function PageEditor({ initialHtml, onPersist }) {
  const [editing, setEditing] = useState(false);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!editing) return;

    instanceRef.current = window.VisualEditor.init({
      startInEditMode: true,
      // Route saves to your backend instead of Etchr's default
      // /save-page endpoint (which is only for the standalone dev server).
      onSave: async (html) => {
        await onPersist(html); // e.g. PUT /api/pages/:id
      },
    });

    return () => {
      // Removes all editor UI, overlays, and listeners. Also handles
      // React StrictMode's mount → unmount → mount double-invoke.
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [editing, onPersist]);

  return (
    <div>
      <button onClick={() => setEditing((e) => !e)}>
        {editing ? 'Done' : 'Edit page'}
      </button>

      {/*
        The editable region. React renders it once from the stored HTML and
        must NOT re-render it while editing — a re-render discards edits.
      */}
      <div dangerouslySetInnerHTML={{ __html: initialHtml }} />
    </div>
  );
}
```

And a typical parent wiring it to an API:

```jsx
function PageRoute({ pageId }) {
  const [html, setHtml] = useState(null);

  useEffect(() => {
    fetch(`/api/pages/${pageId}`)
      .then((r) => r.text())
      .then(setHtml);
  }, [pageId]);

  if (html === null) return <p>Loading…</p>;

  return (
    <PageEditor
      initialHtml={html}
      onPersist={async (newHtml) => {
        await fetch(`/api/pages/${pageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/html' },
          body: newHtml,
        });
      }}
    />
  );
}
```

The user clicks **Edit page**, Etchr's toolbar appears, they click/drag/style
elements, press **Save** (or `Ctrl+S`), and your `onPersist` receives clean
HTML with all editor UI stripped out.

### Keep the edited region render-stable

While `editing` is true, nothing may cause React to re-render the
`dangerouslySetInnerHTML` region with different props. Keep `initialHtml`
stable (don't refetch mid-edit), and if the parent re-renders frequently,
memoize the content block:

```jsx
const content = useMemo(
  () => <div dangerouslySetInnerHTML={{ __html: initialHtml }} />,
  [initialHtml]
);
```

---

## 4. Configuration options relevant to a React host

Pass these to `VisualEditor.init(options)`:

| Option | Default | What it does in a React host |
|---|---|---|
| `onSave(html)` | `null` | **Set this.** Receives the serialized page HTML; persist it to your backend. Without it, Etchr POSTs the page to `saveEndpoint` (`/save-page`), which only exists on the bundled standalone dev server. |
| `confirmBeforeSave` | `false` when `onSave` is set | Native `confirm()` before saving. Defaults off for custom `onSave` because a React host usually renders its own confirmation UI. |
| `startInEditMode` | `false` | Start with edit mode already enabled — usually what you want when init is triggered by your own "Edit" button. |
| `onImageUpload(file)` | `null` | Async hook returning a URL. Route image uploads to your asset store (S3, Cloudinary, …) instead of embedding base64 data URLs in the saved HTML. |
| `onAiStyle(text, ctx)` | `null` | Async hook for the natural-language style box. Point it at an LLM endpoint on your backend; falls back to the built-in phrase parser. |
| `document` | `document` | The Document to edit — pass an iframe's `contentDocument` for the isolated canvas pattern (section 6). |
| `enableResize` / `enableMove` / `enableLayering` | `true` | Turn off drag-resize, drag-to-move, or the right-click layering menu. |
| `autoResponsiveCss` | `true` | When resizing, auto-inject reflow fixes and `@media` breakpoint rules. |
| `debounceMs` | `150` | Debounce for style-input previews. |

The instance returned by `init()` exposes:

| Member | Purpose |
|---|---|
| `destroy()` | Tear down all editor UI and listeners. **Always call this in your effect cleanup.** |
| `save()` | Trigger the save flow programmatically (same as the toolbar button / `Ctrl+S`). |
| `undo()` / `redo()` | Programmatic history control. |
| `getCleanHTML()` | Serialize the current page with editor artifacts stripped, without saving. |
| `getState()` | The internal editor state (selection, mode, config) — for advanced use. |

---

## 5. Framework-specific notes

### Create React App / Vite

Works exactly as shown above. Put the two files in `public/` and add the
`<link>` / `<script>` tags to the HTML template.

### Next.js (App Router or Pages Router)

- Etchr touches `document` and `window`, so everything must run client-side:
  use a `'use client'` component and call `init()` only inside `useEffect`.
- Load the script with `next/script` (or a plain tag in the root layout):

```jsx
import Script from 'next/script';

<link rel="stylesheet" href="/editor.css" />
<Script src="/editor.js" strategy="afterInteractive" data-auto-init="false" />
```

- If the editor can start before the script finishes loading, guard with
  `if (!window.VisualEditor) return;` or gate the Edit button on the script's
  `onLoad`.

### React StrictMode

StrictMode mounts effects twice in development. The example handles this
correctly: the cleanup calls `destroy()`, and `init()` is safe to call again
afterward. Note that `init()` is a **singleton** — if an instance is already
alive it returns that instance instead of creating a new one — so mount at most
one editor at a time and always destroy before re-initializing.

---

## 6. Stronger isolation: the iframe canvas pattern

For a full page-builder experience — and zero collisions between your app's
CSS/event handlers and the page being edited — render the editable HTML into an
`<iframe>` and hand its document to Etchr:

```jsx
import { useEffect, useRef } from 'react';

export default function IframeEditor({ pageHtml, onPersist }) {
  const iframeRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;

    // Write the page into the iframe. editor.css must be loaded INSIDE the
    // iframe document — all editor UI (toolbars, panels, overlays) is
    // appended to this document's body.
    doc.open();
    doc.write(`<!DOCTYPE html>
      <html>
        <head><link rel="stylesheet" href="/editor.css"></head>
        <body>${pageHtml}</body>
      </html>`);
    doc.close();

    instanceRef.current = window.VisualEditor.init({
      document: doc,
      startInEditMode: true,
      onSave: onPersist,
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [pageHtml, onPersist]);

  return (
    <iframe
      ref={iframeRef}
      title="Page editor"
      style={{ width: '100%', height: '80vh', border: '1px solid #ddd' }}
    />
  );
}
```

Benefits of the iframe pattern:

- Your app's global CSS cannot restyle the edited page, and vice versa.
- Your app's click/keyboard handlers never fight the editor's.
- The edited page's own scripts and styles behave as they would when published.

This is the same isolation approach used by commercial page builders.

---

## 7. Common pitfalls

| Pitfall | Fix |
|---|---|
| Edits disappear while editing | Something re-rendered the edited region. Keep its props stable; memoize the content block; don't refetch mid-edit. |
| Editor toolbar never appears | The script auto-init was disabled (good) but `init()` was never called, or `window.VisualEditor` was undefined because the script hadn't loaded yet. Gate on script load. |
| Save fails with a 404 on `/save-page` | You didn't pass `onSave`, so Etchr fell back to the standalone dev-server endpoint. Always supply `onSave` in a React host. |
| Two editors / duplicated toolbars | `init()` was called again without `destroy()`. It's a singleton and returns the live instance, but stale references to a destroyed instance can confuse your code — always `destroy()` in the effect cleanup and re-`init()` fresh. |
| Saved HTML contains giant base64 images | Provide `onImageUpload` so images go to real asset storage and the HTML keeps only URLs. |
| Trying to save edits back into JSX | Not possible by design — Etchr round-trips HTML strings, not component source. Store editable content as HTML. |
