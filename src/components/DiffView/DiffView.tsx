import { useState } from "react";
import { parseDiff } from "react-diff-view";
import { DiffFile } from "./DiffFile";
import type { CommentWithFreshness } from "../../hooks/useComments";
import type { ReviewedFileState } from "../../api";

interface DiffViewProps {
  diffText: string;
  baseCommit: string;
  headCommit: string;
  base: string;
  head: string;
  comments: CommentWithFreshness[];
  onAddComment: (data: { file: string; startLine: number; endLine: number; side: "old" | "new"; body: string }) => Promise<void>;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  reviewedFiles: Record<string, ReviewedFileState>;
  onMarkReviewed: (file: string) => Promise<void>;
  onUnmarkReviewed: (file: string) => Promise<void>;
  onRefresh: () => void;
}

export function DiffView({ diffText, baseCommit, headCommit, base, head, comments, onAddComment, onResolve, onReopen, onDelete, reviewedFiles, onMarkReviewed, onUnmarkReviewed, onRefresh }: DiffViewProps) {
  const [viewType, setViewType] = useState<"unified" | "split">("split");
  const files = parseDiff(diffText, { nearbySequences: "zip" }).filter(f => f.newPath || f.oldPath);

  // suppress unused variable warnings for baseCommit/headCommit (used by parent for display)
  void baseCommit;
  void headCommit;

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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {files.length} file{files.length !== 1 ? "s" : ""} changed
          </span>
          <button
            onClick={onRefresh}
            title="Refresh diff and comments"
            style={{
              padding: "2px 6px",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
            }}
          >
            ↻
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
            reviewedState={reviewedFiles[fileName]}
            onMarkReviewed={() => onMarkReviewed(fileName)}
            onUnmarkReviewed={() => onUnmarkReviewed(fileName)}
            base={base}
            head={head}
          />
        );
      })}
    </div>
  );
}
