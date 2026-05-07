# diff-review Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full syntax highlighting support, a nested file tree sidebar, and AST-aware structural diffing to diff-review.

**Architecture:** Three independent features: (1) register refractor grammars for all mapped languages, (2) replace flat file list with recursive tree component, (3) add server-side tree-sitter analysis with a new API endpoint and frontend toggle.

**Tech Stack:** React 18, refractor v3, web-tree-sitter (WASM), Express, TypeScript, Vite.

---

## Task 1: Fix Syntax Highlighting — Register Language Grammars

**Files:**
- Create: `src/languages.ts`
- Modify: `src/components/DiffView/DiffFile.tsx:4-5,12-33`

**Step 1: Create `src/languages.ts` with grammar registration**

```typescript
// @ts-expect-error refractor v3 has no type declarations
import refractor from "refractor";
// @ts-expect-error refractor v3 has no type declarations
import css from "refractor/lang/css";
// @ts-expect-error refractor v3 has no type declarations
import scss from "refractor/lang/scss";
// @ts-expect-error refractor v3 has no type declarations
import less from "refractor/lang/less";
// @ts-expect-error refractor v3 has no type declarations
import javascript from "refractor/lang/javascript";
// @ts-expect-error refractor v3 has no type declarations
import typescript from "refractor/lang/typescript";
// @ts-expect-error refractor v3 has no type declarations
import jsx from "refractor/lang/jsx";
// @ts-expect-error refractor v3 has no type declarations
import tsx from "refractor/lang/tsx";
// @ts-expect-error refractor v3 has no type declarations
import python from "refractor/lang/python";
// @ts-expect-error refractor v3 has no type declarations
import go from "refractor/lang/go";
// @ts-expect-error refractor v3 has no type declarations
import rust from "refractor/lang/rust";
// @ts-expect-error refractor v3 has no type declarations
import json from "refractor/lang/json";
// @ts-expect-error refractor v3 has no type declarations
import markup from "refractor/lang/markup";
// @ts-expect-error refractor v3 has no type declarations
import markdown from "refractor/lang/markdown";
// @ts-expect-error refractor v3 has no type declarations
import yaml from "refractor/lang/yaml";
// @ts-expect-error refractor v3 has no type declarations
import bash from "refractor/lang/bash";
// @ts-expect-error refractor v3 has no type declarations
import sql from "refractor/lang/sql";
// @ts-expect-error refractor v3 has no type declarations
import protobuf from "refractor/lang/protobuf";
// @ts-expect-error refractor v3 has no type declarations
import graphql from "refractor/lang/graphql";
// @ts-expect-error refractor v3 has no type declarations
import docker from "refractor/lang/docker";
// @ts-expect-error refractor v3 has no type declarations
import toml from "refractor/lang/toml";
// @ts-expect-error refractor v3 has no type declarations
import java from "refractor/lang/java";
// @ts-expect-error refractor v3 has no type declarations
import c from "refractor/lang/c";
// @ts-expect-error refractor v3 has no type declarations
import cpp from "refractor/lang/cpp";
// @ts-expect-error refractor v3 has no type declarations
import ruby from "refractor/lang/ruby";
// @ts-expect-error refractor v3 has no type declarations
import php from "refractor/lang/php";
// @ts-expect-error refractor v3 has no type declarations
import swift from "refractor/lang/swift";
// @ts-expect-error refractor v3 has no type declarations
import kotlin from "refractor/lang/kotlin";

refractor.register(css);
refractor.register(scss);
refractor.register(less);
refractor.register(javascript);
refractor.register(typescript);
refractor.register(jsx);
refractor.register(tsx);
refractor.register(python);
refractor.register(go);
refractor.register(rust);
refractor.register(json);
refractor.register(markup);
refractor.register(markdown);
refractor.register(yaml);
refractor.register(bash);
refractor.register(sql);
refractor.register(protobuf);
refractor.register(graphql);
refractor.register(docker);
refractor.register(toml);
refractor.register(java);
refractor.register(c);
refractor.register(cpp);
refractor.register(ruby);
refractor.register(php);
refractor.register(swift);
refractor.register(kotlin);

const EXTENSION_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  go: "go",
  rs: "rust",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "markup",
  xml: "markup",
  svg: "markup",
  md: "markdown",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  proto: "protobuf",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "docker",
  toml: "toml",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
};

export function getLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "docker";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "text";
}

export { refractor };
```

**Step 2: Update `DiffFile.tsx` to use the new module**

Replace lines 4-5 and the `getLanguage` function (lines 12-33) with:

```typescript
import { refractor, getLanguage } from "../../languages";
```

Remove the old `refractor` import and the inline `getLanguage` function entirely.

**Step 3: Verify it builds**

Run: `cd /Users/zfaria/sources/diff-review && pnpm run build`
Expected: No errors. CSS/SCSS files should now tokenize properly.

**Step 4: Manual verification**

Run: `pnpm run dev`
Open a diff with a `.css` or `.scss` file — confirm syntax highlighting renders (keywords colored, strings colored, etc.)

**Step 5: Commit**

```bash
git add src/languages.ts src/components/DiffView/DiffFile.tsx
git commit -m "minor: register refractor grammars for all supported languages"
```

---

## Task 2: File Tree Sidebar — Build Tree Data Structure

**Files:**
- Create: `src/components/Sidebar/buildFileTree.ts`

**Step 1: Create `buildFileTree.ts`**

```typescript
export interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  additions?: number;
  deletions?: number;
}

interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

export function buildFileTree(files: FileStat[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const f of files) {
    const parts = f.file.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;

      let existing = current.find(n => n.name === name);
      if (!existing) {
        existing = { name, path, children: [] };
        if (isFile) {
          existing.additions = f.additions;
          existing.deletions = f.deletions;
        }
        current.push(existing);
      }
      current = existing.children;
    }
  }

  return sortTree(root);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map(n => ({ ...n, children: sortTree(n.children) }))
    .sort((a, b) => {
      const aIsDir = a.children.length > 0;
      const bIsDir = b.children.length > 0;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
}

export function getExpandedPaths(activeFile: string | null): Set<string> {
  if (!activeFile) return new Set();
  const parts = activeFile.split("/");
  const paths = new Set<string>();
  for (let i = 1; i < parts.length; i++) {
    paths.add(parts.slice(0, i).join("/"));
  }
  return paths;
}
```

**Step 2: Commit**

```bash
git add src/components/Sidebar/buildFileTree.ts
git commit -m "minor: add buildFileTree utility for nested file tree"
```

---

## Task 3: File Tree Sidebar — Replace FileTree Component

**Files:**
- Modify: `src/components/Sidebar/FileTree.tsx`

**Step 1: Rewrite `FileTree.tsx` with recursive tree rendering**

```typescript
import { useState, useEffect } from "react";
import { buildFileTree, getExpandedPaths, type TreeNode } from "./buildFileTree";

interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

interface FileTreeProps {
  files: FileStat[];
  activeFile: string | null;
  onFileClick: (file: string) => void;
}

function TreeNodeItem({
  node,
  depth,
  expanded,
  onToggle,
  activeFile,
  onFileClick,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  activeFile: string | null;
  onFileClick: (file: string) => void;
}) {
  const isDir = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const isActive = activeFile === node.path;

  if (isDir) {
    return (
      <>
        <button
          onClick={() => onToggle(node.path)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "3px 8px",
            paddingLeft: 8 + depth * 16,
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          className="file-tree-item"
        >
          <span style={{ fontSize: 10, width: 10, flexShrink: 0 }}>
            {isOpen ? "▾" : "▸"}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>{node.name}/</span>
        </button>
        {isOpen &&
          node.children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              activeFile={activeFile}
              onFileClick={onFileClick}
            />
          ))}
      </>
    );
  }

  return (
    <button
      onClick={() => onFileClick(node.path)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "3px 8px",
        paddingLeft: 8 + depth * 16,
        background: isActive ? "var(--bg-tertiary)" : "transparent",
        border: "none",
        color: "var(--text-primary)",
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        borderRadius: 4,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
      className="file-tree-item"
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      <span style={{ flexShrink: 0, marginLeft: 8, fontSize: 11 }}>
        {node.additions !== undefined && node.additions > 0 && (
          <span style={{ color: "var(--diff-add-text)" }}>+{node.additions}</span>
        )}
        {node.additions !== undefined && node.additions > 0 && node.deletions !== undefined && node.deletions > 0 && " "}
        {node.deletions !== undefined && node.deletions > 0 && (
          <span style={{ color: "var(--diff-del-text)" }}>-{node.deletions}</span>
        )}
      </span>
    </button>
  );
}

export function FileTree({ files, activeFile, onFileClick }: FileTreeProps) {
  const tree = buildFileTree(files);
  const [expanded, setExpanded] = useState<Set<string>>(() => getExpandedPaths(activeFile));

  useEffect(() => {
    setExpanded(prev => {
      const active = getExpandedPaths(activeFile);
      const merged = new Set(prev);
      for (const p of active) merged.add(p);
      return merged;
    });
  }, [activeFile]);

  const onToggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          all.add(n.path);
          walk(n.children);
        }
      }
    };
    walk(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Files ({files.length})
        </h3>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={expandAll}
            title="Expand all"
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
          >
            ⊞
          </button>
          <button
            onClick={collapseAll}
            title="Collapse all"
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
          >
            ⊟
          </button>
        </div>
      </div>
      <div>
        {tree.map(node => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
            activeFile={activeFile}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `cd /Users/zfaria/sources/diff-review && pnpm run build`
Expected: No errors.

**Step 3: Manual verification**

Run: `pnpm run dev`
Confirm: tree renders with collapsible folders, expand/collapse all works, clicking a file navigates to the diff.

**Step 4: Commit**

```bash
git add src/components/Sidebar/FileTree.tsx
git commit -m "minor: replace flat file list with nested collapsible tree sidebar"
```

---

## Task 4: Structural Diff — Install Dependencies and Set Up Grammar Infrastructure

**Files:**
- Modify: `package.json`
- Create: `server/structural/grammar-registry.ts`
- Create: `grammars/` directory (with README explaining how to add grammars)

**Step 1: Install web-tree-sitter**

Run: `cd /Users/zfaria/sources/diff-review && pnpm add web-tree-sitter`

**Step 2: Download initial WASM grammar files**

Tree-sitter WASM grammars are available from the `tree-sitter/tree-sitter-<lang>` repos or via pre-built packages like `tree-sitter-wasms`. Install the pre-built package:

Run: `pnpm add tree-sitter-wasms`

This provides `.wasm` files for all major languages.

**Step 3: Create `server/structural/grammar-registry.ts`**

```typescript
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import Parser from "web-tree-sitter";

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXTENSION_TO_GRAMMAR: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  css: "css",
  scss: "css",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  java: "java",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
};

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await Parser.init();
  initialized = true;
}

const languageCache = new Map<string, Parser.Language>();

function findWasmPath(grammarName: string): string | null {
  // Try tree-sitter-wasms package first
  const wasmsPkg = resolve(__dirname, "../../node_modules/tree-sitter-wasms/out/tree-sitter-" + grammarName + ".wasm");
  if (existsSync(wasmsPkg)) return wasmsPkg;

  // Try local grammars/ directory
  const local = resolve(__dirname, "../../grammars/tree-sitter-" + grammarName + ".wasm");
  if (existsSync(local)) return local;

  return null;
}

export async function getLanguageForFile(fileName: string): Promise<Parser.Language | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const grammarName = EXTENSION_TO_GRAMMAR[ext];
  if (!grammarName) return null;

  if (languageCache.has(grammarName)) return languageCache.get(grammarName)!;

  await ensureInit();

  const wasmPath = findWasmPath(grammarName);
  if (!wasmPath) return null;

  const language = await Parser.Language.load(wasmPath);
  languageCache.set(grammarName, language);
  return language;
}

export async function createParser(fileName: string): Promise<Parser | null> {
  const language = await getLanguageForFile(fileName);
  if (!language) return null;

  await ensureInit();
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function isStructuralDiffSupported(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in EXTENSION_TO_GRAMMAR;
}
```

**Step 4: Create `grammars/` directory with README**

```bash
mkdir -p grammars
```

Create `grammars/README.md`:
```
Place custom .wasm grammar files here (tree-sitter-<language>.wasm).
These supplement the grammars provided by the tree-sitter-wasms package.
```

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml server/structural/grammar-registry.ts grammars/
git commit -m "minor: add tree-sitter infrastructure for structural diffing"
```

---

## Task 5: Structural Diff — Implement Block Extraction and Matching Algorithm

**Files:**
- Create: `server/structural/block-extractor.ts`
- Create: `server/structural/matcher.ts`
- Create: `server/structural/types.ts`

**Step 1: Create `server/structural/types.ts`**

```typescript
export interface Block {
  name: string;
  type: string; // "function" | "class" | "method" | "rule" | "block"
  startLine: number;
  endLine: number;
  bodyHash: string; // hash of subtree ignoring whitespace
  nameHash: string; // hash of identifier
  source: string; // raw text for similarity comparison
}

export interface StructuralChange {
  type: "moved" | "renamed" | "formatting";
  label: string;
  oldStartLine?: number;
  oldEndLine?: number;
  newStartLine?: number;
  newEndLine?: number;
  details?: string; // e.g. "foo → bar" for renames
}
```

**Step 2: Create `server/structural/block-extractor.ts`**

```typescript
import { createHash } from "crypto";
import Parser from "web-tree-sitter";
import type { Block } from "./types.js";

const NAMED_NODE_TYPES = new Set([
  // JS/TS
  "function_declaration",
  "method_definition",
  "class_declaration",
  "arrow_function",
  "variable_declarator",
  "export_statement",
  // Python
  "function_definition",
  "class_definition",
  // Go
  "function_declaration",
  "method_declaration",
  "type_declaration",
  // Rust
  "function_item",
  "impl_item",
  "struct_item",
  "enum_item",
  // CSS
  "rule_set",
  "media_statement",
  "keyframes_statement",
  // C/C++
  "function_definition",
  "struct_specifier",
  "class_specifier",
  // Java/Kotlin
  "class_declaration",
  "interface_declaration",
]);

function hashString(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getNodeName(node: Parser.SyntaxNode): string | null {
  // Try common patterns for finding the name of a node
  const nameNode =
    node.childForFieldName("name") ??
    node.childForFieldName("declarator") ??
    node.childForFieldName("selector");

  if (nameNode) return nameNode.text;

  // For variable declarators, try the first named child
  if (node.type === "variable_declarator" && node.firstNamedChild) {
    return node.firstNamedChild.text;
  }

  return null;
}

export function extractBlocks(tree: Parser.Tree, source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split("\n");

  function walk(node: Parser.SyntaxNode) {
    if (NAMED_NODE_TYPES.has(node.type)) {
      const name = getNodeName(node);
      if (name) {
        const bodyText = node.text;
        const normalized = normalizeWhitespace(bodyText);

        blocks.push({
          name,
          type: node.type,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          bodyHash: hashString(normalized),
          nameHash: hashString(name),
          source: bodyText,
        });
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return blocks;
}
```

**Step 3: Create `server/structural/matcher.ts`**

```typescript
import type { Block, StructuralChange } from "./types.js";

function similarity(a: string, b: string): number {
  const normalA = a.replace(/\s+/g, " ").trim();
  const normalB = b.replace(/\s+/g, " ").trim();
  if (normalA === normalB) return 1;

  // Simple Jaccard similarity on tokens
  const tokensA = new Set(normalA.split(/\s+/));
  const tokensB = new Set(normalB.split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function matchBlocks(
  oldBlocks: Block[],
  newBlocks: Block[],
  oldSource: string,
  newSource: string
): StructuralChange[] {
  const changes: StructuralChange[] = [];
  const matchedOld = new Set<number>();
  const matchedNew = new Set<number>();

  // Pass 1: Find moved blocks (same body hash, different position)
  for (let i = 0; i < oldBlocks.length; i++) {
    for (let j = 0; j < newBlocks.length; j++) {
      if (matchedNew.has(j)) continue;
      if (oldBlocks[i].bodyHash === newBlocks[j].bodyHash &&
          oldBlocks[i].name === newBlocks[j].name &&
          oldBlocks[i].startLine !== newBlocks[j].startLine) {
        changes.push({
          type: "moved",
          label: `${oldBlocks[i].name} (${oldBlocks[i].type})`,
          oldStartLine: oldBlocks[i].startLine,
          oldEndLine: oldBlocks[i].endLine,
          newStartLine: newBlocks[j].startLine,
          newEndLine: newBlocks[j].endLine,
        });
        matchedOld.add(i);
        matchedNew.add(j);
        break;
      }
    }
  }

  // Pass 2: Find renamed blocks (different name, similar body > 80%)
  for (let i = 0; i < oldBlocks.length; i++) {
    if (matchedOld.has(i)) continue;
    for (let j = 0; j < newBlocks.length; j++) {
      if (matchedNew.has(j)) continue;
      if (oldBlocks[i].name !== newBlocks[j].name &&
          oldBlocks[i].type === newBlocks[j].type) {
        const sim = similarity(oldBlocks[i].source, newBlocks[j].source);
        if (sim > 0.8) {
          changes.push({
            type: "renamed",
            label: `${oldBlocks[i].type}`,
            details: `${oldBlocks[i].name} → ${newBlocks[j].name}`,
            oldStartLine: oldBlocks[i].startLine,
            oldEndLine: oldBlocks[i].endLine,
            newStartLine: newBlocks[j].startLine,
            newEndLine: newBlocks[j].endLine,
          });
          matchedOld.add(i);
          matchedNew.add(j);
          break;
        }
      }
    }
  }

  // Pass 3: Detect formatting-only changes
  // Compare full AST (ignoring whitespace) — if old normalized === new normalized
  // but raw text differs, it's formatting-only
  const oldNormalized = oldSource.replace(/\s+/g, " ").trim();
  const newNormalized = newSource.replace(/\s+/g, " ").trim();
  if (oldNormalized === newNormalized && oldSource !== newSource) {
    changes.push({
      type: "formatting",
      label: "Entire file is formatting-only changes",
      oldStartLine: 1,
      oldEndLine: oldSource.split("\n").length,
      newStartLine: 1,
      newEndLine: newSource.split("\n").length,
    });
  }

  return changes;
}
```

**Step 4: Commit**

```bash
git add server/structural/
git commit -m "minor: implement block extraction and matching for structural diff"
```

---

## Task 6: Structural Diff — Add Server Route and Git File Retrieval

**Files:**
- Modify: `server/git.ts`
- Create: `server/routes/structural-diff.ts`
- Modify: `server/index.ts`

**Step 1: Add `getFileAtRef` to `server/git.ts`**

Add after the existing `getFileStats` function:

```typescript
export async function getFileAtRef(repoDir: string, ref: string, filePath: string): Promise<string> {
  return run(repoDir, "show", `${ref}:${filePath}`);
}
```

**Step 2: Create `server/routes/structural-diff.ts`**

```typescript
import { Router, IRouter } from "express";
import { getMergeBase, getFileAtRef } from "../git.js";
import { createParser, isStructuralDiffSupported } from "../structural/grammar-registry.js";
import { extractBlocks } from "../structural/block-extractor.js";
import { matchBlocks } from "../structural/matcher.js";
import type { StructuralChange } from "../structural/types.js";

export const structuralDiffRouter: IRouter = Router();

const MAX_LINES = 10000;

structuralDiffRouter.get("/structural-diff", async (req, res) => {
  try {
    const { file, base, head } = req.query as { file: string; base: string; head: string };
    if (!file || !base || !head) {
      return res.status(400).json({ error: "file, base, and head query params required" });
    }

    if (!isStructuralDiffSupported(file)) {
      return res.json({ supported: false, reason: "Language not supported for structural diff" });
    }

    const repoDir = req.app.locals.repoDir;
    const mergeBase = await getMergeBase(repoDir, base, head);

    let oldSource: string;
    let newSource: string;
    try {
      oldSource = await getFileAtRef(repoDir, mergeBase, file);
    } catch {
      oldSource = "";
    }
    try {
      newSource = await getFileAtRef(repoDir, head, file);
    } catch {
      newSource = "";
    }

    if (!oldSource && !newSource) {
      return res.json({ supported: true, changes: [] });
    }

    if (oldSource.split("\n").length > MAX_LINES || newSource.split("\n").length > MAX_LINES) {
      return res.json({ supported: false, reason: "File too large for structural analysis (>10K lines)" });
    }

    const parser = await createParser(file);
    if (!parser) {
      return res.json({ supported: false, reason: "No parser available for this file type" });
    }

    const oldTree = oldSource ? parser.parse(oldSource) : null;
    const newTree = newSource ? parser.parse(newSource) : null;

    const oldBlocks = oldTree ? extractBlocks(oldTree, oldSource) : [];
    const newBlocks = newTree ? extractBlocks(newTree, newSource) : [];

    const changes: StructuralChange[] = matchBlocks(oldBlocks, newBlocks, oldSource, newSource);

    res.json({ supported: true, changes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Step 3: Register the router in `server/index.ts`**

Add import:
```typescript
import { structuralDiffRouter } from "./routes/structural-diff.js";
```

Add after the existing `app.use("/api", commentsRouter);` line:
```typescript
app.use("/api", structuralDiffRouter);
```

**Step 4: Verify server compiles**

Run: `cd /Users/zfaria/sources/diff-review && npx tsc -p tsconfig.server.json --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add server/git.ts server/routes/structural-diff.ts server/index.ts
git commit -m "minor: add /api/structural-diff endpoint with tree-sitter analysis"
```

---

## Task 7: Structural Diff — Frontend API Client and Toggle UI

**Files:**
- Modify: `src/api.ts`
- Modify: `src/components/DiffView/DiffFile.tsx`

**Step 1: Add `getStructuralDiff` to `src/api.ts`**

```typescript
export interface StructuralChange {
  type: "moved" | "renamed" | "formatting";
  label: string;
  oldStartLine?: number;
  oldEndLine?: number;
  newStartLine?: number;
  newEndLine?: number;
  details?: string;
}

export interface StructuralDiffResponse {
  supported: boolean;
  reason?: string;
  changes?: StructuralChange[];
}

export async function getStructuralDiff(
  file: string,
  base: string,
  head: string
): Promise<StructuralDiffResponse> {
  return fetchJson(
    `${BASE}/structural-diff?file=${encodeURIComponent(file)}&base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
  );
}
```

**Step 2: Add structural diff toggle and annotations to `DiffFile.tsx`**

Add to the `DiffFileProps` interface:
```typescript
base: string;
head: string;
```

Add state for structural mode inside the component:
```typescript
const [structuralMode, setStructuralMode] = useState(false);
const [structuralData, setStructuralData] = useState<StructuralDiffResponse | null>(null);
const [loadingStructural, setLoadingStructural] = useState(false);
```

Add an effect to fetch structural data when toggled on:
```typescript
useEffect(() => {
  if (!structuralMode) return;
  if (structuralData) return;
  setLoadingStructural(true);
  getStructuralDiff(fileName, base, head)
    .then(setStructuralData)
    .finally(() => setLoadingStructural(false));
}, [structuralMode]);
```

Add a toggle button in the file header (next to the reviewed checkbox):
```typescript
<button
  onClick={e => { e.stopPropagation(); setStructuralMode(v => !v); }}
  title="Toggle structural diff"
  style={{
    background: structuralMode ? "var(--accent)" : "none",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: structuralMode ? "white" : "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 11,
    padding: "1px 7px",
    fontFamily: "sans-serif",
    lineHeight: 1.6,
  }}
>
  AST
</button>
```

Add a structural annotations banner above the diff when in structural mode:
```typescript
{structuralMode && structuralData && (
  <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
    {!structuralData.supported && (
      <span style={{ color: "var(--text-secondary)" }}>{structuralData.reason}</span>
    )}
    {structuralData.supported && structuralData.changes && structuralData.changes.length === 0 && (
      <span style={{ color: "var(--text-secondary)" }}>No structural changes detected</span>
    )}
    {structuralData.supported && structuralData.changes && structuralData.changes.map((change, i) => (
      <div key={i} style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          padding: "1px 6px",
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 500,
          background: change.type === "moved" ? "rgba(88, 166, 255, 0.2)" :
                     change.type === "renamed" ? "rgba(210, 168, 255, 0.2)" :
                     "rgba(139, 148, 158, 0.2)",
          color: change.type === "moved" ? "var(--accent)" :
                 change.type === "renamed" ? "#d2a8ff" :
                 "var(--text-secondary)",
        }}>
          {change.type}
        </span>
        <span style={{ color: "var(--text-primary)" }}>{change.label}</span>
        {change.details && <span style={{ color: "var(--text-secondary)" }}>{change.details}</span>}
        {change.newStartLine && (
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            line {change.oldStartLine} → {change.newStartLine}
          </span>
        )}
      </div>
    ))}
    {loadingStructural && <span style={{ color: "var(--text-secondary)" }}>Analyzing...</span>}
  </div>
)}
```

**Step 3: Pass `base` and `head` props down from `DiffView.tsx`**

In `DiffView.tsx`, add `base` and `head` to the `DiffFile` props:
```typescript
<DiffFile
  key={...}
  fileData={file}
  viewType={viewType}
  base={base}
  head={head}
  comments={fileComments}
  ...
/>
```

Remove the `void base; void head;` lines since they're now used.

**Step 4: Verify it builds**

Run: `cd /Users/zfaria/sources/diff-review && pnpm run build`
Expected: No errors.

**Step 5: Manual verification**

Run: `pnpm run dev`
- Toggle the "AST" button on a file — should show structural annotations or "no changes detected"
- Toggle on a non-supported file — should show "Language not supported" message
- Confirm standard diff still renders correctly when toggle is off

**Step 6: Commit**

```bash
git add src/api.ts src/components/DiffView/DiffFile.tsx src/components/DiffView/DiffView.tsx
git commit -m "minor: add structural diff toggle with AST annotation display"
```

---

## Task 8: Final Integration Test and Polish

**Files:**
- Modify: `package.json` (add `grammars/` to `files` array for publishing)

**Step 1: Update package.json `files` array**

Add `"grammars/"` to the `files` array so grammar files are included when the package is published.

**Step 2: Add CSS token styles for additional token types**

In `src/app.css`, add after the existing token styles:

```css
.diff-code .token.property { color: #79c0ff !important; }
.diff-code .token.selector { color: #7ee787 !important; }
.diff-code .token.atrule { color: #d2a8ff !important; }
.diff-code .token.tag { color: #7ee787 !important; }
.diff-code .token.attr-name { color: #79c0ff !important; }
.diff-code .token.attr-value { color: #a5d6ff !important; }
```

**Step 3: Full build and test**

Run: `cd /Users/zfaria/sources/diff-review && pnpm run build`
Expected: Clean build.

Run: `pnpm test` (if tests exist)
Expected: All pass.

**Step 4: Manual end-to-end verification**

Run: `pnpm run dev`
Verify all three features work together:
- CSS/SCSS files have syntax highlighting
- File tree shows nested structure with expand/collapse
- AST toggle works and shows structural annotations

**Step 5: Commit**

```bash
git add package.json src/app.css
git commit -m "minor: polish — add CSS token styles and include grammars in package"
```
