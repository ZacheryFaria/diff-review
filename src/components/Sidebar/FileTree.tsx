import { useState } from "react";

interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

interface FileTreeProps {
  files: FileStat[];
  activeFile: string | null;
  onFileClick: (file: string) => void;
  isIgnored: (file: string) => boolean;
  onIgnoreFile: (file: string) => void;
  onUnignoreFile: (file: string) => void;
}

export function FileTree({ files, activeFile, onFileClick, isIgnored, onIgnoreFile, onUnignoreFile }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: string } | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const visibleFiles = files.filter(f => !isIgnored(f.file));
  const ignoredFiles = files.filter(f => isIgnored(f.file));

  const handleContextMenu = (e: React.MouseEvent, file: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Files changed ({visibleFiles.length})
      </h3>
      <ul style={{ listStyle: "none" }}>
        {visibleFiles.map(f => (
          <li key={f.file}>
            <button
              onClick={() => onFileClick(f.file)}
              onContextMenu={(e) => handleContextMenu(e, f.file)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                background: activeFile === f.file ? "var(--bg-tertiary)" : "transparent",
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
                {f.file}
              </span>
              <span style={{ flexShrink: 0, marginLeft: 8, fontSize: 11 }}>
                {f.additions > 0 && <span style={{ color: "var(--diff-add-text)" }}>+{f.additions}</span>}
                {f.additions > 0 && f.deletions > 0 && " "}
                {f.deletions > 0 && <span style={{ color: "var(--diff-del-text)" }}>-{f.deletions}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {ignoredFiles.length > 0 && (
        <button
          onClick={() => setShowIgnored(!showIgnored)}
          style={{
            width: "100%", textAlign: "left", padding: "6px 8px", marginTop: 8,
            background: "transparent", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", fontSize: 11, opacity: 0.7,
          }}
        >
          {showIgnored ? "▼" : "▶"} {ignoredFiles.length} ignored {ignoredFiles.length === 1 ? "file" : "files"}
        </button>
      )}
      {showIgnored && (
        <ul style={{ listStyle: "none", opacity: 0.5 }}>
          {ignoredFiles.map(f => (
            <li key={f.file}>
              <button
                onClick={() => onUnignoreFile(f.file)}
                style={{
                  width: "100%", textAlign: "left", padding: "4px 8px",
                  background: "transparent", border: "none", color: "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)", borderRadius: 4,
                }}
                title="Click to un-ignore"
              >
                {f.file}
              </button>
            </li>
          ))}
        </ul>
      )}

      {contextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setContextMenu(null)} />
          <div style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 6, padding: 4, minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            <button
              onClick={() => { onIgnoreFile(contextMenu.file); setContextMenu(null); }}
              style={{
                width: "100%", textAlign: "left", padding: "6px 12px",
                background: "transparent", border: "none", color: "var(--text-primary)",
                cursor: "pointer", fontSize: 12, borderRadius: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-tertiary)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              Ignore this file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
