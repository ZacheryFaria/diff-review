import { useState } from "react";
import { parseDiff } from "react-diff-view";
import { DiffFile } from "./DiffFile";
import type { Comment } from "../../types/schema";

interface DiffViewProps {
  diffText: string;
  baseCommit: string;
  headCommit: string;
  base: string;
  head: string;
  comments: Comment[];
  onAddComment: (data: { file: string; startLine: number; endLine: number; side: "old" | "new"; body: string }) => Promise<void>;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DiffView({ diffText, baseCommit, headCommit, base, head, comments, onAddComment, onResolve, onReopen, onDelete }: DiffViewProps) {
  const [viewType, setViewType] = useState<"unified" | "split">("split");
  const files = parseDiff(diffText, { nearbySequences: "zip" });

  // suppress unused variable warnings for baseCommit/headCommit (used by parent for display)
  void baseCommit;
  void headCommit;
  void base;
  void head;

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
      {files.map(file => {
        const fileName = file.newPath || file.oldPath || "unknown";
        const fileComments = comments.filter(c => c.file === fileName);
        return (
          <DiffFile
            key={`${file.oldRevision}-${file.newRevision}`}
            fileData={file}
            viewType={viewType}
            comments={fileComments}
            onAddComment={onAddComment}
            onResolve={onResolve}
            onReopen={onReopen}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
