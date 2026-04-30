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

export function FileTree({ files, activeFile, onFileClick }: FileTreeProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Files changed ({files.length})
      </h3>
      <ul style={{ listStyle: "none" }}>
        {files.map(f => (
          <li key={f.file}>
            <button
              onClick={() => onFileClick(f.file)}
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
    </div>
  );
}
