var VisualEditor = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    getInstance: () => getInstance,
    getState: () => getState,
    init: () => init,
    isDirty: () => isDirty,
    openEditor: () => openEditor
  });

  // src/core/constants.js
  var CLASS_PREFIX = "vve-";
  var ROOT_ID = "vve-root";
  var ATTR_IGNORE = "data-vve-ignore";
  var ATTR_EDITING = "data-vve-editing";
  var ATTR_CREATED_SHEET = "data-vve-created-sheet";
  var EMBED_PARAM = "__etchr";
  var cls = (name) => `${CLASS_PREFIX}${name}`;

  // src/core/config.js
  var WEB_SAFE_FONTS = [
    "Arial, Helvetica, sans-serif",
    "Georgia, serif",
    '"Times New Roman", Times, serif',
    '"Courier New", Courier, monospace',
    "Verdana, Geneva, sans-serif",
    "Tahoma, Geneva, sans-serif",
    '"Trebuchet MS", Helvetica, sans-serif'
  ];
  var GOOGLE_FONTS = ["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins"];
  var CONTAINER_TAGS = /* @__PURE__ */ new Set(["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "section", "article", "header", "footer", "main", "li", "ul", "ol", "a", "button", "blockquote"]);
  var DEFAULT_DEBOUNCE_MS = 150;
  function createConfig(overrides = {}) {
    return {
      saveEndpoint: "/save-page",
      onSave: null,
      // Optional async hook: (File) => Promise<string url>. When provided, local
      // image uploads are routed through it (e.g. to a real asset store) instead of
      // being embedded as a data URL. Falls back to a FileReader data URL if absent.
      onImageUpload: null,
      // Optional async hook for natural-language styling:
      //   (text, { tag, currentStyles }) => Promise<{property, value}[]>
      // When provided, the "describe a style" box routes to it (e.g. an LLM on your
      // backend) for true understanding. Falls back to the built-in phrase parser.
      onAiStyle: null,
      // Whether to show a native confirm() dialog before saving. Defaults to true
      // only for the standalone file-write path (no custom onSave); a React host
      // supplying its own onSave usually wants to control confirmation itself, but
      // this can be set explicitly either way.
      confirmBeforeSave: void 0,
      startInEditMode: false,
      // Running inside the editor-modal iframe: trims the in-page chrome (no
      // Enable/Exit toggle, no in-page Save — the modal header owns saving).
      embedded: false,
      // Which screen edge the elements palette docks to: 'right' | 'left'.
      paletteSide: "right",
      // Set false to remove the Enable/Exit editing toggle and the Ctrl/Cmd+E
      // shortcut (used in embedded mode, where exiting edit mode is a dead state).
      allowModeToggle: true,
      debounceMs: DEFAULT_DEBOUNCE_MS,
      // Resize handles on the selection outline, and whether resizing an
      // element auto-injects reflow fixes + @media breakpoint rules so layout
      // holds up across viewport sizes without hand-written responsive CSS.
      enableResize: true,
      autoResponsiveCss: true,
      resizeMinSize: 24,
      responsiveBreakpoints: ["tablet", "mobile"],
      // Drag a selected element to move it anywhere on the page (promotes it to
      // an absolutely-positioned, page-coordinate overlay — PowerPoint-canvas
      // style). Set false to keep elements pinned in normal document flow.
      enableMove: true,
      // Right-click layering menu (Bring to Front / Send to Back / Bring Forward /
      // Send Backward) that reorders overlapping elements via z-index.
      enableLayering: true,
      fontFamilies: [...WEB_SAFE_FONTS],
      googleFonts: [...GOOGLE_FONTS],
      containerTags: CONTAINER_TAGS,
      ...overrides
    };
  }

  // src/core/editor-state.js
  function createEditorState({ root, editorRoot, config }) {
    return {
      root,
      editorRoot,
      config,
      isEditModeEnabled: false,
      selectedElements: [],
      hoveredElement: null,
      history: [],
      currentIndex: -1,
      // history index at the last successful save; currentIndex !== savedIndex
      // means there are unsaved changes (undoing back to the saved point counts
      // as clean again).
      savedIndex: -1,
      editableStylesheet: null,
      stylesheetCache: {
        signature: 0,
        rulesByElementPath: /* @__PURE__ */ new Map()
      },
      listeners: /* @__PURE__ */ new Set()
    };
  }
  function subscribe(state, fn) {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  }
  function notify(state) {
    for (const fn of state.listeners) fn(state);
  }

  // src/dom/selection-overlay.js
  var HANDLE_DIRS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  var HANDLE_SIZE = 8;
  function createSelectionOverlay(editorRoot, { enableMove = true } = {}) {
    const doc = editorRoot.ownerDocument;
    const hover = doc.createElement("div");
    hover.className = cls("outline-hover");
    hover.setAttribute(ATTR_IGNORE, "");
    hover.style.display = "none";
    editorRoot.appendChild(hover);
    const moveSurface = doc.createElement("div");
    moveSurface.className = cls("move-surface");
    moveSurface.setAttribute(ATTR_IGNORE, "");
    moveSurface.style.display = "none";
    editorRoot.appendChild(moveSurface);
    const selectedPool = [];
    function ensurePoolSize(count) {
      while (selectedPool.length < count) {
        const div = doc.createElement("div");
        div.className = cls("outline-selected");
        div.setAttribute(ATTR_IGNORE, "");
        div.style.display = "none";
        editorRoot.appendChild(div);
        selectedPool.push(div);
      }
    }
    const handles = HANDLE_DIRS.map((dir) => {
      const div = doc.createElement("div");
      div.className = `${cls("resize-handle")} ${cls("resize-handle-" + dir)}`;
      div.dataset.vveResizeDir = dir;
      div.setAttribute(ATTR_IGNORE, "");
      div.style.display = "none";
      editorRoot.appendChild(div);
      return { el: div, dir };
    });
    function positionHandles(targetEl) {
      if (!targetEl || !targetEl.isConnected) {
        hideHandles();
        return;
      }
      const r = targetEl.getBoundingClientRect();
      const half = HANDLE_SIZE / 2;
      const at = {
        nw: [r.top, r.left],
        n: [r.top, r.left + r.width / 2],
        ne: [r.top, r.right],
        e: [r.top + r.height / 2, r.right],
        se: [r.bottom, r.right],
        s: [r.bottom, r.left + r.width / 2],
        sw: [r.bottom, r.left],
        w: [r.top + r.height / 2, r.left]
      };
      handles.forEach(({ el, dir }) => {
        const [top, left] = at[dir];
        el.style.display = "block";
        el.style.top = `${top - half}px`;
        el.style.left = `${left - half}px`;
      });
    }
    function hideHandles() {
      handles.forEach(({ el }) => el.style.display = "none");
    }
    function positionMoveSurface(targetEl) {
      const root = editorRoot.ownerDocument.body;
      const unmovable = targetEl && (targetEl === root || targetEl.contains && targetEl.contains(root) || !targetEl.parentElement);
      if (!enableMove || !targetEl || !targetEl.isConnected || unmovable) {
        moveSurface.style.display = "none";
        return;
      }
      const r = targetEl.getBoundingClientRect();
      moveSurface.style.display = "block";
      moveSurface.style.top = `${r.top}px`;
      moveSurface.style.left = `${r.left}px`;
      moveSurface.style.width = `${r.width}px`;
      moveSurface.style.height = `${r.height}px`;
    }
    function positionOverlay(overlayEl, targetEl) {
      if (!targetEl || !targetEl.isConnected) {
        overlayEl.style.display = "none";
        return;
      }
      const rect = targetEl.getBoundingClientRect();
      overlayEl.style.display = "block";
      overlayEl.style.top = `${rect.top}px`;
      overlayEl.style.left = `${rect.left}px`;
      overlayEl.style.width = `${rect.width}px`;
      overlayEl.style.height = `${rect.height}px`;
    }
    function showSelectedMany(elements) {
      ensurePoolSize(elements.length);
      selectedPool.forEach((div, i) => {
        if (i < elements.length) positionOverlay(div, elements[i]);
        else div.style.display = "none";
      });
      if (elements.length === 1 && elements[0].isConnected) {
        positionHandles(elements[0]);
        positionMoveSurface(elements[0]);
      } else {
        hideHandles();
        moveSurface.style.display = "none";
      }
    }
    function hideSelected() {
      selectedPool.forEach((div) => div.style.display = "none");
      hideHandles();
      moveSurface.style.display = "none";
    }
    return {
      showHover(el) {
        positionOverlay(hover, el);
      },
      hideHover() {
        hover.style.display = "none";
      },
      showSelectedMany,
      hideSelected,
      handles,
      moveSurface,
      reposition(hoveredEl, selectedElements) {
        positionOverlay(hover, hoveredEl);
        showSelectedMany(selectedElements || []);
      },
      destroy() {
        hover.remove();
        selectedPool.forEach((d2) => d2.remove());
        handles.forEach(({ el }) => el.remove());
        moveSurface.remove();
      }
    };
  }

  // src/dom/mode-controller.js
  function isEditorOwned(el) {
    return !!(el && (el.closest(`[${ATTR_IGNORE}]`) || el.id === "vve-root"));
  }
  function createModeController(state) {
    const doc = state.root.ownerDocument;
    const win = doc.defaultView;
    const overlay = createSelectionOverlay(state.editorRoot, { enableMove: state.config.enableMove !== false });
    let attached = false;
    function onMouseOver(e) {
      const target = e.target;
      if (isEditorOwned(target)) return;
      state.hoveredElement = target;
      overlay.showHover(target);
    }
    function onMouseOut(e) {
      if (isEditorOwned(e.target)) return;
      state.hoveredElement = null;
      overlay.hideHover();
    }
    function onClick(e) {
      const target = e.target;
      if (isEditorOwned(target)) return;
      if (target.closest(`[${ATTR_EDITING}]`)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) toggleSelectElement(state, target);
      else selectElement(state, target);
    }
    function onScrollOrResize() {
      overlay.reposition(state.hoveredElement, state.selectedElements);
    }
    function selectElement(st, el) {
      st.selectedElements = [el];
      notify(st);
    }
    function toggleSelectElement(st, el) {
      const idx = st.selectedElements.indexOf(el);
      st.selectedElements = idx === -1 ? [...st.selectedElements, el] : st.selectedElements.filter((x) => x !== el);
      notify(st);
    }
    function clearSelection(st) {
      st.selectedElements = [];
      notify(st);
    }
    subscribe(state, () => {
      overlay.showSelectedMany(state.selectedElements.filter((el) => el.isConnected));
    });
    function enable() {
      if (attached) return;
      doc.addEventListener("mouseover", onMouseOver, true);
      doc.addEventListener("mouseout", onMouseOut, true);
      doc.addEventListener("click", onClick, true);
      win.addEventListener("scroll", onScrollOrResize, true);
      win.addEventListener("resize", onScrollOrResize);
      attached = true;
      state.isEditModeEnabled = true;
      notify(state);
    }
    function disable() {
      if (!attached) return;
      doc.removeEventListener("mouseover", onMouseOver, true);
      doc.removeEventListener("mouseout", onMouseOut, true);
      doc.removeEventListener("click", onClick, true);
      win.removeEventListener("scroll", onScrollOrResize, true);
      win.removeEventListener("resize", onScrollOrResize);
      attached = false;
      state.isEditModeEnabled = false;
      state.hoveredElement = null;
      overlay.hideHover();
      clearSelection(state);
      notify(state);
    }
    function toggle() {
      if (attached) disable();
      else enable();
    }
    if (state.config.allowModeToggle !== false) {
      doc.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
          e.preventDefault();
          toggle();
        }
      });
    }
    return { enable, disable, toggle, selectElement, toggleSelectElement, clearSelection, overlay, isEnabled: () => attached };
  }

  // src/core/history.js
  var handlers = /* @__PURE__ */ new Map();
  var nextId = 1;
  function registerHandler(type, { forward, inverse }) {
    handlers.set(type, { forward, inverse });
  }
  function getHandler(type) {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`No history handler registered for change type "${type}"`);
    return handler;
  }
  function pruneStaleSelection(state) {
    const before = state.selectedElements.length;
    state.selectedElements = state.selectedElements.filter((el) => el.isConnected);
    return state.selectedElements.length !== before;
  }
  function addChange(state, change) {
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
  registerHandler("batch", {
    forward(state, entry) {
      for (const child of entry.children) getHandler(child.type).forward(state, child);
    },
    inverse(state, entry) {
      for (let i = entry.children.length - 1; i >= 0; i--) {
        getHandler(entry.children[i].type).inverse(state, entry.children[i]);
      }
    }
  });
  function canUndo(state) {
    return state.currentIndex >= 0;
  }
  function canRedo(state) {
    return state.currentIndex < state.history.length - 1;
  }
  function undo(state) {
    if (!canUndo(state)) return;
    const entry = state.history[state.currentIndex];
    const handler = getHandler(entry.type);
    handler.inverse(state, entry);
    state.currentIndex--;
    pruneStaleSelection(state);
    notify(state);
  }
  function redo(state) {
    if (!canRedo(state)) return;
    state.currentIndex++;
    const entry = state.history[state.currentIndex];
    const handler = getHandler(entry.type);
    handler.forward(state, entry);
    pruneStaleSelection(state);
    notify(state);
  }

  // src/core/element-path.js
  function getEditableChildren(parent) {
    return Array.from(parent.children).filter((el) => !el.hasAttribute(ATTR_IGNORE) && !el.closest(`[${ATTR_IGNORE}]`));
  }
  function toPath(el, root) {
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
  function fromPath(path, root) {
    let node = root;
    for (const index of path) {
      const siblings = getEditableChildren(node);
      node = siblings[index];
      if (!node) return null;
    }
    return node;
  }
  function getAncestorChain(el, root) {
    const chain = [];
    let node = el;
    while (node) {
      chain.unshift(node);
      if (node === root) break;
      node = node.parentElement;
    }
    return chain[0] === root ? chain : [];
  }

  // src/dom/style-mutator.js
  function applyStyle(el, property, value) {
    if (value === null || value === "") {
      el.style.removeProperty(property);
    } else {
      el.style.setProperty(property, value);
    }
  }
  registerHandler("set-style", {
    forward(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) applyStyle(el, entry.property, entry.newValue);
    },
    inverse(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) applyStyle(el, entry.property, entry.oldValue);
    }
  });
  function readInlineValue(el, property) {
    const v = el.style.getPropertyValue(property);
    return v === "" ? null : v;
  }
  function previewStyle(el, property, value) {
    applyStyle(el, property, value);
  }
  function commitStyle(state, el, property, oldValue, newValue) {
    const normOld = oldValue === "" ? null : oldValue;
    const normNew = newValue === "" ? null : newValue;
    if (normOld === normNew) return;
    const path = toPath(el, state.root);
    if (!path) return;
    addChange(state, { type: "set-style", elementPath: path, property, oldValue: normOld, newValue: normNew });
  }
  function describeStyleChanges(state, el, entries) {
    const path = toPath(el, state.root);
    if (!path) return [];
    const children = [];
    for (const { property, oldValue, newValue } of entries) {
      const normOld = oldValue === "" ? null : oldValue;
      const normNew = newValue === "" || newValue == null ? null : newValue;
      if (normOld === normNew) continue;
      children.push({ type: "set-style", elementPath: path, property, oldValue: normOld, newValue: normNew });
    }
    return children;
  }
  function applyStyleBatch(state, el, declarations, label = "style") {
    const path = toPath(el, state.root);
    if (!path) return;
    const children = [];
    for (const { property, value } of declarations) {
      const cur = el.style.getPropertyValue(property);
      const oldValue = cur === "" ? null : cur;
      const newValue = value === "" || value == null ? null : value;
      if (oldValue === newValue) continue;
      children.push({ type: "set-style", elementPath: path, property, oldValue, newValue });
    }
    if (!children.length) return;
    addChange(state, { type: "batch", label, children });
  }
  function removeInlineStyle(state, el, property) {
    commitStyle(state, el, property, readInlineValue(el, property), null);
  }
  function applyStyleToMany(state, elements, property, value, label = "style") {
    const children = [];
    for (const el of elements) {
      const path = toPath(el, state.root);
      if (!path) continue;
      const cur = el.style.getPropertyValue(property);
      const oldValue = cur === "" ? null : cur;
      const newValue = value === "" || value == null ? null : value;
      if (oldValue === newValue) continue;
      children.push({ type: "set-style", elementPath: path, property, oldValue, newValue });
    }
    if (!children.length) return;
    addChange(state, { type: "batch", label, children });
  }
  function applyStyleBatchToMany(state, elements, declarations, label = "style") {
    const children = [];
    for (const el of elements) {
      const path = toPath(el, state.root);
      if (!path) continue;
      for (const { property, value } of declarations) {
        const cur = el.style.getPropertyValue(property);
        const oldValue = cur === "" ? null : cur;
        const newValue = value === "" || value == null ? null : value;
        if (oldValue === newValue) continue;
        children.push({ type: "set-style", elementPath: path, property, oldValue, newValue });
      }
    }
    if (!children.length) return;
    addChange(state, { type: "batch", label, children });
  }
  function listInlineStyles(el) {
    const out = [];
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style[i];
      out.push({ name, value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name) });
    }
    return out;
  }

  // src/css/element-selector.js
  var counter = 0;
  var seeded = false;
  function seedCounter(doc) {
    let max = 0;
    doc.querySelectorAll("[class]").forEach((el) => {
      el.classList.forEach((c) => {
        const m = /^vve-r(\d+)$/.exec(c);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
    });
    counter = max;
    seeded = true;
  }
  function existingStableClass(el) {
    for (const c of el.classList) {
      if (/^vve-r\d+$/.test(c)) return c;
    }
    return null;
  }
  function describeStableSelector(state, el) {
    const existing = existingStableClass(el);
    if (existing) return { selector: `.${existing}`, descriptor: null };
    const doc = state.root.ownerDocument;
    if (!seeded) seedCounter(doc);
    const path = toPath(el, state.root);
    if (!path) return { selector: null, descriptor: null };
    counter += 1;
    const name = `vve-r${counter}`;
    const currentClass = el.getAttribute("class");
    const newClass = currentClass ? `${currentClass} ${name}` : name;
    return {
      selector: `.${name}`,
      descriptor: { type: "set-attribute", elementPath: path, attribute: "class", oldValue: currentClass, newValue: newClass }
    };
  }

  // src/css/specificity.js
  function splitSelectorList(selectorText) {
    const parts = [];
    let depth = 0;
    let current2 = "";
    for (const ch of selectorText) {
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        parts.push(current2.trim());
        current2 = "";
      } else {
        current2 += ch;
      }
    }
    if (current2.trim()) parts.push(current2.trim());
    return parts;
  }
  function computeSpecificity(selector) {
    let a = 0;
    let b = 0;
    let c = 0;
    let s = selector;
    s = s.replace(/:where\([^)]*\)/gi, " ");
    const funcRe = /:(is|not|has|matches)\(([^()]*)\)/gi;
    let m;
    while ((m = funcRe.exec(s)) !== null) {
      const branches = splitSelectorList(m[2]);
      let best = { a: 0, b: 0, c: 0 };
      for (const branch of branches) {
        const spec = computeSpecificity(branch);
        if (compareSpecificity(spec, best) > 0) best = spec;
      }
      a += best.a;
      b += best.b;
      c += best.c;
    }
    s = s.replace(funcRe, " ");
    const ids = s.match(/#[\w-]+/g);
    if (ids) a += ids.length;
    s = s.replace(/#[\w-]+/g, " ");
    const classes = s.match(/\.[\w-]+/g);
    if (classes) b += classes.length;
    s = s.replace(/\.[\w-]+/g, " ");
    const attrs = s.match(/\[[^\]]+\]/g);
    if (attrs) b += attrs.length;
    s = s.replace(/\[[^\]]+\]/g, " ");
    const pseudoEls = s.match(/::[\w-]+/g);
    if (pseudoEls) c += pseudoEls.length;
    s = s.replace(/::[\w-]+/g, " ");
    const pseudoClasses = s.match(/:[\w-]+/g);
    if (pseudoClasses) b += pseudoClasses.length;
    s = s.replace(/:[\w-]+/g, " ");
    const types = s.match(/[a-zA-Z][\w-]*/g);
    if (types) c += types.length;
    return { a, b, c };
  }
  function compareSpecificity(x, y) {
    if (x.a !== y.a) return x.a - y.a;
    if (x.b !== y.b) return x.b - y.b;
    return x.c - y.c;
  }
  function formatSpecificity(spec) {
    return `${spec.a},${spec.b},${spec.c}`;
  }

  // src/css/rule-matcher.js
  function readProperties(style) {
    const props = [];
    for (let i = 0; i < style.length; i++) {
      const name = style[i];
      props.push({
        name,
        value: style.getPropertyValue(name),
        priority: style.getPropertyPriority(name)
      });
    }
    return props;
  }
  function bestMatchSpecificity(el, selectorText) {
    let best = null;
    for (const branch of splitSelectorList(selectorText)) {
      let matches = false;
      try {
        matches = el.matches(branch);
      } catch {
        matches = false;
      }
      if (matches) {
        const spec = computeSpecificity(branch);
        if (!best || compareSpecificity(spec, best) > 0) best = spec;
      }
    }
    return best;
  }
  function isGroupingRule(rule) {
    return !!rule.cssRules && (!!rule.media || rule.conditionText != null);
  }
  function walkRuleList(rules, el, sheetIndex, mediaPath, conditionText, out) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (isGroupingRule(rule)) {
        const cond = rule.media ? `@media ${rule.media.mediaText}` : `@supports ${rule.conditionText}`;
        walkRuleList(rule.cssRules, el, sheetIndex, mediaPath.concat(i), cond, out);
        continue;
      }
      if (rule.selectorText != null && rule.style) {
        const spec = bestMatchSpecificity(el, rule.selectorText);
        if (spec) {
          out.push({
            sheetIndex,
            mediaPath,
            ruleIndex: i,
            selectorText: rule.selectorText,
            specificity: spec,
            conditionText,
            properties: readProperties(rule.style),
            rule
          });
        }
      }
    }
  }
  function getMatchingRules(doc, el) {
    const matched = [];
    const inaccessible = [];
    const sheets = doc.styleSheets;
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        inaccessible.push({ sheetIndex: s, href: sheet.href || "(inline)" });
        continue;
      }
      if (!rules) continue;
      walkRuleList(rules, el, s, [], null, matched);
    }
    matched.sort((a, b) => compareSpecificity(b.specificity, a.specificity));
    return { matched, inaccessible };
  }
  function resolveRule(doc, sheetIndex, mediaPath, ruleIndex) {
    const sheet = doc.styleSheets[sheetIndex];
    if (!sheet) return null;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      return null;
    }
    for (const idx of mediaPath) {
      const grouping = rules[idx];
      if (!grouping || !grouping.cssRules) return null;
      rules = grouping.cssRules;
    }
    return rules[ruleIndex] || null;
  }
  function resolveRuleContainer(doc, sheetIndex, mediaPath) {
    let container = doc.styleSheets[sheetIndex];
    if (!container) return null;
    for (const idx of mediaPath) {
      let rules;
      try {
        rules = container.cssRules;
      } catch {
        return null;
      }
      const grouping = rules && rules[idx];
      if (!grouping || !grouping.cssRules) return null;
      container = grouping;
    }
    return container;
  }

  // src/css/stylesheet-registry.js
  function getOrCreateEditableStylesheet(state) {
    const existing = state.editableStylesheet;
    if (existing && existing.ownerNode && existing.ownerNode.isConnected) return existing;
    const doc = state.root.ownerDocument;
    let styleEl = doc.querySelector(`style[${ATTR_CREATED_SHEET}]`);
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.setAttribute(ATTR_CREATED_SHEET, "");
      doc.head.appendChild(styleEl);
    }
    state.editableStylesheet = styleEl.sheet;
    return state.editableStylesheet;
  }
  function indexOfSheet(doc, sheet) {
    for (let i = 0; i < doc.styleSheets.length; i++) {
      if (doc.styleSheets[i] === sheet) return i;
    }
    return -1;
  }
  function findTopLevelMediaRuleIndex(sheet, mediaText) {
    for (let i = 0; i < sheet.cssRules.length; i++) {
      const rule = sheet.cssRules[i];
      if (rule.media && rule.media.mediaText === mediaText) return i;
    }
    return -1;
  }
  function ensureMediaRule(state, mediaText) {
    const doc = state.root.ownerDocument;
    const sheet = getOrCreateEditableStylesheet(state);
    const sheetIndex = indexOfSheet(doc, sheet);
    const existingIndex = findTopLevelMediaRuleIndex(sheet, mediaText);
    if (existingIndex !== -1) return { sheetIndex, mediaPath: [existingIndex], descriptor: null };
    const ruleIndex = sheet.cssRules.length;
    return {
      sheetIndex,
      mediaPath: [ruleIndex],
      descriptor: { type: "add-media-rule", sheetIndex, ruleIndex, mediaText }
    };
  }

  // src/css/css-mutator.js
  function setOrRemove(style, property, value, priority) {
    if (value === null || value === "") {
      style.removeProperty(property);
    } else {
      style.setProperty(property, value, priority || "");
    }
  }
  registerHandler("edit-css-rule", {
    forward(state, entry) {
      const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
      if (rule) setOrRemove(rule.style, entry.property, entry.newValue, entry.newPriority);
    },
    inverse(state, entry) {
      const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
      if (rule) setOrRemove(rule.style, entry.property, entry.oldValue, entry.oldPriority);
    }
  });
  registerHandler("add-css-rule", {
    forward(state, entry) {
      const rule = resolveRule(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath, entry.ruleIndex);
      if (rule && rule.selectorText === entry.selectorText) return;
      const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
      if (!sheet) return;
      const body = entry.properties.map((p) => `${p.name}: ${p.value}${p.priority ? " !" + p.priority : ""};`).join(" ");
      sheet.insertRule(`${entry.selectorText} { ${body} }`, entry.ruleIndex);
    },
    inverse(state, entry) {
      const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
      if (sheet) sheet.deleteRule(entry.ruleIndex);
    }
  });
  registerHandler("add-media-rule", {
    forward(state, entry) {
      const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
      if (!sheet) return;
      const already = sheet.cssRules[entry.ruleIndex];
      if (already && already.media && already.media.mediaText === entry.mediaText) return;
      sheet.insertRule(`@media ${entry.mediaText} { }`, entry.ruleIndex);
    },
    inverse(state, entry) {
      const sheet = state.root.ownerDocument.styleSheets[entry.sheetIndex];
      if (sheet) sheet.deleteRule(entry.ruleIndex);
    }
  });
  registerHandler("insert-css-rule", {
    forward(state, entry) {
      const container = resolveRuleContainer(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath);
      if (!container) return;
      const existing = container.cssRules[entry.ruleIndex];
      if (existing && existing.selectorText === entry.selectorText) return;
      const body = entry.properties.map((p) => `${p.name}: ${p.value}${p.priority ? " !" + p.priority : ""};`).join(" ");
      container.insertRule(`${entry.selectorText} { ${body} }`, entry.ruleIndex);
    },
    inverse(state, entry) {
      const container = resolveRuleContainer(state.root.ownerDocument, entry.sheetIndex, entry.mediaPath);
      if (container) container.deleteRule(entry.ruleIndex);
    }
  });
  function commitCssEdit(state, address, property, newValue, newPriority = "") {
    const rule = resolveRule(state.root.ownerDocument, address.sheetIndex, address.mediaPath, address.ruleIndex);
    if (!rule) return;
    const oldRaw = rule.style.getPropertyValue(property);
    const oldValue = oldRaw === "" ? null : oldRaw;
    const oldPriority = rule.style.getPropertyPriority(property);
    const normNew = newValue === "" ? null : newValue;
    if (oldValue === normNew && oldPriority === newPriority) return;
    addChange(state, {
      type: "edit-css-rule",
      sheetIndex: address.sheetIndex,
      mediaPath: address.mediaPath,
      ruleIndex: address.ruleIndex,
      property,
      oldValue,
      oldPriority,
      newValue: normNew,
      newPriority
    });
  }
  function addCssRule(state, selectorText) {
    const doc = state.root.ownerDocument;
    const sheet = getOrCreateEditableStylesheet(state);
    const sheetIndex = indexOfSheet(doc, sheet);
    if (sheetIndex === -1) return null;
    const ruleIndex = sheet.cssRules.length;
    addChange(state, {
      type: "add-css-rule",
      sheetIndex,
      mediaPath: [],
      ruleIndex,
      selectorText,
      properties: []
    });
    return { sheetIndex, mediaPath: [], ruleIndex };
  }
  function describeResponsiveUpsert(state, mediaText, selectorText, declarations, pendingInserts) {
    const doc = state.root.ownerDocument;
    const { sheetIndex, mediaPath, descriptor: mediaDescriptor } = ensureMediaRule(state, mediaText);
    const children = [];
    const containerKey = `${sheetIndex}:${mediaPath.join(".")}`;
    if (mediaDescriptor) {
      if (!pendingInserts.has(containerKey)) children.push(mediaDescriptor);
    } else {
      const container = resolveRuleContainer(doc, sheetIndex, mediaPath);
      const rules = container ? container.cssRules : [];
      let foundIndex = -1;
      for (let i = 0; i < rules.length; i++) {
        if (rules[i].selectorText === selectorText) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex !== -1) {
        const rule = rules[foundIndex];
        for (const { name, value } of declarations) {
          const oldRaw = rule.style.getPropertyValue(name);
          const oldValue = oldRaw === "" ? null : oldRaw;
          if (oldValue === value) continue;
          children.push({
            type: "edit-css-rule",
            sheetIndex,
            mediaPath,
            ruleIndex: foundIndex,
            property: name,
            oldValue,
            oldPriority: "",
            newValue: value,
            newPriority: ""
          });
        }
        return children;
      }
    }
    const baseCount = mediaDescriptor ? 0 : resolveRuleContainer(doc, sheetIndex, mediaPath).cssRules.length;
    const already = pendingInserts.get(containerKey) || 0;
    const ruleIndex = baseCount + already;
    pendingInserts.set(containerKey, already + 1);
    children.push({
      type: "insert-css-rule",
      sheetIndex,
      mediaPath,
      ruleIndex,
      selectorText,
      properties: declarations.map((d2) => ({ name: d2.name, value: d2.value, priority: "" }))
    });
    return children;
  }

  // src/dom/responsive-injector.js
  var BREAKPOINTS = [
    { name: "tablet", mediaText: "(max-width: 768px)" },
    { name: "mobile", mediaText: "(max-width: 480px)" }
  ];
  function describeResponsiveInjection(state, target, { widthChanged, widthPx, usedWestMargin }, config) {
    const children = [];
    const win = state.root.ownerDocument.defaultView;
    children.push(
      ...describeStyleChanges(state, target, [{ property: "max-width", oldValue: readInlineValue(target, "max-width"), newValue: "100%" }])
    );
    const parent = target.parentElement;
    let parentIsFlex = false;
    if (parent && parent !== state.editorRoot) {
      const parentDisplay = win.getComputedStyle(parent).display;
      parentIsFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
      const overflowing = parent.scrollWidth > parent.clientWidth + 1;
      if (parentIsFlex && overflowing) {
        children.push(
          ...describeStyleChanges(state, parent, [{ property: "flex-wrap", oldValue: readInlineValue(parent, "flex-wrap"), newValue: "wrap" }])
        );
      }
    }
    if (!widthChanged) return children;
    const enabledTiers = config.responsiveBreakpoints || [];
    if (!enabledTiers.length) return children;
    const targetSel = describeStableSelector(state, target);
    if (!targetSel.selector) return children;
    if (targetSel.descriptor) children.push(targetSel.descriptor);
    let parentSel = null;
    if (parentIsFlex) {
      parentSel = describeStableSelector(state, parent);
      if (parentSel.descriptor) children.push(parentSel.descriptor);
    }
    const pendingInserts = /* @__PURE__ */ new Map();
    for (const bp of BREAKPOINTS) {
      if (!enabledTiers.includes(bp.name)) continue;
      const decl = [
        { name: "box-sizing", value: "border-box" },
        { name: "width", value: "100%" },
        { name: "max-width", value: `${Math.round(widthPx)}px` }
      ];
      if (bp.name === "mobile" && usedWestMargin) {
        decl.push({ name: "margin-left", value: "0" }, { name: "margin-right", value: "0" });
      }
      children.push(...describeResponsiveUpsert(state, bp.mediaText, targetSel.selector, decl, pendingInserts));
      if (parentSel && parentSel.selector) {
        children.push(
          ...describeResponsiveUpsert(state, bp.mediaText, parentSel.selector, [{ name: "flex-wrap", value: "wrap" }], pendingInserts)
        );
      }
    }
    return children;
  }

  // src/dom/resize-controller.js
  function cursorFor(dir) {
    if (dir === "nw" || dir === "se") return "nwse-resize";
    if (dir === "ne" || dir === "sw") return "nesw-resize";
    if (dir === "n" || dir === "s") return "ns-resize";
    return "ew-resize";
  }
  function createResizeController(state, overlay, config) {
    const doc = state.root.ownerDocument;
    const win = doc.defaultView;
    const MIN_SIZE = config.resizeMinSize || 24;
    let drag = null;
    function onHandleDown(e, dir) {
      if (!state.isEditModeEnabled || state.selectedElements.length !== 1) return;
      const target = state.selectedElements[0];
      e.preventDefault();
      e.stopPropagation();
      const computed = win.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      const startMarginLeft = parseFloat(computed.marginLeft) || 0;
      const startMarginTop = parseFloat(computed.marginTop) || 0;
      drag = {
        dir,
        target,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startMarginLeft,
        startMarginTop,
        lastWidth: rect.width,
        lastHeight: rect.height,
        lastMarginLeft: startMarginLeft,
        lastMarginTop: startMarginTop,
        // Captured BEFORE any preview mutation — required for correct undo,
        // since previewStyle below will overwrite el.style as the drag proceeds.
        oldWidth: readInlineValue(target, "width"),
        oldHeight: readInlineValue(target, "height"),
        oldMarginLeft: readInlineValue(target, "margin-left"),
        oldMarginTop: readInlineValue(target, "margin-top"),
        oldBoxSizing: readInlineValue(target, "box-sizing"),
        oldDisplay: readInlineValue(target, "display"),
        startBoxSizing: computed.boxSizing,
        startDisplay: computed.display,
        normalized: false,
        prevCursor: doc.body.style.cursor,
        prevUserSelect: doc.body.style.userSelect
      };
      doc.body.style.cursor = cursorFor(dir);
      doc.body.style.userSelect = "none";
      win.addEventListener("pointermove", onMove);
      win.addEventListener("pointerup", onUp);
    }
    function onMove(e) {
      if (!drag) return;
      if (!drag.normalized) {
        if (drag.startBoxSizing !== "border-box") previewStyle(drag.target, "box-sizing", "border-box");
        if (drag.startDisplay === "inline") previewStyle(drag.target, "display", "inline-block");
        drag.normalized = true;
      }
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const { dir } = drag;
      if (dir.includes("e")) drag.lastWidth = Math.max(MIN_SIZE, drag.startWidth + dx);
      if (dir.includes("w")) drag.lastWidth = Math.max(MIN_SIZE, drag.startWidth - dx);
      if (dir.includes("s")) drag.lastHeight = Math.max(MIN_SIZE, drag.startHeight + dy);
      if (dir.includes("n")) drag.lastHeight = Math.max(MIN_SIZE, drag.startHeight - dy);
      if (dir.includes("w")) drag.lastMarginLeft = drag.startMarginLeft + drag.startWidth - drag.lastWidth;
      if (dir.includes("n")) drag.lastMarginTop = drag.startMarginTop + drag.startHeight - drag.lastHeight;
      if (dir.includes("e") || dir.includes("w")) previewStyle(drag.target, "width", `${drag.lastWidth}px`);
      if (dir.includes("n") || dir.includes("s")) previewStyle(drag.target, "height", `${drag.lastHeight}px`);
      if (dir.includes("w")) previewStyle(drag.target, "margin-left", `${drag.lastMarginLeft}px`);
      if (dir.includes("n")) previewStyle(drag.target, "margin-top", `${drag.lastMarginTop}px`);
      overlay.showSelectedMany(state.selectedElements);
    }
    function onUp() {
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      doc.body.style.cursor = drag.prevCursor;
      doc.body.style.userSelect = drag.prevUserSelect;
      if (!drag.normalized) {
        drag = null;
        return;
      }
      const { dir, target } = drag;
      const entries = [];
      const widthChanged = dir.includes("e") || dir.includes("w");
      const heightChanged = dir.includes("n") || dir.includes("s");
      if (widthChanged) entries.push({ property: "width", oldValue: drag.oldWidth, newValue: `${drag.lastWidth}px` });
      if (heightChanged) entries.push({ property: "height", oldValue: drag.oldHeight, newValue: `${drag.lastHeight}px` });
      if (dir.includes("w")) entries.push({ property: "margin-left", oldValue: drag.oldMarginLeft, newValue: `${drag.lastMarginLeft}px` });
      if (dir.includes("n")) entries.push({ property: "margin-top", oldValue: drag.oldMarginTop, newValue: `${drag.lastMarginTop}px` });
      if (drag.startBoxSizing !== "border-box") entries.push({ property: "box-sizing", oldValue: drag.oldBoxSizing, newValue: "border-box" });
      if (drag.startDisplay === "inline") entries.push({ property: "display", oldValue: drag.oldDisplay, newValue: "inline-block" });
      const children = describeStyleChanges(state, target, entries);
      if (config.autoResponsiveCss !== false) {
        children.push(
          ...describeResponsiveInjection(
            state,
            target,
            { widthChanged, widthPx: drag.lastWidth, usedWestMargin: dir.includes("w") },
            config
          )
        );
      }
      if (children.length) addChange(state, { type: "batch", label: "resize", children });
      overlay.showSelectedMany(state.selectedElements);
      drag = null;
    }
    const listeners = overlay.handles.map(({ el, dir }) => {
      const handler = (e) => onHandleDown(e, dir);
      el.addEventListener("pointerdown", handler);
      return { el, handler };
    });
    return {
      destroy() {
        listeners.forEach(({ el, handler }) => el.removeEventListener("pointerdown", handler));
        win.removeEventListener("pointermove", onMove);
        win.removeEventListener("pointerup", onUp);
      }
    };
  }

  // src/dom/move-controller.js
  var DRAG_THRESHOLD = 3;
  var MOVE_PROPS = ["position", "left", "top", "width", "height", "margin-top", "margin-right", "margin-bottom", "margin-left", "box-sizing"];
  function isEditorOwned2(el) {
    return !!(el && el.closest(`[${ATTR_IGNORE}]`));
  }
  function createMoveController(state, modeController, config) {
    const doc = state.root.ownerDocument;
    const win = doc.defaultView;
    const root = state.root;
    const overlay = modeController.overlay;
    const surface = overlay.moveSurface;
    let drag = null;
    function onDown(e) {
      if (e.button !== 0) return;
      if (!state.isEditModeEnabled || state.selectedElements.length !== 1) return;
      const target = state.selectedElements[0];
      if (!target.isConnected || !target.parentElement || target === root || target.contains(root)) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      drag = {
        target,
        startX: e.clientX,
        startY: e.clientY,
        // Viewport-space top-left of the element at gesture start — the visual
        // position we must preserve exactly through promotion + reparenting.
        viewLeft: rect.left,
        viewTop: rect.top,
        frozenWidth: rect.width,
        frozenHeight: rect.height,
        // Exact original DOM slot, for a precise revert before the clean commit.
        origParent: target.parentElement,
        origNextSibling: target.nextSibling,
        // Old inline values, captured BEFORE any preview mutation (mirrors resize).
        oldInline: Object.fromEntries(MOVE_PROPS.map((p) => [p, readInlineValue(target, p)])),
        // Placed offset (added to viewLeft/Top each frame) — resolved in promote()
        // so the element lands pixel-exact regardless of its containing block.
        baseLeft: 0,
        baseTop: 0,
        lastLeft: 0,
        lastTop: 0,
        moved: false,
        promoted: false,
        prevCursor: doc.body.style.cursor,
        prevUserSelect: doc.body.style.userSelect,
        shiftKey: e.shiftKey
      };
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
      }
      win.addEventListener("pointermove", onMove);
      win.addEventListener("pointerup", onUp);
    }
    function promote() {
      const t = drag.target;
      previewStyle(t, "box-sizing", "border-box");
      previewStyle(t, "width", `${drag.frozenWidth}px`);
      previewStyle(t, "height", `${drag.frozenHeight}px`);
      previewStyle(t, "margin-top", "0px");
      previewStyle(t, "margin-right", "0px");
      previewStyle(t, "margin-bottom", "0px");
      previewStyle(t, "margin-left", "0px");
      previewStyle(t, "position", "absolute");
      if (drag.origParent !== root) root.appendChild(t);
      previewStyle(t, "left", "0px");
      previewStyle(t, "top", "0px");
      const at0 = t.getBoundingClientRect();
      drag.baseLeft = drag.viewLeft - at0.left;
      drag.baseTop = drag.viewTop - at0.top;
      previewStyle(t, "left", `${drag.baseLeft}px`);
      previewStyle(t, "top", `${drag.baseTop}px`);
      drag.promoted = true;
    }
    function onMove(e) {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        promote();
        doc.body.style.cursor = "move";
        doc.body.style.userSelect = "none";
      }
      drag.lastLeft = drag.baseLeft + dx;
      drag.lastTop = drag.baseTop + dy;
      previewStyle(drag.target, "left", `${drag.lastLeft}px`);
      previewStyle(drag.target, "top", `${drag.lastTop}px`);
      overlay.showSelectedMany(state.selectedElements);
    }
    function onUp(e) {
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      try {
        surface.releasePointerCapture(e.pointerId);
      } catch {
      }
      const active = drag;
      drag = null;
      if (!active.moved) {
        forwardClick(active, e);
        return;
      }
      doc.body.style.cursor = active.prevCursor;
      doc.body.style.userSelect = active.prevUserSelect;
      const { target } = active;
      for (const p of MOVE_PROPS) {
        const v = active.oldInline[p];
        if (v == null) target.style.removeProperty(p);
        else target.style.setProperty(p, v);
      }
      if (active.origParent !== root) active.origParent.insertBefore(target, active.origNextSibling);
      const oldPath = toPath(target, root);
      const children = [];
      let newPath = oldPath;
      if (active.origParent !== root) {
        const oldParentPath = oldPath.slice(0, -1);
        const oldIndex = oldPath[oldPath.length - 1];
        const toIndex = getEditableChildren(root).length;
        children.push({ type: "move-element", fromParentPath: oldParentPath, fromIndex: oldIndex, toParentPath: [], toIndex });
        newPath = [toIndex];
      }
      const entries = [
        { property: "box-sizing", oldValue: active.oldInline["box-sizing"], newValue: "border-box" },
        { property: "width", oldValue: active.oldInline["width"], newValue: `${active.frozenWidth}px` },
        { property: "height", oldValue: active.oldInline["height"], newValue: `${active.frozenHeight}px` },
        // Zero each margin longhand individually — mirrors promote()'s `margin:0`
        // while restoring cleanly to whatever longhands a prior resize had set.
        { property: "margin-top", oldValue: active.oldInline["margin-top"], newValue: "0px" },
        { property: "margin-right", oldValue: active.oldInline["margin-right"], newValue: "0px" },
        { property: "margin-bottom", oldValue: active.oldInline["margin-bottom"], newValue: "0px" },
        { property: "margin-left", oldValue: active.oldInline["margin-left"], newValue: "0px" },
        { property: "position", oldValue: active.oldInline["position"], newValue: "absolute" },
        { property: "left", oldValue: active.oldInline["left"], newValue: `${active.lastLeft}px` },
        { property: "top", oldValue: active.oldInline["top"], newValue: `${active.lastTop}px` }
      ];
      for (const { property, oldValue, newValue } of entries) {
        const normOld = oldValue === "" ? null : oldValue;
        const normNew = newValue === "" || newValue == null ? null : newValue;
        if (normOld === normNew) continue;
        children.push({ type: "set-style", elementPath: newPath, property, oldValue: normOld, newValue: normNew });
      }
      if (children.length) addChange(state, { type: "batch", label: "move", children });
      overlay.showSelectedMany(state.selectedElements);
    }
    function forwardClick(active, e) {
      surface.style.display = "none";
      const under = doc.elementFromPoint(e.clientX, e.clientY);
      surface.style.display = "block";
      if (!under || isEditorOwned2(under)) return;
      if (active.shiftKey) modeController.toggleSelectElement(state, under);
      else modeController.selectElement(state, under);
    }
    const downHandler = (e) => onDown(e);
    surface.addEventListener("pointerdown", downHandler);
    return {
      destroy() {
        surface.removeEventListener("pointerdown", downHandler);
        win.removeEventListener("pointermove", onMove);
        win.removeEventListener("pointerup", onUp);
      }
    };
  }

  // src/dom/text-editor.js
  registerHandler("text-edit", {
    forward(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) el.textContent = entry.newText;
    },
    inverse(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) el.textContent = entry.oldText;
    }
  });
  var activeEditingElement = null;
  function isEditingText() {
    return activeEditingElement !== null;
  }
  function commitActiveEdit() {
    if (activeEditingElement) activeEditingElement.blur();
  }
  function beginTextEdit(state, el) {
    if (activeEditingElement) return;
    activeEditingElement = el;
    const oldText = el.textContent;
    el.setAttribute("contenteditable", "true");
    el.setAttribute(ATTR_EDITING, "");
    el.focus();
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      el.removeEventListener("blur", commit);
      el.removeEventListener("keydown", onKeydown);
      el.removeAttribute("contenteditable");
      el.removeAttribute(ATTR_EDITING);
      activeEditingElement = null;
      const newText = el.textContent;
      if (newText !== oldText) {
        const path = toPath(el, state.root);
        if (path) addChange(state, { type: "text-edit", elementPath: path, oldText, newText });
      }
    };
    function onKeydown(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        el.textContent = oldText;
        el.blur();
      }
    }
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", onKeydown);
  }

  // src/dom/keyboard-shortcuts.js
  var NATIVE_TEXT_INPUTS = /* @__PURE__ */ new Set(["input", "textarea", "select"]);
  function shouldYieldToNativeUndo(doc) {
    if (isEditingText()) return true;
    const active = doc.activeElement;
    if (!active) return false;
    if (active.isContentEditable) return true;
    return NATIVE_TEXT_INPUTS.has(active.tagName.toLowerCase());
  }
  function installKeyboardShortcuts(state, { onSave } = {}) {
    const doc = state.root.ownerDocument;
    doc.addEventListener("keydown", (e) => {
      if (!state.isEditModeEnabled) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s" && onSave) {
        e.preventDefault();
        onSave();
        return;
      }
      if (key !== "z" && key !== "y") return;
      if (shouldYieldToNativeUndo(doc)) return;
      e.preventDefault();
      if (key === "z") {
        if (e.shiftKey) redo(state);
        else undo(state);
      } else {
        redo(state);
      }
    });
  }

  // src/ui/dom-helpers.js
  function createEl(doc, tag, { className, attrs, text, html } = {}) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text != null) el.textContent = text;
    if (html != null) el.innerHTML = html;
    return el;
  }
  function button(doc, label, onClick, extraClass = "") {
    const btn = createEl(doc, "button", {
      className: `${cls("btn")} ${extraClass}`.trim(),
      attrs: { type: "button", [ATTR_IGNORE]: "" },
      text: label
    });
    btn.addEventListener("click", onClick);
    return btn;
  }
  function positionNear(panelEl, targetRect, win) {
    const margin = 8;
    const panelRect = panelEl.getBoundingClientRect();
    let top = targetRect.bottom + margin;
    let left = targetRect.left;
    const viewportW = win.innerWidth;
    const viewportH = win.innerHeight;
    if (top + panelRect.height > viewportH) {
      top = Math.max(margin, targetRect.top - panelRect.height - margin);
    }
    if (left + panelRect.width > viewportW) {
      left = Math.max(margin, viewportW - panelRect.width - margin);
    }
    top = Math.max(margin, top);
    left = Math.max(margin, left);
    panelEl.style.top = `${top}px`;
    panelEl.style.left = `${left}px`;
  }

  // src/dom/layer-mutator.js
  function effectiveZ(el, win) {
    const n = parseInt(win.getComputedStyle(el).zIndex, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  function inlineValue(el, property) {
    const v = el.style.getPropertyValue(property);
    return v === "" ? null : v;
  }
  function applyLayer(state, el, direction) {
    const root = state.root;
    const win = root.ownerDocument.defaultView;
    const parent = el.parentElement;
    if (!parent) return;
    const group = getEditableChildren(parent);
    const domIndex = new Map(group.map((n, i) => [n, i]));
    const others = group.filter((n) => n !== el);
    const myZ = effectiveZ(el, win);
    const children = [];
    const setStyle = (target, property, value) => {
      const path = toPath(target, root);
      if (!path) return;
      const oldValue = inlineValue(target, property);
      const newValue = value == null ? null : String(value);
      if ((oldValue == null ? null : oldValue) === newValue) return;
      children.push({ type: "set-style", elementPath: path, property, oldValue, newValue });
    };
    if (win.getComputedStyle(el).position === "static") {
      setStyle(el, "position", "relative");
    }
    if (direction === "front") {
      const max = others.length ? Math.max(...others.map((n) => effectiveZ(n, win))) : 0;
      if (myZ <= max) setStyle(el, "z-index", max + 1);
    } else if (direction === "back") {
      const min = others.length ? Math.min(...others.map((n) => effectiveZ(n, win))) : 0;
      if (myZ >= min) setStyle(el, "z-index", min - 1);
    } else if (direction === "forward" || direction === "backward") {
      const stack = group.slice().sort((a, b) => effectiveZ(a, win) - effectiveZ(b, win) || domIndex.get(a) - domIndex.get(b));
      const pos = stack.indexOf(el);
      if (direction === "forward" && pos < stack.length - 1) {
        const target = stack[pos + 1];
        const tz = effectiveZ(target, win);
        if (tz > myZ) {
          setStyle(el, "z-index", tz);
          setStyle(target, "z-index", myZ);
        } else setStyle(el, "z-index", tz + 1);
      } else if (direction === "backward" && pos > 0) {
        const target = stack[pos - 1];
        const tz = effectiveZ(target, win);
        if (tz < myZ) {
          setStyle(el, "z-index", tz);
          setStyle(target, "z-index", myZ);
        } else setStyle(el, "z-index", tz - 1);
      }
    }
    if (children.length) addChange(state, { type: "batch", label: `layer:${direction}`, children });
  }

  // src/ui/context-menu.js
  var ITEMS = [
    { label: "Bring to Front", direction: "front" },
    { label: "Bring Forward", direction: "forward" },
    { label: "Send Backward", direction: "backward" },
    { label: "Send to Back", direction: "back" }
  ];
  function isEditorOwned3(el) {
    return !!(el && el.closest(`[${ATTR_IGNORE}]`));
  }
  function createContextMenu(state, modeController) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const overlay = modeController.overlay;
    const menu = createEl(doc, "div", {
      className: cls("context-menu"),
      attrs: { [ATTR_IGNORE]: "", role: "menu", "aria-label": "Layering" }
    });
    menu.style.display = "none";
    ITEMS.forEach(({ label, direction }) => {
      const item = createEl(doc, "button", {
        className: cls("context-menu-item"),
        attrs: { type: "button", role: "menuitem", [ATTR_IGNORE]: "" },
        text: label
      });
      item.addEventListener("click", () => {
        const el = state.selectedElements[0];
        if (el && el.isConnected) applyLayer(state, el, direction);
        close();
      });
      menu.appendChild(item);
    });
    state.editorRoot.appendChild(menu);
    let open = false;
    function openAt(x, y) {
      menu.style.display = "block";
      open = true;
      const r = menu.getBoundingClientRect();
      const left = Math.min(x, win.innerWidth - r.width - 4);
      const top = Math.min(y, win.innerHeight - r.height - 4);
      menu.style.left = `${Math.max(4, left)}px`;
      menu.style.top = `${Math.max(4, top)}px`;
    }
    function close() {
      if (!open) return;
      menu.style.display = "none";
      open = false;
    }
    function onContextMenu(e) {
      if (!state.isEditModeEnabled) return;
      const onMoveSurface = e.target === overlay.moveSurface;
      if (isEditorOwned3(e.target) && !onMoveSurface) return;
      const el = onMoveSurface ? state.selectedElements[0] : e.target;
      if (!el) return;
      e.preventDefault();
      if (!state.selectedElements.includes(el)) modeController.selectElement(state, el);
      openAt(e.clientX, e.clientY);
    }
    function onDocPointerDown(e) {
      if (open && !menu.contains(e.target)) close();
    }
    function onScrollOrResize() {
      close();
    }
    function onKeyDown(e) {
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        close();
      }
    }
    doc.addEventListener("contextmenu", onContextMenu, true);
    doc.addEventListener("pointerdown", onDocPointerDown, true);
    win.addEventListener("scroll", onScrollOrResize, true);
    win.addEventListener("resize", onScrollOrResize);
    doc.addEventListener("keydown", onKeyDown, true);
    return {
      close,
      isOpen: () => open,
      destroy() {
        doc.removeEventListener("contextmenu", onContextMenu, true);
        doc.removeEventListener("pointerdown", onDocPointerDown, true);
        win.removeEventListener("scroll", onScrollOrResize, true);
        win.removeEventListener("resize", onScrollOrResize);
        doc.removeEventListener("keydown", onKeyDown, true);
        menu.remove();
      }
    };
  }

  // src/ui/main-toolbar.js
  function createMainToolbar(state, modeController, { onSave, showModeToggle = true, showSave = true } = {}) {
    const doc = state.editorRoot.ownerDocument;
    const bar = createEl(doc, "div", {
      className: cls("main-toolbar"),
      attrs: { [ATTR_IGNORE]: "", role: "toolbar", "aria-label": "Editor toolbar" }
    });
    let modeToggle = null;
    if (showModeToggle) {
      modeToggle = button(doc, "Enable editing", () => modeController.toggle());
      bar.appendChild(modeToggle);
    }
    const undoBtn = button(doc, "Undo", () => {
      commitActiveEdit();
      undo(state);
    });
    const redoBtn = button(doc, "Redo", () => {
      commitActiveEdit();
      redo(state);
    });
    bar.appendChild(undoBtn);
    bar.appendChild(redoBtn);
    let saveBtn = null;
    if (onSave && showSave) {
      saveBtn = button(doc, "Save", onSave, cls("btn-active"));
      bar.appendChild(saveBtn);
    }
    state.editorRoot.appendChild(bar);
    subscribe(state, () => {
      if (modeToggle) {
        modeToggle.textContent = state.isEditModeEnabled ? "Exit editing" : "Enable editing";
        modeToggle.classList.toggle(cls("btn-active"), state.isEditModeEnabled);
      }
      undoBtn.disabled = !canUndo(state);
      redoBtn.disabled = !canRedo(state);
    });
    return { el: bar, appendButton: (el) => bar.appendChild(el) };
  }

  // src/dom/dom-mutator.js
  function nodeFromOuterHTML(outerHTML, doc) {
    const template = doc.createElement("template");
    template.innerHTML = outerHTML.trim();
    return template.content.firstElementChild;
  }
  function insertAtPath(root, doc, parentPath, index, node) {
    const parent = fromPath(parentPath, root);
    if (!parent) throw new Error("insertAtPath: parent not found for path " + JSON.stringify(parentPath));
    const siblings = getEditableChildren(parent);
    const refNode = siblings[index] || null;
    parent.insertBefore(node, refNode);
    return node;
  }
  function removeAtPath(root, parentPath, index) {
    const parent = fromPath(parentPath, root);
    if (!parent) throw new Error("removeAtPath: parent not found for path " + JSON.stringify(parentPath));
    const siblings = getEditableChildren(parent);
    const node = siblings[index];
    if (!node) throw new Error("removeAtPath: no element at index " + index);
    node.remove();
    return node;
  }
  function reparentByPath(root, fromParentPath, fromIndex, toParentPath, toIndex) {
    const fromParent = fromPath(fromParentPath, root);
    if (!fromParent) throw new Error("reparentByPath: from-parent not found for path " + JSON.stringify(fromParentPath));
    const node = getEditableChildren(fromParent)[fromIndex];
    if (!node) throw new Error("reparentByPath: no element at from-index " + fromIndex);
    node.remove();
    const toParent = fromPath(toParentPath, root);
    if (!toParent) throw new Error("reparentByPath: to-parent not found for path " + JSON.stringify(toParentPath));
    const siblings = getEditableChildren(toParent);
    const refNode = siblings[toIndex] || null;
    toParent.insertBefore(node, refNode);
    return node;
  }
  registerHandler("move-element", {
    forward(state, entry) {
      reparentByPath(state.root, entry.fromParentPath, entry.fromIndex, entry.toParentPath, entry.toIndex);
    },
    inverse(state, entry) {
      reparentByPath(state.root, entry.toParentPath, entry.toIndex, entry.fromParentPath, entry.fromIndex);
    }
  });
  registerHandler("remove-element", {
    forward(state, entry) {
      removeAtPath(state.root, entry.parentPath, entry.index);
    },
    inverse(state, entry) {
      const node = nodeFromOuterHTML(entry.outerHTML, state.root.ownerDocument);
      insertAtPath(state.root, state.root.ownerDocument, entry.parentPath, entry.index, node);
    }
  });
  registerHandler("add-element", {
    forward(state, entry) {
      const node = nodeFromOuterHTML(entry.outerHTML, state.root.ownerDocument);
      insertAtPath(state.root, state.root.ownerDocument, entry.parentPath, entry.index, node);
    },
    inverse(state, entry) {
      removeAtPath(state.root, entry.parentPath, entry.index);
    }
  });
  function removeElement(state, el) {
    const parent = el.parentElement;
    const parentPath = toPath(parent, state.root);
    if (parentPath === null) return;
    const siblings = getEditableChildren(parent);
    const index = siblings.indexOf(el);
    addChange(state, {
      type: "remove-element",
      parentPath,
      index,
      tagName: el.tagName.toLowerCase(),
      outerHTML: el.outerHTML
    });
  }
  function addElement(state, parentPath, index, node) {
    addChange(state, {
      type: "add-element",
      parentPath,
      index,
      tagName: node.tagName.toLowerCase(),
      outerHTML: node.outerHTML
    });
  }
  function removeElements(state, elements) {
    const targets = elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
    const children = [];
    for (const el of targets) {
      const parent = el.parentElement;
      const parentPath = toPath(parent, state.root);
      if (parentPath === null) continue;
      const index = getEditableChildren(parent).indexOf(el);
      children.push({ type: "remove-element", parentPath, index, tagName: el.tagName.toLowerCase(), outerHTML: el.outerHTML });
    }
    if (!children.length) return;
    children.sort((a, b) => b.index - a.index);
    addChange(state, { type: "batch", label: `delete ${children.length} elements`, children });
  }

  // src/ui/toolbar.js
  function createToolbar(state, modeController) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const bar = createEl(doc, "div", {
      className: cls("toolbar"),
      attrs: { [ATTR_IGNORE]: "", role: "toolbar", "aria-label": "Selected element actions" }
    });
    bar.style.display = "none";
    const editTextBtn = button(doc, "Edit text", () => {
      const el = state.selectedElements[0];
      if (el) beginTextEdit(state, el);
    });
    const deleteBtn = button(doc, "Delete", () => {
      const els = state.selectedElements.filter((el) => el.isConnected);
      if (els.length === 1) removeElement(state, els[0]);
      else if (els.length > 1) removeElements(state, els);
      modeController.clearSelection(state);
    }, cls("btn-danger"));
    bar.appendChild(editTextBtn);
    bar.appendChild(deleteBtn);
    state.editorRoot.appendChild(bar);
    function targetRect() {
      const els = state.selectedElements.filter((el) => el.isConnected);
      if (!els.length) return null;
      return els[els.length - 1].getBoundingClientRect();
    }
    function reposition() {
      const rect = targetRect();
      const count = state.selectedElements.length;
      if (!rect || !state.isEditModeEnabled) {
        bar.style.display = "none";
        return;
      }
      editTextBtn.style.display = count > 1 ? "none" : "";
      deleteBtn.textContent = count > 1 ? `Delete (${count})` : "Delete";
      bar.style.display = "flex";
      positionNear(bar, rect, win);
    }
    subscribe(state, reposition);
    win.addEventListener("scroll", reposition, true);
    win.addEventListener("resize", reposition);
    return {
      el: bar,
      reposition,
      appendButton: (el) => bar.insertBefore(el, deleteBtn),
      // Lets index.js hide single-element-only buttons (CSS/Image) during multi-select.
      isMultiSelect: () => state.selectedElements.filter((el) => el.isConnected).length > 1
    };
  }

  // src/ui/google-fonts.js
  var loaded = /* @__PURE__ */ new Set();
  function ensureGoogleFont(doc, family) {
    const key = family.toLowerCase();
    if (loaded.has(key)) return;
    loaded.add(key);
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@100;300;400;500;700;900&display=swap`;
    doc.head.appendChild(link);
  }

  // src/ui/style-panel.js
  var FONT_WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  var TEXT_ALIGNS = ["left", "center", "right", "justify"];
  function rgbToHex(value) {
    const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return value.startsWith("#") ? value : "#000000";
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  function currentValue(el, doc, prop) {
    const inline = readInlineValue(el, prop);
    if (inline != null) return inline;
    return doc.defaultView.getComputedStyle(el).getPropertyValue(prop);
  }
  function createStylePanel(state) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const panel = createEl(doc, "div", {
      className: cls("panel") + " " + cls("style-panel"),
      attrs: { [ATTR_IGNORE]: "", role: "region", "aria-label": "Text styles panel" }
    });
    panel.style.display = "none";
    const header = createEl(doc, "div", { className: cls("panel-header") });
    const titleEl = createEl(doc, "span", { text: "Text styles" });
    const closeBtn = createEl(doc, "button", { className: cls("panel-close"), attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Close panel" }, text: "\xD7" });
    closeBtn.addEventListener("click", () => hide());
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = createEl(doc, "div", { className: cls("panel-body") });
    panel.appendChild(body);
    const refreshers = [];
    function addRow(labelText, controlEl) {
      const row = createEl(doc, "label", { className: cls("field") });
      row.appendChild(createEl(doc, "span", { className: cls("field-label"), text: labelText }));
      row.appendChild(controlEl);
      body.appendChild(row);
    }
    function targetEl() {
      return state.selectedElements[0] || null;
    }
    function targetEls() {
      return state.selectedElements.filter((el) => el.isConnected);
    }
    function commit(prop, value, singleOldValue) {
      const els = targetEls();
      if (els.length <= 1) {
        const el = els[0];
        if (el) commitStyle(state, el, prop, singleOldValue !== void 0 ? singleOldValue : readInlineValue(el, prop), value);
        return;
      }
      applyStyleToMany(state, els, prop, value, prop);
    }
    function addSelect(labelText, prop, options, onApply) {
      const select = createEl(doc, "select", { className: cls("control"), attrs: { [ATTR_IGNORE]: "" } });
      for (const opt of options) {
        const o = createEl(doc, "option", { text: opt.label, attrs: { value: opt.value } });
        select.appendChild(o);
      }
      select.addEventListener("change", () => {
        if (!targetEls().length) return;
        if (onApply) targetEls().forEach((el) => onApply(el, select.value));
        commit(prop, select.value);
      });
      addRow(labelText, select);
      refreshers.push((el) => {
        const val = currentValue(el, doc, prop).trim();
        const match = options.find((o) => o.value === val || val.startsWith(o.value));
        select.value = match ? match.value : options[0].value;
      });
    }
    function addNumber(labelText, prop, { unit = "px", min, max, step = 1 } = {}) {
      const input = createEl(doc, "input", { className: cls("control"), attrs: { type: "number", [ATTR_IGNORE]: "" } });
      if (min != null) input.min = min;
      if (max != null) input.max = max;
      input.step = step;
      let captured = null;
      const toValue = () => input.value === "" ? "" : `${input.value}${unit}`;
      input.addEventListener("input", () => {
        const els = targetEls();
        if (els.length !== 1) return;
        if (captured === null) captured = readInlineValue(els[0], prop);
        previewStyle(els[0], prop, toValue());
      });
      input.addEventListener("change", () => {
        if (!targetEls().length) return;
        const oldValue = captured;
        captured = null;
        commit(prop, toValue(), oldValue);
      });
      addRow(labelText, input);
      refreshers.push((el) => {
        const val = currentValue(el, doc, prop).trim();
        const num = parseFloat(val);
        input.value = Number.isFinite(num) ? String(num) : "";
      });
    }
    function addColor(labelText, prop) {
      const input = createEl(doc, "input", { className: cls("control") + " " + cls("control-color"), attrs: { type: "color", [ATTR_IGNORE]: "" } });
      let captured = null;
      input.addEventListener("input", () => {
        const els = targetEls();
        if (els.length !== 1) return;
        if (captured === null) captured = readInlineValue(els[0], prop);
        previewStyle(els[0], prop, input.value);
      });
      input.addEventListener("change", () => {
        if (!targetEls().length) return;
        const oldValue = captured;
        captured = null;
        commit(prop, input.value, oldValue);
      });
      addRow(labelText, input);
      refreshers.push((el) => {
        input.value = rgbToHex(currentValue(el, doc, prop).trim());
      });
    }
    const fontOptions = [
      ...state.config.fontFamilies.map((f) => ({ label: f.split(",")[0].replace(/["']/g, ""), value: f })),
      ...state.config.googleFonts.map((f) => ({ label: `${f} (Google)`, value: `'${f}', sans-serif` }))
    ];
    addSelect("Font", "font-family", fontOptions, (el, value) => {
      const google = state.config.googleFonts.find((f) => value.includes(f));
      if (google) ensureGoogleFont(doc, google);
    });
    addNumber("Size", "font-size", { unit: "px", min: 8, max: 200 });
    addSelect("Weight", "font-weight", FONT_WEIGHTS.map((w) => ({ label: w, value: w })));
    addNumber("Line height", "line-height", { unit: "", min: 0.5, max: 4, step: 0.1 });
    addNumber("Letter spacing", "letter-spacing", { unit: "px", min: -5, max: 20, step: 0.1 });
    addSelect("Align", "text-align", TEXT_ALIGNS.map((a) => ({ label: a, value: a })));
    addColor("Color", "color");
    state.editorRoot.appendChild(panel);
    function refresh() {
      const el = targetEl();
      if (!el) return;
      const count = targetEls().length;
      titleEl.textContent = count > 1 ? `Text styles (${count} selected)` : "Text styles";
      for (const fn of refreshers) fn(el);
    }
    function reposition() {
      const el = targetEl();
      if (!el || !isOpen()) return;
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function show() {
      const el = targetEl();
      if (!el) return;
      panel.style.display = "block";
      refresh();
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function hide() {
      panel.style.display = "none";
    }
    function isOpen() {
      return panel.style.display !== "none";
    }
    subscribe(state, () => {
      if (!state.isEditModeEnabled || !targetEl()) {
        hide();
        return;
      }
      if (isOpen()) refresh();
    });
    win.addEventListener("scroll", reposition, true);
    win.addEventListener("resize", reposition);
    return { el: panel, show, hide, isOpen };
  }

  // src/core/debounce.js
  function debounce(fn, wait) {
    let timer = null;
    function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    }
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
  }

  // src/ui/css-panel.js
  function createCssPanel(state) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const panel = createEl(doc, "div", {
      className: cls("panel") + " " + cls("css-panel"),
      attrs: { [ATTR_IGNORE]: "", role: "region", "aria-label": "CSS rules panel" }
    });
    panel.style.display = "none";
    const header = createEl(doc, "div", { className: cls("panel-header"), text: "CSS rules" });
    const closeBtn = createEl(doc, "button", { className: cls("panel-close"), attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Close panel" }, text: "\xD7" });
    closeBtn.addEventListener("click", hide);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = createEl(doc, "div", { className: cls("panel-body") });
    panel.appendChild(body);
    state.editorRoot.appendChild(panel);
    const addedRules = [];
    function targetEl() {
      return state.selectedElements[0] || null;
    }
    function propRow(address, name, value, priority) {
      const row = createEl(doc, "div", { className: cls("css-prop") });
      const nameEl = createEl(doc, "span", { className: cls("css-prop-name"), text: name });
      const valInput = createEl(doc, "input", { className: cls("control") + " " + cls("css-prop-value"), attrs: { type: "text", [ATTR_IGNORE]: "" } });
      valInput.value = priority ? `${value} !${priority}` : value;
      valInput.addEventListener("change", () => {
        let v = valInput.value.trim();
        let prio = "";
        if (/!\s*important$/i.test(v)) {
          prio = "important";
          v = v.replace(/!\s*important$/i, "").trim();
        }
        commitCssEdit(state, address, name, v, prio);
      });
      const rm = createEl(doc, "button", { className: cls("css-prop-remove"), attrs: { type: "button", [ATTR_IGNORE]: "", title: "Remove property", "aria-label": `Remove ${name}` }, text: "\xD7" });
      rm.addEventListener("click", () => commitCssEdit(state, address, name, null, ""));
      row.appendChild(nameEl);
      row.appendChild(valInput);
      row.appendChild(rm);
      return row;
    }
    function ruleBlock(address, selectorText, specificity, conditionText, properties, editable) {
      const block = createEl(doc, "div", { className: cls("css-rule") });
      const head = createEl(doc, "div", { className: cls("css-rule-head") });
      if (conditionText) head.appendChild(createEl(doc, "span", { className: cls("css-cond"), text: conditionText }));
      head.appendChild(createEl(doc, "span", { className: cls("css-selector"), text: selectorText }));
      if (specificity) head.appendChild(createEl(doc, "span", { className: cls("css-spec"), text: formatSpecificity(specificity), attrs: { title: "specificity (id, class, type)" } }));
      block.appendChild(head);
      for (const p of properties) {
        block.appendChild(propRow(address, p.name, p.value, p.priority));
      }
      if (editable) {
        const addRow = createEl(doc, "div", { className: cls("css-add-prop") });
        const nameInput = createEl(doc, "input", { className: cls("control"), attrs: { type: "text", placeholder: "property", [ATTR_IGNORE]: "" } });
        const valInput = createEl(doc, "input", { className: cls("control"), attrs: { type: "text", placeholder: "value", [ATTR_IGNORE]: "" } });
        const addBtn = createEl(doc, "button", { className: cls("btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: "+" });
        const apply = () => {
          const name = nameInput.value.trim();
          const value = valInput.value.trim();
          if (!name || !value) return;
          commitCssEdit(state, address, name, value, "");
          nameInput.value = "";
          valInput.value = "";
        };
        addBtn.addEventListener("click", apply);
        valInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") apply();
        });
        addRow.appendChild(nameInput);
        addRow.appendChild(valInput);
        addRow.appendChild(addBtn);
        block.appendChild(addRow);
      }
      return block;
    }
    function render() {
      body.innerHTML = "";
      const el = targetEl();
      if (!el) return;
      const addForm = createEl(doc, "div", { className: cls("css-add-rule") });
      const selInput = createEl(doc, "input", { className: cls("control"), attrs: { type: "text", placeholder: "selector, e.g. .my-class", [ATTR_IGNORE]: "" } });
      const addBtn = createEl(doc, "button", { className: cls("btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: "Add rule" });
      const submit = () => {
        const selector = selInput.value.trim();
        if (!selector) return;
        const addr = addCssRule(state, selector);
        if (addr) addedRules.push({ address: addr, selectorText: selector });
        selInput.value = "";
      };
      addBtn.addEventListener("click", submit);
      selInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      addForm.appendChild(selInput);
      addForm.appendChild(addBtn);
      body.appendChild(addForm);
      const liveAdded = addedRules.filter((r) => resolveRule(doc, r.address.sheetIndex, r.address.mediaPath, r.address.ruleIndex));
      addedRules.length = 0;
      addedRules.push(...liveAdded);
      if (liveAdded.length) {
        body.appendChild(createEl(doc, "div", { className: cls("css-section-title"), text: "Added rules" }));
        for (const r of liveAdded) {
          const rule = resolveRule(doc, r.address.sheetIndex, r.address.mediaPath, r.address.ruleIndex);
          const props = [];
          for (let i = 0; i < rule.style.length; i++) {
            const name = rule.style[i];
            props.push({ name, value: rule.style.getPropertyValue(name), priority: rule.style.getPropertyPriority(name) });
          }
          body.appendChild(ruleBlock(r.address, rule.selectorText, null, null, props, true));
        }
      }
      const addedKeys = new Set(liveAdded.map((r) => `${r.address.sheetIndex}:${r.address.mediaPath.join(".")}:${r.address.ruleIndex}`));
      const { matched, inaccessible } = getMatchingRules(doc, el);
      const shown = matched.filter((m) => !addedKeys.has(`${m.sheetIndex}:${m.mediaPath.join(".")}:${m.ruleIndex}`));
      body.appendChild(createEl(doc, "div", { className: cls("css-section-title"), text: "Matching rules" }));
      if (!shown.length) {
        body.appendChild(createEl(doc, "div", { className: cls("css-empty"), text: "No stylesheet rules match this element." }));
      }
      for (const m of shown) {
        const address = { sheetIndex: m.sheetIndex, mediaPath: m.mediaPath, ruleIndex: m.ruleIndex };
        body.appendChild(ruleBlock(address, m.selectorText, m.specificity, m.conditionText, m.properties, true));
      }
      if (inaccessible.length) {
        const note = createEl(doc, "div", { className: cls("css-note") });
        note.textContent = `${inaccessible.length} cross-origin stylesheet(s) can't be read or edited (CORS): ` + inaccessible.map((s) => s.href).join(", ");
        body.appendChild(note);
      }
    }
    let lastEl = null;
    let lastIndex = -2;
    function reposition() {
      const el = targetEl();
      if (!el || !isOpen()) return;
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function show() {
      if (!targetEl()) return;
      panel.style.display = "block";
      lastEl = targetEl();
      lastIndex = state.currentIndex;
      render();
      positionNear(panel, targetEl().getBoundingClientRect(), win);
    }
    function hide() {
      panel.style.display = "none";
    }
    function isOpen() {
      return panel.style.display !== "none";
    }
    const debouncedRescan = debounce(() => {
      if (!state.isEditModeEnabled || !isOpen() || !targetEl()) return;
      lastEl = targetEl();
      lastIndex = state.currentIndex;
      render();
    }, state.config.debounceMs);
    subscribe(state, () => {
      if (!state.isEditModeEnabled || !targetEl()) {
        hide();
        return;
      }
      if (!isOpen()) return;
      const el = targetEl();
      if (el === lastEl && state.currentIndex === lastIndex) return;
      debouncedRescan();
    });
    win.addEventListener("scroll", reposition, true);
    win.addEventListener("resize", reposition);
    return { el: panel, show, hide, isOpen };
  }

  // src/css/nl-parser.js
  var NAMED_COLORS = {
    black: "#000000",
    white: "#ffffff",
    red: "#e53935",
    green: "#43a047",
    blue: "#1e88e5",
    yellow: "#fdd835",
    orange: "#fb8c00",
    purple: "#8e24aa",
    pink: "#ec407a",
    gray: "#9e9e9e",
    grey: "#9e9e9e",
    brown: "#6d4c41",
    cyan: "#00acc1",
    teal: "#00897b",
    navy: "#1a237e",
    gold: "#c9a227",
    silver: "#bdbdbd",
    maroon: "#800000",
    olive: "#808000",
    lime: "#c0ca33",
    indigo: "#3f51b5",
    violet: "#7e57c2",
    coral: "#ff7f50",
    crimson: "#dc143c",
    turquoise: "#26c6da",
    transparent: "transparent",
    dark: "#222222",
    light: "#f5f5f5"
  };
  function findColors(text) {
    const found = [];
    const hexes = text.match(/#[0-9a-f]{3,8}\b/gi);
    if (hexes) found.push(...hexes);
    const rgbs = text.match(/rgba?\([^)]*\)/gi);
    if (rgbs) found.push(...rgbs);
    for (const name of Object.keys(NAMED_COLORS)) {
      if (new RegExp(`\\b${name}\\b`).test(text)) found.push(NAMED_COLORS[name]);
    }
    return found;
  }
  function firstColor(text) {
    return findColors(text)[0] || null;
  }
  function firstLength(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(px|rem|em|%|pt)?/);
    if (!m) return null;
    return `${m[1]}${m[2] || "px"}`;
  }
  function findSide(text) {
    if (/\b(all sides|around|every side|all around)\b/.test(text)) return "all";
    if (/\b(top|upper)\b/.test(text)) return "top";
    if (/\bright(?:\s*(?:side|hand))?\b/.test(text)) return "right";
    if (/\b(bottom|lower|underneath|below)\b/.test(text)) return "bottom";
    if (/\bleft(?:\s*(?:side|hand))?\b/.test(text)) return "left";
    return null;
  }
  function borderStyle(text) {
    if (/\bdash/.test(text)) return "dashed";
    if (/\bdot/.test(text)) return "dotted";
    if (/\bdouble\b/.test(text)) return "double";
    if (/\bgroove\b/.test(text)) return "groove";
    if (/\bridge\b/.test(text)) return "ridge";
    return "solid";
  }
  function borderThickness(text) {
    const len = firstLength(text);
    if (len) return len;
    if (/\b(very thick|extra thick|heavy|bold border)\b/.test(text)) return "6px";
    if (/\bthick\b/.test(text)) return "4px";
    if (/\b(thin|hairline|light)\b/.test(text)) return "1px";
    if (/\bmedium\b/.test(text)) return "3px";
    return "2px";
  }
  function parseNaturalLanguage(input) {
    const t = ` ${input.toLowerCase()} `;
    const decl = [];
    const color = firstColor(t);
    const side = findSide(t);
    const hasBorder = /\b(border|outline|stroke)\b/.test(t);
    const hasBg = /\b(background|bg|fill|backdrop)\b/.test(t);
    if (hasBorder) {
      const w = borderThickness(t);
      const style = borderStyle(t);
      const c = hasBorder && color || "#333333";
      const prop = side && side !== "all" ? `border-${side}` : "border";
      decl.push({ property: prop, value: `${w} ${style} ${c}` });
    }
    if (/\b(rounded|round corners?|border[- ]?radius|pill|circle|circular)\b/.test(t)) {
      let r = "10px";
      if (/\b(circle|circular)\b/.test(t)) r = "50%";
      else if (/\bpill\b/.test(t)) r = "999px";
      else if (/\b(very|extra|fully|super)\b/.test(t)) r = "24px";
      else if (/\b(slightly|a little|subtle|small)\b/.test(t)) r = "4px";
      if (/radius/.test(t)) {
        const len = firstLength(t);
        if (len) r = len;
      }
      decl.push({ property: "border-radius", value: r });
    }
    if (/\bshadow\b/.test(t)) {
      if (/\btext shadow\b/.test(t)) {
        decl.push({ property: "text-shadow", value: "1px 1px 2px rgba(0,0,0,0.4)" });
      } else {
        let v = "0 4px 12px rgba(0,0,0,0.2)";
        if (/\b(soft|light|subtle|slight)\b/.test(t)) v = "0 2px 8px rgba(0,0,0,0.15)";
        else if (/\b(strong|heavy|big|large|deep)\b/.test(t)) v = "0 8px 24px rgba(0,0,0,0.35)";
        decl.push({ property: "box-shadow", value: v });
      }
    }
    if (hasBg) {
      if (/\bgradient\b/.test(t)) {
        const cs = findColors(t);
        decl.push({ property: "background-image", value: `linear-gradient(135deg, ${cs[0] || "#4c9ffe"}, ${cs[1] || "#8a5cf6"})` });
      } else if (color) {
        decl.push({ property: "background-color", value: color });
      }
    }
    const wantsTextColor = /\b(text colou?r|font colou?r|colou?r of (?:the )?text)\b/.test(t) || color && /\b(text|font|word|letter)\b/.test(t) && !hasBorder && !hasBg || color && /\bcolou?r\b/.test(t) && !hasBorder && !hasBg;
    if (wantsTextColor && color) decl.push({ property: "color", value: color });
    if (/\b(bigger|larger|large text|big text|increase (?:the )?(?:font|text) size|font size|text size)\b/.test(t)) {
      const len = firstLength(t);
      decl.push({ property: "font-size", value: len || (/\b(huge|massive|very (?:big|large))\b/.test(t) ? "32px" : "20px") });
    } else if (/\b(smaller|small text|tiny|reduce (?:the )?(?:font|text) size)\b/.test(t)) {
      decl.push({ property: "font-size", value: firstLength(t) || "12px" });
    }
    if (/\b(bold|bolder|strong)\b/.test(t)) decl.push({ property: "font-weight", value: "700" });
    if (/\b(italic|slanted)\b/.test(t)) decl.push({ property: "font-style", value: "italic" });
    if (/\bunderline\b/.test(t)) decl.push({ property: "text-decoration", value: "underline" });
    if (/\b(uppercase|all caps|capital)\b/.test(t)) decl.push({ property: "text-transform", value: "uppercase" });
    if (/\b(center|centre|middle)\b/.test(t) && /\b(text|align|content)\b/.test(t)) decl.push({ property: "text-align", value: "center" });
    if (/\b(align|to the) right\b/.test(t) && /\btext\b/.test(t)) decl.push({ property: "text-align", value: "right" });
    if (/\b(padding|space inside|inner space|breathing room|roomy)\b/.test(t)) {
      const len = firstLength(t) || (/\b(more|lots|large|big)\b/.test(t) ? "24px" : "12px");
      decl.push({ property: side && side !== "all" ? `padding-${side}` : "padding", value: len });
    }
    if (/\b(margin|space outside|outer space|gap around|push away)\b/.test(t)) {
      const len = firstLength(t) || "16px";
      decl.push({ property: side && side !== "all" ? `margin-${side}` : "margin", value: len });
    }
    const wm = t.match(/\bwidth\s*(?:of|to|=|:)?\s*(\d+(?:\.\d+)?)\s*(px|rem|em|%)?/);
    if (wm) decl.push({ property: "width", value: `${wm[1]}${wm[2] || "px"}` });
    const hm = t.match(/\bheight\s*(?:of|to|=|:)?\s*(\d+(?:\.\d+)?)\s*(px|rem|em|%)?/);
    if (hm) decl.push({ property: "height", value: `${hm[1]}${hm[2] || "px"}` });
    if (/\bfull width\b/.test(t)) decl.push({ property: "width", value: "100%" });
    if (/\b(pointer|clickable|hand cursor)\b/.test(t)) decl.push({ property: "cursor", value: "pointer" });
    if (/\b(see-through|semi-transparent|faded)\b/.test(t)) decl.push({ property: "opacity", value: "0.6" });
    const declarations = dedupe(decl);
    const summary = declarations.length ? declarations.map((d2) => `${d2.property}: ${d2.value}`).join("; ") : "";
    return { declarations, summary };
  }
  function dedupe(decls) {
    const seen = /* @__PURE__ */ new Map();
    for (const d2 of decls) seen.set(d2.property, d2);
    return [...seen.values()];
  }

  // src/css/style-suggestions.js
  var d = (obj) => Object.entries(obj).map(([property, value]) => ({ property, value }));
  var HEADING = [
    { label: "Bold & dark", decl: d({ "font-weight": "800", color: "#1a1a1a" }) },
    { label: "Underline accent", decl: d({ "border-bottom": "3px solid #2f6fed", "padding-bottom": "6px", display: "inline-block" }) },
    { label: "Uppercase spaced", decl: d({ "text-transform": "uppercase", "letter-spacing": "2px", "font-size": "18px" }) },
    { label: "Gradient text", decl: d({ "background-image": "linear-gradient(90deg,#2f6fed,#8a5cf6)", "-webkit-background-clip": "text", "background-clip": "text", "-webkit-text-fill-color": "transparent", color: "transparent" }) },
    { label: "Centered", decl: d({ "text-align": "center" }) },
    { label: "Left bar accent", decl: d({ "border-left": "5px solid #2f6fed", "padding-left": "12px" }) },
    { label: "Hero size", decl: d({ "font-size": "44px", "line-height": "1.1", "font-weight": "800" }) },
    { label: "Soft shadow", decl: d({ "text-shadow": "0 2px 6px rgba(0,0,0,0.25)" }) },
    { label: "Brand blue", decl: d({ color: "#2f6fed" }) },
    { label: "Badge", decl: d({ background: "#eef3ff", color: "#2f6fed", padding: "6px 14px", "border-radius": "999px", display: "inline-block", "font-size": "16px" }) }
  ];
  var TEXT = [
    { label: "Muted gray", decl: d({ color: "#6b7280" }) },
    { label: "Readable large", decl: d({ "font-size": "18px", "line-height": "1.7" }) },
    { label: "Justified", decl: d({ "text-align": "justify" }) },
    { label: "Highlight", decl: d({ "background-color": "#fff3bf", padding: "2px 6px", "border-radius": "4px" }) },
    { label: "Italic soft", decl: d({ "font-style": "italic", color: "#555" }) },
    { label: "Letter spaced", decl: d({ "letter-spacing": "1px" }) },
    { label: "Narrow column", decl: d({ "max-width": "520px" }) },
    { label: "Lead paragraph", decl: d({ "font-size": "20px", color: "#374151", "line-height": "1.6" }) },
    { label: "Caption", decl: d({ "font-size": "13px", color: "#9ca3af" }) },
    { label: "Centered", decl: d({ "text-align": "center" }) }
  ];
  var BUTTON = [
    { label: "Primary", decl: d({ background: "#2f6fed", color: "#fff", border: "none", padding: "10px 18px", "border-radius": "8px", cursor: "pointer" }) },
    { label: "Pill", decl: d({ "border-radius": "999px", padding: "10px 22px" }) },
    { label: "Outline", decl: d({ background: "transparent", color: "#2f6fed", border: "2px solid #2f6fed", padding: "9px 18px", "border-radius": "8px", cursor: "pointer" }) },
    { label: "Gradient", decl: d({ "background-image": "linear-gradient(135deg,#2f6fed,#8a5cf6)", color: "#fff", border: "none", padding: "10px 18px", "border-radius": "8px", cursor: "pointer" }) },
    { label: "Large", decl: d({ "font-size": "18px", padding: "14px 28px" }) },
    { label: "Shadowed", decl: d({ "box-shadow": "0 4px 14px rgba(47,111,237,0.4)" }) },
    { label: "Danger", decl: d({ background: "#e53935", color: "#fff", border: "none", padding: "10px 18px", "border-radius": "8px", cursor: "pointer" }) },
    { label: "Success", decl: d({ background: "#43a047", color: "#fff", border: "none", padding: "10px 18px", "border-radius": "8px", cursor: "pointer" }) },
    { label: "Ghost", decl: d({ background: "transparent", border: "none", color: "#374151", padding: "8px 12px", cursor: "pointer" }) },
    { label: "Full width", decl: d({ width: "100%", display: "block" }) }
  ];
  var INPUT = [
    { label: "Rounded", decl: d({ border: "1px solid #cbd5e1", "border-radius": "8px", padding: "10px 12px" }) },
    { label: "Underline only", decl: d({ border: "none", "border-bottom": "2px solid #cbd5e1", "border-radius": "0", padding: "8px 2px" }) },
    { label: "Pill", decl: d({ "border-radius": "999px", padding: "10px 18px", border: "1px solid #cbd5e1" }) },
    { label: "Focus glow", decl: d({ border: "1px solid #2f6fed", "box-shadow": "0 0 0 3px rgba(47,111,237,0.2)", "border-radius": "8px", padding: "10px 12px" }) },
    { label: "Roomy", decl: d({ padding: "14px 16px", "font-size": "16px" }) },
    { label: "Soft gray", decl: d({ background: "#f3f4f6", border: "1px solid #e5e7eb", "border-radius": "8px", padding: "10px 12px" }) },
    { label: "Error", decl: d({ border: "2px solid #e53935", "border-radius": "8px", padding: "10px 12px" }) },
    { label: "Success", decl: d({ border: "2px solid #43a047", "border-radius": "8px", padding: "10px 12px" }) },
    { label: "Full width", decl: d({ width: "100%" }) },
    { label: "Monospace", decl: d({ "font-family": "Consolas, monospace" }) }
  ];
  var IMAGE = [
    { label: "Rounded", decl: d({ "border-radius": "12px" }) },
    { label: "Circle", decl: d({ "border-radius": "50%" }) },
    { label: "Bordered", decl: d({ border: "4px solid #fff", "box-shadow": "0 0 0 1px #e5e7eb" }) },
    { label: "Card shadow", decl: d({ "border-radius": "12px", "box-shadow": "0 8px 24px rgba(0,0,0,0.18)" }) },
    { label: "Small", decl: d({ width: "160px", height: "auto" }) },
    { label: "Medium", decl: d({ width: "320px", height: "auto" }) },
    { label: "Large", decl: d({ width: "640px", height: "auto" }) },
    { label: "Full width", decl: d({ width: "100%", height: "auto" }) },
    { label: "Grayscale", decl: d({ filter: "grayscale(100%)" }) },
    { label: "Thumbnail", decl: d({ width: "120px", height: "120px", "object-fit": "cover", "border-radius": "8px" }) }
  ];
  var CONTAINER = [
    { label: "Card", decl: d({ border: "1px solid #e5e7eb", "border-radius": "12px", padding: "20px", "box-shadow": "0 4px 14px rgba(0,0,0,0.08)", background: "#fff" }) },
    { label: "Bordered box", decl: d({ border: "2px solid #cbd5e1", "border-radius": "8px", padding: "16px" }) },
    { label: "Light panel", decl: d({ background: "#f8fafc", "border-radius": "10px", padding: "20px" }) },
    { label: "Gradient", decl: d({ "background-image": "linear-gradient(135deg,#2f6fed,#8a5cf6)", color: "#fff", padding: "24px", "border-radius": "12px" }) },
    { label: "Rounded", decl: d({ "border-radius": "16px", overflow: "hidden" }) },
    { label: "Center content", decl: d({ display: "flex", "align-items": "center", "justify-content": "center", gap: "12px" }) },
    { label: "Padded", decl: d({ padding: "32px" }) },
    { label: "Elevated", decl: d({ "box-shadow": "0 12px 32px rgba(0,0,0,0.15)", "border-radius": "12px" }) },
    { label: "Banner", decl: d({ background: "#eef3ff", "border-radius": "999px", padding: "14px 28px", "text-align": "center" }) },
    { label: "Hero", decl: d({ padding: "64px 24px", "text-align": "center", "background-image": "linear-gradient(135deg,#1e3a8a,#2f6fed)", color: "#fff" }) }
  ];
  var LINK = [
    { label: "Blue underline", decl: d({ color: "#2f6fed", "text-decoration": "underline" }) },
    { label: "No underline", decl: d({ "text-decoration": "none" }) },
    { label: "Button-like", decl: d({ background: "#2f6fed", color: "#fff", padding: "8px 16px", "border-radius": "8px", "text-decoration": "none", display: "inline-block" }) },
    { label: "Bold colored", decl: d({ "font-weight": "700", color: "#2f6fed" }) },
    { label: "Muted", decl: d({ color: "#6b7280", "text-decoration": "none" }) },
    { label: "Pill badge", decl: d({ background: "#eef3ff", color: "#2f6fed", padding: "4px 12px", "border-radius": "999px", "text-decoration": "none" }) },
    { label: "Uppercase small", decl: d({ "text-transform": "uppercase", "font-size": "12px", "letter-spacing": "1px" }) },
    { label: "Large", decl: d({ "font-size": "18px" }) },
    { label: "Outlined", decl: d({ border: "1px solid #2f6fed", color: "#2f6fed", padding: "6px 14px", "border-radius": "8px", "text-decoration": "none", display: "inline-block" }) },
    { label: "Underline thick", decl: d({ "text-decoration": "underline", "text-decoration-thickness": "3px" }) }
  ];
  var LIST = [
    { label: "No bullets", decl: d({ "list-style": "none", padding: "0" }) },
    { label: "Spaced items", decl: d({ "line-height": "2" }) },
    { label: "Indented", decl: d({ "padding-left": "28px" }) },
    { label: "Colored markers", decl: d({ color: "#2f6fed" }) },
    { label: "Large text", decl: d({ "font-size": "18px" }) },
    { label: "Card", decl: d({ background: "#f8fafc", "border-radius": "8px", padding: "12px 16px" }) },
    { label: "Bordered", decl: d({ border: "1px solid #e5e7eb", "border-radius": "8px", padding: "12px" }) },
    { label: "Inline row", decl: d({ display: "flex", gap: "16px", "list-style": "none", padding: "0" }) },
    { label: "Compact", decl: d({ "line-height": "1.3", margin: "0" }) },
    { label: "Muted", decl: d({ color: "#6b7280" }) }
  ];
  var GENERIC = [
    { label: "Rounded corners", decl: d({ "border-radius": "10px" }) },
    { label: "Soft shadow", decl: d({ "box-shadow": "0 4px 14px rgba(0,0,0,0.12)" }) },
    { label: "Add padding", decl: d({ padding: "16px" }) },
    { label: "Light border", decl: d({ border: "1px solid #e5e7eb" }) },
    { label: "Muted text", decl: d({ color: "#6b7280" }) },
    { label: "Centered text", decl: d({ "text-align": "center" }) }
  ];
  var CATEGORY_BY_TAG = {
    h1: HEADING,
    h2: HEADING,
    h3: HEADING,
    h4: HEADING,
    h5: HEADING,
    h6: HEADING,
    p: TEXT,
    span: TEXT,
    blockquote: TEXT,
    label: TEXT,
    button: BUTTON,
    input: INPUT,
    textarea: INPUT,
    select: INPUT,
    img: IMAGE,
    div: CONTAINER,
    section: CONTAINER,
    article: CONTAINER,
    header: CONTAINER,
    footer: CONTAINER,
    main: CONTAINER,
    a: LINK,
    ul: LIST,
    ol: LIST,
    li: LIST
  };
  function getSuggestionsForElement(el) {
    const tag = el.tagName.toLowerCase();
    const specific = CATEGORY_BY_TAG[tag] || CONTAINER;
    return { tag, suggestions: [...specific, ...GENERIC] };
  }

  // src/ui/quick-style-panel.js
  function createQuickStylePanel(state) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const panel = createEl(doc, "div", {
      className: cls("panel") + " " + cls("quick-panel"),
      attrs: { [ATTR_IGNORE]: "", role: "region", "aria-label": "Style helper panel" }
    });
    panel.style.display = "none";
    const header = createEl(doc, "div", { className: cls("panel-header") });
    const titleEl = createEl(doc, "span", { text: "Style helper" });
    const closeBtn = createEl(doc, "button", { className: cls("panel-close"), attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Close panel" }, text: "\xD7" });
    closeBtn.addEventListener("click", hide);
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = createEl(doc, "div", { className: cls("panel-body") });
    panel.appendChild(body);
    state.editorRoot.appendChild(panel);
    function targetEl() {
      return state.selectedElements[0] || null;
    }
    function targetEls() {
      return state.selectedElements.filter((el) => el.isConnected);
    }
    function applyDeclarations(declarations, label) {
      const els = targetEls();
      if (els.length <= 1) {
        if (els[0]) applyStyleBatch(state, els[0], declarations, label);
      } else {
        applyStyleBatchToMany(state, els, declarations, label);
      }
    }
    const nlGroup = createEl(doc, "div", { className: cls("panel-group") });
    nlGroup.appendChild(createEl(doc, "div", { className: cls("panel-group-title"), text: "Describe a style" }));
    const nlInput = createEl(doc, "textarea", {
      className: cls("control") + " " + cls("nl-input"),
      attrs: { rows: "2", placeholder: 'e.g. "black dashed border on the right, thick" or "rounded with a soft shadow"', [ATTR_IGNORE]: "" }
    });
    const nlHint = createEl(doc, "div", { className: cls("nl-hint") });
    const applyBtn = createEl(doc, "button", { className: cls("btn") + " " + cls("btn-active"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: "Apply" });
    async function applyNl() {
      const el = targetEl();
      if (!el) return;
      const text = nlInput.value.trim();
      if (!text) return;
      let declarations = null;
      if (state.config.onAiStyle) {
        applyBtn.disabled = true;
        applyBtn.textContent = "Thinking\u2026";
        try {
          declarations = await state.config.onAiStyle(text, { tag: el.tagName.toLowerCase(), currentStyles: listInlineStyles(el) });
        } catch (err) {
          nlHint.textContent = "AI request failed \u2014 using built-in parser.";
        } finally {
          applyBtn.disabled = false;
          applyBtn.textContent = "Apply";
        }
      }
      if (!declarations || !declarations.length) {
        declarations = parseNaturalLanguage(text).declarations;
      }
      if (!declarations.length) {
        nlHint.textContent = "Couldn't map that to CSS. Try words like border, rounded, shadow, padding, bigger, blue.";
        return;
      }
      nlHint.textContent = "Applied: " + declarations.map((x) => `${x.property}: ${x.value}`).join("; ");
      applyDeclarations(declarations, "describe: " + text.slice(0, 40));
      nlInput.value = "";
    }
    applyBtn.addEventListener("click", applyNl);
    nlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) applyNl();
    });
    nlGroup.appendChild(nlInput);
    nlGroup.appendChild(applyBtn);
    nlGroup.appendChild(nlHint);
    body.appendChild(nlGroup);
    const sugGroup = createEl(doc, "div", { className: cls("panel-group") });
    sugGroup.appendChild(createEl(doc, "div", { className: cls("panel-group-title"), text: "Suggestions" }));
    const sugGrid = createEl(doc, "div", { className: cls("sug-grid") });
    sugGroup.appendChild(sugGrid);
    body.appendChild(sugGroup);
    const appliedGroup = createEl(doc, "div", { className: cls("panel-group") });
    appliedGroup.appendChild(createEl(doc, "div", { className: cls("panel-group-title"), text: "Applied styles" }));
    const appliedList = createEl(doc, "div", { className: cls("applied-list") });
    appliedGroup.appendChild(appliedList);
    body.appendChild(appliedGroup);
    function renderSuggestions(el) {
      sugGrid.innerHTML = "";
      const { suggestions } = getSuggestionsForElement(el);
      for (const s of suggestions) {
        const chip = createEl(doc, "button", { className: cls("sug-chip"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: s.label });
        chip.addEventListener("click", () => applyDeclarations(s.decl, "suggestion: " + s.label));
        sugGrid.appendChild(chip);
      }
    }
    function renderApplied(el) {
      appliedList.innerHTML = "";
      const styles = listInlineStyles(el);
      if (!styles.length) {
        appliedList.appendChild(createEl(doc, "div", { className: cls("css-empty"), text: "No inline styles on this element yet." }));
        return;
      }
      for (const s of styles) {
        const row = createEl(doc, "div", { className: cls("applied-row") });
        row.appendChild(createEl(doc, "span", { className: cls("applied-name"), text: s.name }));
        row.appendChild(createEl(doc, "span", { className: cls("applied-value"), text: s.value }));
        const rm = createEl(doc, "button", { className: cls("applied-remove"), attrs: { type: "button", [ATTR_IGNORE]: "", title: "Remove", "aria-label": `Remove ${s.name}` }, text: "\xD7" });
        rm.addEventListener("click", () => {
          const target = targetEl();
          if (target) removeInlineStyle(state, target, s.name);
        });
        row.appendChild(rm);
        appliedList.appendChild(row);
      }
    }
    let lastEl = null;
    let lastIndex = -2;
    function render() {
      const el = targetEl();
      if (!el) return;
      lastEl = el;
      lastIndex = state.currentIndex;
      const count = targetEls().length;
      titleEl.textContent = count > 1 ? `Style helper (${count} selected)` : "Style helper";
      renderSuggestions(el);
      renderApplied(el);
    }
    function reposition() {
      const el = targetEl();
      if (!el || !isOpen()) return;
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function show() {
      if (!targetEl()) return;
      panel.style.display = "block";
      render();
      positionNear(panel, targetEl().getBoundingClientRect(), win);
    }
    function hide() {
      panel.style.display = "none";
    }
    function isOpen() {
      return panel.style.display !== "none";
    }
    subscribe(state, () => {
      if (!state.isEditModeEnabled || !targetEl()) {
        hide();
        return;
      }
      if (!isOpen()) return;
      const el = targetEl();
      if (el === lastEl && state.currentIndex === lastIndex) return;
      render();
    });
    win.addEventListener("scroll", reposition, true);
    win.addEventListener("resize", reposition);
    return { el: panel, show, hide, isOpen };
  }

  // src/dom/element-factory.js
  var ELEMENT_CATEGORIES = [
    {
      name: "Text",
      items: [
        { tag: "h1", label: "Heading 1" },
        { tag: "h2", label: "Heading 2" },
        { tag: "h3", label: "Heading 3" },
        { tag: "h4", label: "Heading 4" },
        { tag: "h5", label: "Heading 5" },
        { tag: "h6", label: "Heading 6" },
        { tag: "p", label: "Paragraph" },
        { tag: "span", label: "Span" },
        { tag: "blockquote", label: "Quote" },
        { tag: "a", label: "Link" }
      ]
    },
    {
      name: "Media",
      items: [
        { tag: "img", label: "Image" },
        { tag: "hr", label: "Divider" }
      ]
    },
    {
      name: "Form",
      items: [
        { tag: "input", label: "Input" },
        { tag: "textarea", label: "Textarea" },
        { tag: "button", label: "Button" },
        { tag: "label", label: "Label" }
      ]
    },
    {
      name: "Layout",
      items: [
        { tag: "div", label: "Container" },
        { tag: "section", label: "Section" },
        { tag: "ul", label: "Bullet list" },
        { tag: "ol", label: "Numbered list" },
        { tag: "li", label: "List item" }
      ]
    }
  ];
  var PLACEHOLDER_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="#e2e6ee"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#8a93a6" text-anchor="middle" dominant-baseline="middle">Click to set image</text></svg>'
  );
  function createDefaultElement(doc, tag) {
    const el = doc.createElement(tag);
    switch (tag) {
      case "p":
        el.textContent = 'New paragraph. Click "Edit text" to change this.';
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        el.textContent = "New heading";
        break;
      case "span":
        el.textContent = "new span";
        break;
      case "blockquote":
        el.textContent = "A memorable quote goes here.";
        break;
      case "a":
        el.textContent = "link text";
        el.setAttribute("href", "#");
        break;
      case "div":
        el.textContent = "New container";
        el.style.padding = "16px";
        el.style.border = "1px dashed #c3c9d4";
        break;
      case "section":
        el.textContent = "New section";
        el.style.padding = "24px";
        break;
      case "ul":
      case "ol":
        el.appendChild(makeLi(doc, "List item one"));
        el.appendChild(makeLi(doc, "List item two"));
        break;
      case "li":
        el.textContent = "List item";
        break;
      case "img":
        el.setAttribute("src", PLACEHOLDER_IMG);
        el.setAttribute("alt", "Placeholder image");
        el.style.maxWidth = "100%";
        el.style.display = "block";
        break;
      case "hr":
        break;
      case "input":
        el.setAttribute("type", "text");
        el.setAttribute("placeholder", "Enter text");
        break;
      case "textarea":
        el.setAttribute("placeholder", "Enter text");
        el.setAttribute("rows", "3");
        break;
      case "button":
        el.textContent = "Button";
        break;
      case "label":
        el.textContent = "Label";
        break;
      default:
        el.textContent = "New element";
    }
    return el;
  }
  function makeLi(doc, text) {
    const li = doc.createElement("li");
    li.textContent = text;
    return li;
  }

  // src/ui/elements-palette.js
  function resolvePlacement(state) {
    const el = state.selectedElements[0];
    if (!el) {
      return { parentPath: [], index: getEditableChildren(state.root).length };
    }
    const tag = el.tagName.toLowerCase();
    if (state.config.containerTags.has(tag)) {
      const parentPath2 = toPath(el, state.root);
      if (!parentPath2) return null;
      return { parentPath: parentPath2, index: getEditableChildren(el).length };
    }
    const parent = el.parentElement;
    const parentPath = toPath(parent, state.root);
    if (!parentPath) return null;
    const index = getEditableChildren(parent).indexOf(el) + 1;
    return { parentPath, index };
  }
  function createElementsPalette(state, modeController, hooks = {}) {
    const doc = state.editorRoot.ownerDocument;
    const side = state.config.paletteSide === "left" ? "left" : "right";
    const panel = createEl(doc, "aside", {
      className: `${cls("palette")} ${cls(`palette-${side}`)}`,
      attrs: { [ATTR_IGNORE]: "", role: "region", "aria-label": "Add elements panel" }
    });
    const tab = createEl(doc, "button", {
      className: cls("palette-tab"),
      attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Toggle elements panel" },
      text: "Elements"
    });
    tab.addEventListener("click", () => setCollapsed(!collapsed));
    const inner = createEl(doc, "div", { className: cls("palette-inner") });
    const title = createEl(doc, "div", { className: cls("palette-title"), text: "Add elements" });
    inner.appendChild(title);
    for (const category of ELEMENT_CATEGORIES) {
      const section = createEl(doc, "div", { className: cls("palette-section") });
      section.appendChild(createEl(doc, "div", { className: cls("palette-section-title"), text: category.name }));
      const grid = createEl(doc, "div", { className: cls("palette-grid") });
      for (const { tag, label } of category.items) {
        const item = createEl(doc, "button", {
          className: cls("palette-item"),
          attrs: { type: "button", [ATTR_IGNORE]: "", title: `<${tag}>` },
          text: label
        });
        item.addEventListener("click", () => insert(tag));
        grid.appendChild(item);
      }
      section.appendChild(grid);
      inner.appendChild(section);
    }
    panel.appendChild(tab);
    panel.appendChild(inner);
    state.editorRoot.appendChild(panel);
    let collapsed = true;
    function setCollapsed(next) {
      collapsed = next;
      panel.classList.toggle(cls("palette-collapsed"), collapsed);
      if (side === "right") state.editorRoot.classList.toggle(cls("palette-open"), !collapsed);
      tab.setAttribute("aria-expanded", String(!collapsed));
    }
    setCollapsed(true);
    function insert(tag) {
      const placement = resolvePlacement(state);
      if (!placement) return;
      const node = createDefaultElement(doc, tag);
      addElement(state, placement.parentPath, placement.index, node);
      const parentEl = fromPath(placement.parentPath, state.root);
      const inserted = parentEl && getEditableChildren(parentEl)[placement.index];
      if (inserted) {
        modeController.selectElement(state, inserted);
        if (tag === "img" && hooks.onImageInserted) hooks.onImageInserted(inserted);
      }
    }
    return {
      el: panel,
      open: () => setCollapsed(false),
      close: () => setCollapsed(true),
      toggle: () => setCollapsed(!collapsed),
      isOpen: () => !collapsed
    };
  }

  // src/dom/attribute-mutator.js
  function applyAttr(el, name, value) {
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
  registerHandler("set-attribute", {
    forward(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) applyAttr(el, entry.attribute, entry.newValue);
    },
    inverse(state, entry) {
      const el = fromPath(entry.elementPath, state.root);
      if (el) applyAttr(el, entry.attribute, entry.oldValue);
    }
  });
  function commitAttribute(state, el, attribute, newValue) {
    const oldValue = el.getAttribute(attribute);
    const normNew = newValue === "" ? null : newValue;
    if (oldValue === normNew) return;
    const path = toPath(el, state.root);
    if (!path) return;
    addChange(state, { type: "set-attribute", elementPath: path, attribute, oldValue, newValue: normNew });
  }

  // src/ui/image-panel.js
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  function createImagePanel(state) {
    const doc = state.editorRoot.ownerDocument;
    const win = doc.defaultView;
    const panel = createEl(doc, "div", {
      className: cls("panel") + " " + cls("image-panel"),
      attrs: { [ATTR_IGNORE]: "", role: "region", "aria-label": "Image panel" }
    });
    panel.style.display = "none";
    const header = createEl(doc, "div", { className: cls("panel-header"), text: "Image" });
    const closeBtn = createEl(doc, "button", { className: cls("panel-close"), attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Close panel" }, text: "\xD7" });
    closeBtn.addEventListener("click", hide);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = createEl(doc, "div", { className: cls("panel-body") });
    panel.appendChild(body);
    const refreshers = [];
    function targetEl() {
      const el = state.selectedElements[0];
      return el && el.tagName.toLowerCase() === "img" ? el : null;
    }
    function group(labelText) {
      const g = createEl(doc, "div", { className: cls("panel-group") });
      g.appendChild(createEl(doc, "div", { className: cls("panel-group-title"), text: labelText }));
      body.appendChild(g);
      return g;
    }
    function addRow(parent, labelText, controlEl) {
      const row = createEl(doc, "label", { className: cls("field") });
      row.appendChild(createEl(doc, "span", { className: cls("field-label"), text: labelText }));
      row.appendChild(controlEl);
      parent.appendChild(row);
      return row;
    }
    const srcGroup = group("Source");
    const urlInput = createEl(doc, "input", { className: cls("control"), attrs: { type: "text", placeholder: "https://\u2026", [ATTR_IGNORE]: "" } });
    urlInput.addEventListener("change", () => {
      const el = targetEl();
      if (el && urlInput.value.trim()) commitAttribute(state, el, "src", urlInput.value.trim());
    });
    addRow(srcGroup, "URL", urlInput);
    const fileWrap = createEl(doc, "div", { className: cls("file-wrap") });
    const fileInput = createEl(doc, "input", { attrs: { type: "file", accept: "image/*", [ATTR_IGNORE]: "", "aria-label": "Upload local image" } });
    fileInput.className = cls("file-input");
    const fileLabel = createEl(doc, "span", { className: cls("btn") + " " + cls("file-btn"), text: "Upload local image" });
    fileWrap.appendChild(fileLabel);
    fileWrap.appendChild(fileInput);
    fileInput.addEventListener("change", async () => {
      const el = targetEl();
      const file = fileInput.files && fileInput.files[0];
      if (!el || !file) return;
      let url;
      try {
        url = state.config.onImageUpload ? await state.config.onImageUpload(file) : await readFileAsDataURL(file);
      } catch (err) {
        url = null;
      }
      if (url) commitAttribute(state, el, "src", url);
      fileInput.value = "";
    });
    srcGroup.appendChild(fileWrap);
    const altInput = createEl(doc, "input", { className: cls("control"), attrs: { type: "text", placeholder: "Alt text", [ATTR_IGNORE]: "" } });
    altInput.addEventListener("change", () => {
      const el = targetEl();
      if (el) commitAttribute(state, el, "alt", altInput.value);
    });
    addRow(srcGroup, "Alt", altInput);
    refreshers.push((el) => {
      const src = el.getAttribute("src") || "";
      urlInput.value = src.startsWith("data:") ? "" : src;
      altInput.value = el.getAttribute("alt") || "";
    });
    const sizeGroup = group("Size");
    function addStyleNumber(parent, labelText, prop, { unit = "px", min, max, step = 1 } = {}) {
      const input = createEl(doc, "input", { className: cls("control"), attrs: { type: "range", [ATTR_IGNORE]: "" } });
      if (min != null) input.min = min;
      if (max != null) input.max = max;
      input.step = step;
      let captured = null;
      input.addEventListener("input", () => {
        const el = targetEl();
        if (!el) return;
        if (captured === null) captured = readInlineValue(el, prop);
        previewStyle(el, prop, `${input.value}${unit}`);
      });
      input.addEventListener("change", () => {
        const el = targetEl();
        if (!el) return;
        commitStyle(state, el, prop, captured, `${input.value}${unit}`);
        captured = null;
      });
      addRow(parent, labelText, input);
      refreshers.push((el) => {
        const val = parseFloat(win.getComputedStyle(el).getPropertyValue(prop));
        if (Number.isFinite(val)) input.value = String(val);
      });
    }
    addStyleNumber(sizeGroup, "Width", "width", { unit: "px", min: 20, max: 1e3 });
    const presetRow = createEl(doc, "div", { className: cls("preset-row") });
    for (const [label, value] of [["S", "160px"], ["M", "320px"], ["L", "640px"], ["Full", "100%"]]) {
      const b = createEl(doc, "button", { className: cls("btn") + " " + cls("preset-btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: label });
      b.addEventListener("click", () => {
        const el = targetEl();
        if (el) commitStyle(state, el, "width", readInlineValue(el, "width"), value);
      });
      presetRow.appendChild(b);
    }
    sizeGroup.appendChild(presetRow);
    const shapeGroup = group("Shape & border");
    addStyleNumber(shapeGroup, "Corner radius", "border-radius", { unit: "px", min: 0, max: 400 });
    const circleRow = createEl(doc, "div", { className: cls("preset-row") });
    for (const [label, value] of [["Square", "0"], ["Rounded", "12px"], ["Circle", "50%"]]) {
      const b = createEl(doc, "button", { className: cls("btn") + " " + cls("preset-btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: label });
      b.addEventListener("click", () => {
        const el = targetEl();
        if (el) commitStyle(state, el, "border-radius", readInlineValue(el, "border-radius"), value);
      });
      circleRow.appendChild(b);
    }
    shapeGroup.appendChild(circleRow);
    addStyleNumber(shapeGroup, "Border width", "border-width", { unit: "px", min: 0, max: 40 });
    const borderColor = createEl(doc, "input", { className: cls("control") + " " + cls("control-color"), attrs: { type: "color", [ATTR_IGNORE]: "" } });
    let bcCaptured = null;
    borderColor.addEventListener("input", () => {
      const el = targetEl();
      if (!el) return;
      if (bcCaptured === null) bcCaptured = readInlineValue(el, "border-color");
      previewStyle(el, "border-style", "solid");
      previewStyle(el, "border-color", borderColor.value);
    });
    borderColor.addEventListener("change", () => {
      const el = targetEl();
      if (!el) return;
      commitStyle(state, el, "border-style", readInlineValue(el, "border-style"), "solid");
      commitStyle(state, el, "border-color", bcCaptured, borderColor.value);
      bcCaptured = null;
    });
    addRow(shapeGroup, "Border color", borderColor);
    const gradGroup = group("Background gradient");
    const gStart = createEl(doc, "input", { className: cls("control") + " " + cls("control-color"), attrs: { type: "color", [ATTR_IGNORE]: "" } });
    const gEnd = createEl(doc, "input", { className: cls("control") + " " + cls("control-color"), attrs: { type: "color", [ATTR_IGNORE]: "" } });
    gStart.value = "#4c9ffe";
    gEnd.value = "#8a5cf6";
    addRow(gradGroup, "From", gStart);
    addRow(gradGroup, "To", gEnd);
    const applyGrad = createEl(doc, "button", { className: cls("btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: "Apply gradient" });
    applyGrad.addEventListener("click", () => {
      const el = targetEl();
      if (!el) return;
      const value = `linear-gradient(135deg, ${gStart.value}, ${gEnd.value})`;
      commitStyle(state, el, "background-image", readInlineValue(el, "background-image"), value);
    });
    const clearGrad = createEl(doc, "button", { className: cls("btn"), attrs: { type: "button", [ATTR_IGNORE]: "" }, text: "Clear" });
    clearGrad.addEventListener("click", () => {
      const el = targetEl();
      if (el) commitStyle(state, el, "background-image", readInlineValue(el, "background-image"), null);
    });
    const gradBtns = createEl(doc, "div", { className: cls("preset-row") });
    gradBtns.appendChild(applyGrad);
    gradBtns.appendChild(clearGrad);
    gradGroup.appendChild(gradBtns);
    state.editorRoot.appendChild(panel);
    function refresh() {
      const el = targetEl();
      if (!el) return;
      for (const fn of refreshers) fn(el);
    }
    function reposition() {
      const el = targetEl();
      if (!el || !isOpen()) return;
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function show() {
      const el = targetEl();
      if (!el) return;
      panel.style.display = "block";
      refresh();
      positionNear(panel, el.getBoundingClientRect(), win);
    }
    function hide() {
      panel.style.display = "none";
    }
    function isOpen() {
      return panel.style.display !== "none";
    }
    subscribe(state, () => {
      if (!state.isEditModeEnabled || !targetEl()) {
        hide();
        return;
      }
      if (isOpen()) refresh();
    });
    win.addEventListener("scroll", reposition, true);
    win.addEventListener("resize", reposition);
    return { el: panel, show, hide, isOpen, isImageSelected: () => !!targetEl() };
  }

  // src/ui/breadcrumb-bar.js
  function describeElement(el) {
    let label = el.tagName.toLowerCase();
    if (el.id) label += `#${el.id}`;
    else if (el.classList.length) label += `.${el.classList[0]}`;
    return label;
  }
  function createBreadcrumbBar(state, modeController) {
    const doc = state.editorRoot.ownerDocument;
    const bar = createEl(doc, "nav", {
      className: cls("breadcrumb"),
      attrs: { [ATTR_IGNORE]: "", "aria-label": "Selected element ancestry" }
    });
    bar.style.display = "none";
    state.editorRoot.appendChild(bar);
    function render() {
      bar.innerHTML = "";
      const el = state.selectedElements[0];
      if (!el || state.selectedElements.length !== 1 || !el.isConnected) {
        bar.style.display = "none";
        return;
      }
      const chain = getAncestorChain(el, state.root);
      if (chain.length <= 1) {
        bar.style.display = "none";
        return;
      }
      bar.style.display = "flex";
      chain.forEach((node, i) => {
        if (i > 0) bar.appendChild(createEl(doc, "span", { className: cls("crumb-sep"), text: "\u203A" }));
        const isCurrent = node === el;
        const crumb = createEl(doc, "button", {
          className: cls("crumb") + (isCurrent ? " " + cls("crumb-current") : ""),
          attrs: { type: "button", [ATTR_IGNORE]: "", "aria-current": isCurrent ? "true" : "false" },
          text: describeElement(node)
        });
        crumb.addEventListener("click", () => modeController.selectElement(state, node));
        bar.appendChild(crumb);
      });
    }
    subscribe(state, () => {
      if (!state.isEditModeEnabled) {
        bar.style.display = "none";
        return;
      }
      render();
    });
    return { el: bar };
  }

  // src/ui/toast.js
  function createToastHost(editorRoot) {
    const doc = editorRoot.ownerDocument;
    const host = createEl(doc, "div", { className: cls("toast-host"), attrs: { [ATTR_IGNORE]: "" } });
    editorRoot.appendChild(host);
    function show(message, { type = "info", duration = 3500 } = {}) {
      const toast = createEl(doc, "div", { className: `${cls("toast")} ${cls("toast-" + type)}`, attrs: { [ATTR_IGNORE]: "", role: "status" }, text: message });
      host.appendChild(toast);
      void toast.offsetWidth;
      toast.classList.add(cls("toast-visible"));
      const remove = () => {
        toast.classList.remove(cls("toast-visible"));
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
        setTimeout(() => toast.remove(), 400);
      };
      const timer = setTimeout(remove, duration);
      toast.addEventListener("click", () => {
        clearTimeout(timer);
        remove();
      });
    }
    return {
      success: (msg, opts) => show(msg, { ...opts, type: "success" }),
      error: (msg, opts) => show(msg, { ...opts, type: "error", duration: opts && opts.duration || 6e3 }),
      info: (msg, opts) => show(msg, { ...opts, type: "info" })
    };
  }

  // src/ui/icons.js
  var icons = {
    pencil: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M3 17.25V21h3.75L17.81 10.19l-3.75-3.75L3 17.25z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12.56 7.94l3.75 3.75M11.06 9.44l3.75 3.75" stroke="#111" stroke-width="1.6"/>
  </svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/>
  </svg>`,
    maximize: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="5" y="5" width="14" height="14" stroke="currentColor" stroke-width="2.4"/>
  </svg>`,
    restore: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M9 9h10v10H9z" stroke="currentColor" stroke-width="2.2"/>
    <path d="M5 15V5h10" stroke="currentColor" stroke-width="2.2"/>
  </svg>`
  };
  function svg(doc, name, size = 20) {
    const wrap = doc.createElement("span");
    wrap.innerHTML = icons[name];
    const el = wrap.firstElementChild;
    el.setAttribute("width", String(size));
    el.setAttribute("height", String(size));
    return el;
  }

  // src/ui/launcher.js
  function createLauncher(editorRoot, { onOpen }) {
    const doc = editorRoot.ownerDocument;
    const btn = createEl(doc, "button", {
      className: cls("launcher"),
      attrs: { type: "button", [ATTR_IGNORE]: "", "aria-label": "Edit this page", title: "Edit this page" }
    });
    btn.appendChild(svg(doc, "pencil", 28));
    btn.addEventListener("click", () => onOpen());
    editorRoot.appendChild(btn);
    return {
      el: btn,
      // Disabled while the modal is open (double-open guard); re-enabled and
      // refocused when the modal fully closes.
      setOpen(open) {
        btn.disabled = open;
        if (!open) btn.focus();
      },
      destroy: () => btn.remove()
    };
  }

  // src/ui/confirm-dialog.js
  function confirmDialog(editorRoot, {
    title = "Unsaved changes",
    message,
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    danger = false
  } = {}) {
    const doc = editorRoot.ownerDocument;
    return new Promise((resolve) => {
      const backdrop = createEl(doc, "div", {
        className: cls("confirm-backdrop"),
        attrs: { [ATTR_IGNORE]: "" }
      });
      const card = createEl(doc, "div", {
        className: cls("confirm"),
        attrs: { [ATTR_IGNORE]: "", role: "alertdialog", "aria-modal": "true", "aria-label": title }
      });
      card.appendChild(createEl(doc, "div", { className: cls("confirm-header"), text: title }));
      card.appendChild(createEl(doc, "div", { className: cls("confirm-message"), text: message }));
      const actions = createEl(doc, "div", { className: cls("confirm-actions") });
      const cancelBtn = button(doc, cancelLabel, () => settle(false));
      const confirmBtn = button(doc, confirmLabel, () => settle(true), danger ? cls("btn-danger") : cls("btn-primary"));
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      card.appendChild(actions);
      function onKeydown(e) {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        e.preventDefault();
        settle(false);
      }
      doc.addEventListener("keydown", onKeydown, true);
      function settle(result) {
        doc.removeEventListener("keydown", onKeydown, true);
        backdrop.remove();
        card.remove();
        resolve(result);
      }
      editorRoot.appendChild(backdrop);
      editorRoot.appendChild(card);
      cancelBtn.focus();
    });
  }

  // src/ui/editor-modal.js
  var current = null;
  function openEditorModal(editorRoot, { url, onFullyClosed }) {
    if (current) return current;
    const doc = editorRoot.ownerDocument;
    const win = doc.defaultView;
    const backdrop = createEl(doc, "div", {
      className: cls("modal-backdrop"),
      attrs: { [ATTR_IGNORE]: "" }
    });
    const modal = createEl(doc, "div", {
      className: cls("modal"),
      attrs: { [ATTR_IGNORE]: "", role: "dialog", "aria-modal": "true", "aria-label": "Edit page" }
    });
    const header = createEl(doc, "div", { className: cls("modal-header") });
    header.appendChild(createEl(doc, "div", { className: cls("modal-title"), text: "Edit page" }));
    const actions = createEl(doc, "div", { className: cls("modal-actions") });
    const saveBtn = button(doc, "Save", onSaveClick, cls("btn-primary"));
    saveBtn.disabled = true;
    let maximized = false;
    const maxBtn = button(doc, "", onMaximizeClick, cls("modal-iconbtn"));
    maxBtn.setAttribute("aria-label", "Maximize");
    maxBtn.title = "Maximize";
    maxBtn.appendChild(svg(doc, "maximize", 16));
    const closeBtn = button(doc, "", () => {
      attemptClose();
    }, cls("modal-iconbtn"));
    closeBtn.setAttribute("aria-label", "Close editor");
    closeBtn.title = "Close";
    closeBtn.appendChild(svg(doc, "close", 16));
    actions.appendChild(saveBtn);
    actions.appendChild(maxBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);
    modal.appendChild(header);
    const body = createEl(doc, "div", { className: cls("modal-body") });
    const iframe = createEl(doc, "iframe", {
      className: cls("modal-frame"),
      attrs: { title: "Page editor" }
    });
    body.appendChild(iframe);
    modal.appendChild(body);
    let editorInstance = null;
    let didSave = false;
    let confirming = false;
    iframe.__etchrBridge = {
      requestClose: () => attemptClose(),
      notifyDirty: (dirty) => saveBtn.classList.toggle(cls("btn-attention"), dirty),
      notifySaved: () => {
        didSave = true;
      }
    };
    iframe.src = url;
    const loadTimeout = win.setTimeout(() => {
      if (!editorInstance) showError();
    }, 12e3);
    iframe.addEventListener("load", () => {
      win.clearTimeout(loadTimeout);
      const api = editorApi();
      editorInstance = api && api.getInstance ? api.getInstance() : null;
      if (editorInstance) saveBtn.disabled = false;
      else showError();
    });
    function editorApi() {
      try {
        return iframe.contentWindow ? iframe.contentWindow.VisualEditor : null;
      } catch {
        return null;
      }
    }
    function showError() {
      editorInstance = null;
      saveBtn.disabled = true;
      iframe.remove();
      const panel = createEl(doc, "div", { className: cls("modal-error") });
      panel.appendChild(createEl(doc, "div", { text: "Couldn't load the editor for this page." }));
      panel.appendChild(button(doc, "Close", () => teardown()));
      body.appendChild(panel);
    }
    async function onSaveClick() {
      if (!editorInstance) return;
      saveBtn.disabled = true;
      const prevLabel = saveBtn.textContent;
      saveBtn.textContent = "Saving\u2026";
      try {
        await editorInstance.save();
      } finally {
        saveBtn.textContent = prevLabel;
        saveBtn.disabled = false;
      }
    }
    function onMaximizeClick() {
      maximized = !maximized;
      modal.classList.toggle(cls("modal-max"), maximized);
      maxBtn.replaceChild(svg(doc, maximized ? "restore" : "maximize", 16), maxBtn.firstElementChild);
      const label = maximized ? "Restore size" : "Maximize";
      maxBtn.setAttribute("aria-label", label);
      maxBtn.title = label;
    }
    function isDirtySafe() {
      const api = editorApi();
      try {
        return !!(api && api.isDirty && api.isDirty());
      } catch {
        return false;
      }
    }
    async function attemptClose() {
      if (confirming) return;
      if (isDirtySafe()) {
        confirming = true;
        const discard = await confirmDialog(editorRoot, {
          title: "Unsaved changes",
          message: "Are you sure you want to close? There are unsaved changes.",
          confirmLabel: "Close without saving",
          cancelLabel: "Keep editing",
          danger: true
        });
        confirming = false;
        if (!discard) return;
      }
      teardown();
    }
    function onHostKeydown(e) {
      if (e.key === "Escape") attemptClose();
    }
    function onBeforeUnload(e) {
      if (isDirtySafe()) e.preventDefault();
    }
    doc.addEventListener("keydown", onHostKeydown);
    win.addEventListener("beforeunload", onBeforeUnload);
    const prevOverflow = doc.body.style.overflow;
    doc.body.style.overflow = "hidden";
    function teardown() {
      doc.removeEventListener("keydown", onHostKeydown);
      win.removeEventListener("beforeunload", onBeforeUnload);
      doc.body.style.overflow = prevOverflow;
      backdrop.remove();
      modal.remove();
      current = null;
      if (onFullyClosed) onFullyClosed();
      if (didSave) win.location.reload();
    }
    editorRoot.appendChild(backdrop);
    editorRoot.appendChild(modal);
    closeBtn.focus();
    current = { close: (force) => force ? teardown() : attemptClose(), isOpen: () => current !== null };
    return current;
  }

  // src/serialize/html-serializer.js
  var CONTENT_MARKER_ATTRS = [ATTR_EDITING, ATTR_CREATED_SHEET, "contenteditable"];
  function getCleanHTML(doc) {
    const clone = doc.documentElement.cloneNode(true);
    const liveCreatedSheets = doc.querySelectorAll(`style[${ATTR_CREATED_SHEET}]`);
    const clonedCreatedSheets = clone.querySelectorAll(`style[${ATTR_CREATED_SHEET}]`);
    clonedCreatedSheets.forEach((cloneStyle, i) => {
      const liveSheet = liveCreatedSheets[i] && liveCreatedSheets[i].sheet;
      if (!liveSheet) return;
      try {
        cloneStyle.textContent = Array.from(liveSheet.cssRules).map((r) => r.cssText).join("\n");
      } catch {
      }
    });
    clone.querySelectorAll(`[${ATTR_IGNORE}]`).forEach((el) => el.remove());
    for (const attr of CONTENT_MARKER_ATTRS) {
      clone.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    }
    const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) : "<!DOCTYPE html>";
    return `${doctype}
${clone.outerHTML}`;
  }

  // src/save/save-client.js
  async function saveNow(state, toast, { confirmOverwrite = false } = {}) {
    commitActiveEdit();
    const doc = state.root.ownerDocument;
    const html = getCleanHTML(doc);
    const indexAtSerialize = state.currentIndex;
    if (confirmOverwrite) {
      const win = doc.defaultView;
      if (!win.confirm("Save changes? This will overwrite the existing content.")) return false;
    }
    try {
      if (state.config.onSave) {
        await state.config.onSave(html);
      } else {
        const res = await fetch(state.config.saveEndpoint + `?path=${encodeURIComponent(doc.location.pathname)}`, {
          method: "POST",
          headers: { "Content-Type": "text/html" },
          body: html
        });
        if (!res.ok) {
          let message = `Save failed (${res.status})`;
          try {
            const body = await res.json();
            if (body && body.error) message = body.error;
          } catch {
          }
          throw new Error(message);
        }
      }
      state.savedIndex = indexAtSerialize;
      notify(state);
      toast.success("Saved.");
      return true;
    } catch (err) {
      toast.error(`Save failed: ${err && err.message ? err.message : err}`);
      return false;
    }
  }

  // src/index.js
  var instance = null;
  function ensureEditorRoot(doc) {
    let root = doc.getElementById(ROOT_ID);
    if (!root) {
      root = doc.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute(ATTR_IGNORE, "");
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
    const resizeController = config.enableResize !== false ? createResizeController(state, modeController.overlay, config) : null;
    const moveController = config.enableMove !== false ? createMoveController(state, modeController, config) : null;
    const contextMenu = config.enableLayering !== false ? createContextMenu(state, modeController) : null;
    const toast = createToastHost(editorRoot);
    const win = doc.defaultView;
    const bridge = config.embedded && win && win.frameElement && win.frameElement.__etchrBridge || null;
    const confirmBeforeSave = config.confirmBeforeSave !== void 0 ? config.confirmBeforeSave : !config.onSave;
    const doSave = async () => {
      const ok = await saveNow(state, toast, { confirmOverwrite: confirmBeforeSave });
      if (ok && bridge) bridge.notifySaved();
      return ok;
    };
    installKeyboardShortcuts(state, { onSave: doSave });
    const mainToolbar = createMainToolbar(state, modeController, {
      onSave: doSave,
      showModeToggle: config.allowModeToggle !== false,
      showSave: !config.embedded
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
      onImageInserted: () => imagePanel.show()
    });
    const stylingPanels = [stylePanel, cssPanel, quickPanel, imagePanel];
    const openOnly = (target) => {
      for (const p of stylingPanels) if (p !== target) p.hide();
      if (target.isOpen()) target.hide();
      else target.show();
    };
    toolbar.appendButton(button(doc, "Style \u2728", () => openOnly(quickPanel)));
    toolbar.appendButton(button(doc, "Font", () => openOnly(stylePanel)));
    const cssBtn = button(doc, "CSS", () => openOnly(cssPanel));
    toolbar.appendButton(cssBtn);
    const imageBtn = button(doc, "Image", () => openOnly(imagePanel));
    imageBtn.style.display = "none";
    toolbar.appendButton(imageBtn);
    subscribe(state, () => {
      const single = !toolbar.isMultiSelect();
      cssBtn.style.display = single ? "" : "none";
      imageBtn.style.display = single && imagePanel.isImageSelected() ? "" : "none";
      if (!single) {
        if (cssPanel.isOpen()) cssPanel.hide();
        if (imagePanel.isOpen() && !imagePanel.isImageSelected()) imagePanel.hide();
      }
    });
    const addBtn = button(doc, "Add", () => palette.toggle());
    mainToolbar.appendButton(addBtn);
    doc.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !state.isEditModeEnabled) return;
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
      undo: () => undo(state),
      redo: () => redo(state),
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
      }
    };
    return instance;
  }
  function getState() {
    return instance ? instance.state : null;
  }
  function getInstance() {
    return instance;
  }
  function isDirty() {
    if (!instance) return false;
    const s = instance.state;
    return s.currentIndex !== s.savedIndex || isEditingText();
  }
  var launcher = null;
  function openEditor() {
    const editorRoot = ensureEditorRoot(document);
    const url = new URL(document.defaultView.location.href);
    url.searchParams.set(EMBED_PARAM, "1");
    if (launcher) launcher.setOpen(true);
    return openEditorModal(editorRoot, {
      url: url.toString(),
      onFullyClosed: () => {
        if (launcher) launcher.setOpen(false);
      }
    });
  }
  function mountLauncher() {
    if (launcher) return launcher;
    launcher = createLauncher(ensureEditorRoot(document), { onOpen: openEditor });
    return launcher;
  }
  var embeddingScript = typeof document !== "undefined" ? document.currentScript : null;
  function autoInit() {
    const script = embeddingScript;
    if (script && script.dataset.autoInit === "false") return;
    const mode = script && script.dataset.mode || "launcher";
    if (mode === "off") return;
    const options = {};
    if (script && script.dataset.saveEndpoint) options.saveEndpoint = script.dataset.saveEndpoint;
    const isEmbedded = new URLSearchParams(window.location.search).has(EMBED_PARAM);
    if (isEmbedded) {
      init({
        ...options,
        embedded: true,
        startInEditMode: true,
        paletteSide: "left",
        confirmBeforeSave: false,
        // the host's Save click is already deliberate
        allowModeToggle: false
        // "edit mode off inside the modal" is a dead state
      });
    } else if (mode === "inline") {
      init(options);
    } else {
      mountLauncher();
    }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      autoInit();
    }
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=editor.js.map
