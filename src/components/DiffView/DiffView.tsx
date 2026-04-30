import { useState } from "react";
import { parseDiff } from "react-diff-view";
import { DiffFile } from "./DiffFile";

interface DiffViewProps {
  diffText: string;
  baseCommit: string;
  headCommit: string;
  base: string;
  head: string;
}

export function DiffView({ diffText, baseCommit, headCommit, base, head }: DiffViewProps) {
  const [viewType, setViewType] = useState<"unified" | "split">("split");
  const files = parseDiff(diffText, { nearbySequences: "zip" });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "8px 0",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {files.length} file{files.length !== 1 ? "s" : ""} changed
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setViewType("unified")}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: viewType === "unified" ? "var(--bg-tertiary)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            Unified
          </button>
          <button
            onClick={() => setViewType("split")}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: viewType === "split" ? "var(--bg-tertiary)" : "transparent",
              color: "var(--text-primary)",
            }}
          >
            Split
          </button>
        </div>
      </div>
      {files.map(file => (
        <DiffFile
          key={`${file.oldRevision}-${file.newRevision}`}
          fileData={file}
          viewType={viewType}
        />
      ))}
    </div>
  );
}
