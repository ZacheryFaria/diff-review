import { useState, useEffect } from "react";
import { buildFileTree, getExpandedPaths, TreeNode } from "./buildFileTree";

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

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  activeFile: string | null;
  onToggle: (path: string) => void;
  onFileClick: (file: string) => void;
}

function TreeNodeItem({ node, depth, expanded, activeFile, onToggle, onFileClick }: TreeNodeItemProps) {
  const isDir = node.children.length > 0;
  const isExpanded = expanded.has(node.path);
  const isActive = !isDir && activeFile === node.path;
  const paddingLeft = 8 + depth * 16;

  if (isDir) {
    return (
      <>
        <button
          className="file-tree-item"
          onClick={() => onToggle(node.path)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "4px 8px",
            paddingLeft,
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ flexShrink: 0, fontSize: 10 }}>{isExpanded ? "▾" : "▸"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}/
          </span>
        </button>
        {isExpanded &&
          node.children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeFile={activeFile}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
      </>
    );
  }

  return (
    <button
      className="file-tree-item"
      onClick={() => onFileClick(node.path)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "4px 8px",
        paddingLeft,
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
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      <span style={{ flexShrink: 0, marginLeft: 8, fontSize: 11 }}>
        {(node.additions ?? 0) > 0 && (
          <span style={{ color: "var(--diff-add-text)" }}>+{node.additions}</span>
        )}
        {(node.additions ?? 0) > 0 && (node.deletions ?? 0) > 0 && " "}
        {(node.deletions ?? 0) > 0 && (
          <span style={{ color: "var(--diff-del-text)" }}>-{node.deletions}</span>
        )}
      </span>
    </button>
  );
}

function collectDirPaths(nodes: TreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.push(node.path);
      collectDirPaths(node.children, acc);
    }
  }
  return acc;
}

export function FileTree({ files, activeFile, onFileClick }: FileTreeProps) {
  const tree = buildFileTree(files);
  const [expanded, setExpanded] = useState<Set<string>>(() => getExpandedPaths(activeFile));

  useEffect(() => {
    const newPaths = getExpandedPaths(activeFile);
    if (newPaths.size === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      for (const p of newPaths) next.add(p);
      return next;
    });
  }, [activeFile]);

  function onToggle(path: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(collectDirPaths(tree)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: 0,
          }}
        >
          Files ({files.length})
        </h3>
        <span style={{ display: "flex", gap: 4 }}>
          <button
            onClick={expandAll}
            title="Expand all"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ⊞
          </button>
          <button
            onClick={collapseAll}
            title="Collapse all"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ⊟
          </button>
        </span>
      </div>
      <div>
        {tree.map(node => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            activeFile={activeFile}
            onToggle={onToggle}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
}
