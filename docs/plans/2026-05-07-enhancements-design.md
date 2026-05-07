# diff-review Enhancements Design

## Overview

Three enhancements to the diff-review tool:
1. Fix syntax highlighting for CSS/SCSS and other missing languages
2. Replace the flat file list sidebar with a nested collapsible tree
3. Add AST-aware structural diffing via tree-sitter

---

## 1. Syntax Highlighting Fix

**Problem:** Refractor grammars aren't registered for all languages in the extension map, causing CSS/SCSS (and potentially others) to render without highlighting.

**Solution:**
- Register all grammars explicitly with refractor at module load
- Extend the extension→language map with: `scss`, `less`, `graphql`/`gql`, `dockerfile`, `toml`, `xml`, `java`, `c`/`h`, `cpp`/`hpp`
- A `registerLanguages()` call in a dedicated `languages.ts` module imported by `DiffFile.tsx`
- Existing try/catch fallback ensures unregistered languages don't crash rendering

---

## 2. File Tree Sidebar

**Problem:** The flat file list shows full paths, which is unreadable for deeply-nested files.

**Solution:**
- Replace `Sidebar/FileTree.tsx` with a nested, collapsible directory tree (GitHub PR style)
- No new dependencies — custom recursive `<TreeNode>` component with CSS indentation
- No server changes — tree built client-side from existing `GET /api/files` response

**Behavior:**
- Directories collapsed by default, except paths containing the currently-selected file
- Clicking a folder toggles expand/collapse
- Clicking a file scrolls to that diff
- File stats (additions/deletions) shown on leaf nodes
- "Collapse all" / "expand all" control at the top

**Data structure:**
- `buildFileTree(files)` converts flat list into `{ name, path, children?, stats? }` nodes
- Single `Set<string>` of expanded paths manages open/closed state

---

## 3. AST-Aware Structural Diffing

**Problem:** Standard git diff shows line-level changes but can't detect structural operations like moved functions, renames, or formatting-only changes.

**Solution:** Server-side tree-sitter analysis with a frontend toggle between "Standard" and "Structural" diff views.

### Architecture

**New API endpoint:**
- `GET /api/structural-diff?file=<path>&base=<ref>&head=<ref>`
- Returns structural annotations for a single file

**Server-side pipeline:**
1. Retrieve both file versions via `git show <base>:<file>` and `git show <head>:<file>`
2. Parse both into ASTs using `web-tree-sitter` with the appropriate language grammar
3. Run structural diff algorithm (GumTree-inspired)
4. Classify changes:
   - **Moved** — named block exists in both trees at different positions
   - **Renamed** — block's identifier changed, body hash is >80% similar
   - **Formatting-only** — AST is identical, only whitespace/comments differ
5. Return: `{ type: "moved"|"renamed"|"formatting", fromLines, toLines, label }`

### Structural Diff Algorithm

1. Extract "named blocks" from both ASTs (functions, classes, methods, CSS rules, etc.)
2. Hash each block's subtree (ignoring whitespace and identifier names for move detection)
3. Match blocks: exact body-hash match at different positions = **moved**
4. Unmatched blocks: compare identifier + fuzzy body similarity → **renamed**
5. Hunks with no AST difference → **formatting-only**

### Language Grammar Management

- `.wasm` grammar files stored in `grammars/` directory within the package
- Registry mapping file extensions → grammar filenames
- Languages loaded lazily on first request
- Initial set: JS, TS, TSX, JSX, Python, Go, Rust, CSS, HTML, JSON, YAML, Bash, SQL, C, C++, Java
- Adding a language = dropping in `.wasm` file + one registry entry

### Frontend UX

- Toggle button per-file (or global) to switch between "Standard" and "Structural" views
- Structural mode:
  - Moved blocks: distinct color/badge ("Moved from line X"), clickable to jump to counterpart
  - Renamed symbols: old→new name badge
  - Formatting-only hunks: collapsed by default with "formatting changes" label (expandable)
- Standard mode: unchanged (current behavior)

### Constraints

- Structural diff only available for languages with a loaded grammar — others show "not available" gracefully
- Files >10K lines skip structural analysis (performance) — fall back to standard diff with a note
- Algorithm is heuristic — handles common cases (function reorder, rename) but not cross-file moves

---

## Tech Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Tree-sitter runtime | `web-tree-sitter` (WASM) | No native compilation; works everywhere Node runs |
| Grammar storage | Bundled `.wasm` files | Self-contained package, no runtime downloads |
| File tree | Custom component | File count in PRs is small; no virtualization needed |
| Syntax grammars | `refractor` (existing) | Already in use, just needs registration |
