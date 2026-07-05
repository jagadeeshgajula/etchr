# Graph Report - project4  (2026-07-05)

## Corpus Check
- 49 files · ~25,326 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 255 nodes · 661 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5ae68479`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_index.js|index.js]]
- [[_COMMUNITY_dom-mutator.js|dom-mutator.js]]
- [[_COMMUNITY_rule-matcher.js|rule-matcher.js]]
- [[_COMMUNITY_style-mutator.js|style-mutator.js]]
- [[_COMMUNITY_style-suggestions.js|style-suggestions.js]]
- [[_COMMUNITY_history.js|history.js]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_server.js|server.js]]
- [[_COMMUNITY_esbuild.config.mjs|esbuild.config.mjs]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_prompt|prompt.md]]
- [[_COMMUNITY_css-mutator.js|css-mutator.js]]
- [[_COMMUNITY_config.js|config.js]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]

## God Nodes (most connected - your core abstractions)
1. `cls()` - 25 edges
2. `addChange()` - 25 edges
3. `init()` - 23 edges
4. `toPath()` - 22 edges
5. `createEl()` - 22 edges
6. `subscribe()` - 19 edges
7. `fromPath()` - 16 edges
8. `getEditableChildren()` - 14 edges
9. `Etchr` - 13 edges
10. `createMainToolbar()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `forward()` --calls--> `fromPath()`  [EXTRACTED]
  src/dom/text-editor.js → src/core/element-path.js
- `inverse()` --calls--> `fromPath()`  [EXTRACTED]
  src/dom/text-editor.js → src/core/element-path.js
- `currentValue()` --calls--> `readInlineValue()`  [EXTRACTED]
  src/ui/style-panel.js → src/dom/style-mutator.js
- `createContextMenu()` --calls--> `cls()`  [EXTRACTED]
  src/ui/context-menu.js → src/core/constants.js
- `createImagePanel()` --calls--> `cls()`  [EXTRACTED]
  src/ui/image-panel.js → src/core/constants.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Etchr Core Architecture** — src_core_history, src_core_element_path, src_serialize_html_serializer [EXTRACTED 1.00]
- **Save Flow** — src_serialize_html_serializer, server_save_page, demo_demo_demo_demo_demo_demo_demo_demo_demo_demo [INFERRED 0.80]

## Communities (15 total, 1 thin omitted)

### Community 0 - "index.js"
Cohesion: 0.14
Nodes (28): createConfig(), cls(), debounce(), createEditorState(), subscribe(), createModeController(), createMoveController(), createResizeController() (+20 more)

### Community 1 - "dom-mutator.js"
Cohesion: 0.14
Nodes (25): fromPath(), getAncestorChain(), getEditableChildren(), registerHandler(), applyAttr(), forward(), inverse(), addElement() (+17 more)

### Community 2 - "rule-matcher.js"
Cohesion: 0.42
Nodes (9): bestMatchSpecificity(), getMatchingRules(), isGroupingRule(), readProperties(), walkRuleList(), compareSpecificity(), computeSpecificity(), formatSpecificity() (+1 more)

### Community 3 - "style-mutator.js"
Cohesion: 0.15
Nodes (24): toPath(), addChange(), describeStableSelector(), existingStableClass(), seedCounter(), commitAttribute(), MOVE_PROPS, BREAKPOINTS (+16 more)

### Community 4 - "style-suggestions.js"
Cohesion: 0.12
Nodes (21): borderStyle(), borderThickness(), dedupe(), findColors(), findSide(), firstColor(), firstLength(), NAMED_COLORS (+13 more)

### Community 5 - "history.js"
Cohesion: 0.18
Nodes (21): notify(), canRedo(), canUndo(), forward(), getHandler(), handlers, inverse(), pruneStaleSelection() (+13 more)

### Community 6 - "package.json"
Cohesion: 0.14
Nodes (13): dependencies, express, description, devDependencies, esbuild, name, private, scripts (+5 more)

### Community 7 - "server.js"
Cohesion: 0.33
Nodes (5): createSavePageHandler(), app, DEMO_ROOT, __dirname, ROOT

### Community 10 - "esbuild.config.mjs"
Cohesion: 0.50
Nodes (3): cssOptions, jsOptions, watch

### Community 11 - "CLAUDE.md"
Cohesion: 0.09
Nodes (21): Build the bundle, Drag-to-move & layering — implementation deep dive, Drag-to-move (`src/dom/move-controller.js`), Etchr, Features, How it works (architecture notes), How to run, How to use it in your own page (standalone) (+13 more)

### Community 12 - "prompt.md"
Cohesion: 0.15
Nodes (12): Constraints & preferences, Final output expectations, Inspiration from existing projects, Milestone 1 – Core selection & text editing, Milestone 2 – Per-element font property editing, Milestone 3 – Add / remove elements, Milestone 4 – CSS editing with instant preview, Milestone 5 – Undo / Redo system (+4 more)

### Community 13 - "css-mutator.js"
Cohesion: 0.33
Nodes (12): addCssRule(), commitCssEdit(), describeResponsiveUpsert(), forward(), inverse(), setOrRemove(), resolveRule(), resolveRuleContainer() (+4 more)

### Community 14 - "config.js"
Cohesion: 0.50
Nodes (3): CONTAINER_TAGS, GOOGLE_FONTS, WEB_SAFE_FONTS

## Knowledge Gaps
- **69 isolated node(s):** `watch`, `jsOptions`, `cssOptions`, `name`, `version` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `addChange()` connect `style-mutator.js` to `dom-mutator.js`, `css-mutator.js`, `history.js`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `cls()` connect `index.js` to `dom-mutator.js`, `style-mutator.js`, `history.js`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `toPath()` connect `style-mutator.js` to `dom-mutator.js`, `history.js`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `watch`, `jsOptions`, `cssOptions` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14202898550724638 - nodes in this community are weakly interconnected._
- **Should `dom-mutator.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13636363636363635 - nodes in this community are weakly interconnected._
- **Should `style-suggestions.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1225296442687747 - nodes in this community are weakly interconnected._