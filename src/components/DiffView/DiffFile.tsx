import { useState, type ReactNode } from "react";
import { Diff, Hunk, tokenize, markEdits, getChangeKey } from "react-diff-view";
import "react-diff-view/style/index.css";
// @ts-expect-error refractor v3 has no type declarations
import refractor from "refractor";
import type { FileData, HunkData, ChangeData } from "react-diff-view";
import type { CommentWithFreshness } from "../../hooks/useComments";
import { CommentWidget } from "./CommentWidget";
import { CommentInput } from "../CommentInput";

function getLanguage(fileName: string): string {
  const ext = fileName.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    rs: "rust",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    sql: "sql",
    proto: "protobuf",
  };
  return map[ext] ?? "text";
}

interface PendingComment {
  file: string;
  line: number;
  side: "old" | "new";
}

interface DiffFileProps {
  fileData: FileData;
  viewType: "unified" | "split";
  comments: CommentWithFreshness[];
  onAddComment: (data: { file: string; startLine: number; endLine: number; side: "old" | "new"; body: string }) => Promise<void>;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

function findChangeForLine(
  allChanges: ChangeData[],
  line: number,
  side: "old" | "new"
): ChangeData | undefined {
  return allChanges.find(c => {
    if (side === "new") {
      return (c.type === "insert" && (c as { lineNumber: number }).lineNumber === line) ||
             (c.type === "normal" && (c as { newLineNumber: number }).newLineNumber === line);
    } else {
      return (c.type === "delete" && (c as { lineNumber: number }).lineNumber === line) ||
             (c.type === "normal" && (c as { oldLineNumber: number }).oldLineNumber === line);
    }
  });
}

function buildWidgets(
  hunks: HunkData[],
  fileComments: CommentWithFreshness[],
  pendingComment: PendingComment | null,
  onSubmit: (body: string) => void,
  onCancel: () => void,
  onResolve: (id: string) => void,
  onReopen: (id: string) => void,
  onDelete: (id: string) => void
): Record<string, ReactNode> {
  const widgets: Record<string, ReactNode> = {};
  const allChanges = hunks.flatMap(h => h.changes);

  for (const comment of fileComments) {
    const change = findChangeForLine(allChanges, comment.endLine, comment.side);
    if (change) {
      const key = getChangeKey(change);
      const existing = widgets[key];
      widgets[key] = (
        <div>
          {existing}
          <CommentWidget
            comment={comment}
            freshness={comment.freshness}
            onResolve={onResolve}
            onReopen={onReopen}
            onDelete={onDelete}
          />
        </div>
      );
    }
  }

  if (pendingComment) {
    const change = findChangeForLine(allChanges, pendingComment.line, pendingComment.side);
    if (change) {
      const key = getChangeKey(change);
      const existing = widgets[key];
      widgets[key] = (
        <div>
          {existing}
          <CommentInput onSubmit={onSubmit} onCancel={onCancel} />
        </div>
      );
    }
  }

  return widgets;
}

export function DiffFile({ fileData, viewType, comments, onAddComment, onResolve, onReopen, onDelete }: DiffFileProps) {
  const { type, hunks, oldPath, newPath } = fileData;
  const fileName = newPath || oldPath || "unknown";
  const language = getLanguage(fileName);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [showFileCommentInput, setShowFileCommentInput] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const fileLevelComments = comments.filter(c => c.startLine === 0);
  const lineLevelComments = comments.filter(c => c.startLine !== 0);

  let tokens;
  try {
    tokens = tokenize(hunks, {
      highlight: true,
      refractor,
      language,
      enhancers: [markEdits(hunks)],
    });
  } catch {
    tokens = undefined;
  }

  const handleGutterClick = ({ change, side }: { change: ChangeData | null; side?: "old" | "new" }) => {
    if (!change) return;
    const side_ = side ?? (change.type === "delete" ? "old" : "new");
    let line: number;
    if (change.type === "insert" || change.type === "delete") {
      line = (change as { lineNumber: number }).lineNumber;
    } else {
      line = side_ === "old"
        ? (change as { oldLineNumber: number }).oldLineNumber
        : (change as { newLineNumber: number }).newLineNumber;
    }
    if (!line) return;
    setPendingComment({ file: fileName, line, side: side_ });
  };

  const handleSubmit = async (body: string) => {
    if (!pendingComment) return;
    await onAddComment({
      file: pendingComment.file,
      startLine: pendingComment.line,
      endLine: pendingComment.line,
      side: pendingComment.side,
      body,
    });
    setPendingComment(null);
  };

  const handleCancel = () => setPendingComment(null);

  const handleFileCommentSubmit = async (body: string) => {
    await onAddComment({ file: fileName, startLine: 0, endLine: 0, side: "new", body });
    setShowFileCommentInput(false);
  };

  const handleFileCommentCancel = () => setShowFileCommentInput(false);

  const widgets = buildWidgets(
    hunks,
    lineLevelComments,
    pendingComment,
    handleSubmit,
    handleCancel,
    onResolve,
    onReopen,
    onDelete
  );

  const handleReviewedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const checked = e.target.checked;
    setReviewed(checked);
    if (checked) setCollapsed(true);
  };

  return (
    <div
      id={fileName}
      style={{
        marginBottom: 24,
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: "6px 12px",
          background: "var(--bg-tertiary)",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          fontSize: 12,
          fontFamily: "monospace",
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          userSelect: "none",
          opacity: reviewed ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 10, lineHeight: 1 }}>{collapsed ? "▸" : "▾"}</span>
        <span style={{ flex: 1 }}>{fileName}</span>
        <button
          onClick={e => { e.stopPropagation(); setShowFileCommentInput(v => !v); }}
          title="Comment on file"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 11,
            padding: "1px 7px",
            fontFamily: "sans-serif",
            lineHeight: 1.6,
          }}
        >
          &#128172;
        </button>
        <label
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontFamily: "sans-serif" }}
        >
          <input
            type="checkbox"
            checked={reviewed}
            onChange={handleReviewedChange}
            style={{ cursor: "pointer" }}
          />
          Reviewed
        </label>
      </div>
      {(fileLevelComments.length > 0 || showFileCommentInput) && (
        <div style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}>
          {fileLevelComments.map(comment => (
            <CommentWidget
              key={comment.id}
              comment={comment}
              freshness={comment.freshness}
              onResolve={onResolve}
              onReopen={onReopen}
              onDelete={onDelete}
            />
          ))}
          {showFileCommentInput && (
            <CommentInput onSubmit={handleFileCommentSubmit} onCancel={handleFileCommentCancel} />
          )}
        </div>
      )}
      {!collapsed && (
        <div style={{ overflowX: "auto" }}>
          <Diff
            viewType={viewType}
            diffType={type}
            hunks={hunks}
            tokens={tokens ?? null}
            widgets={widgets}
            gutterEvents={{ onClick: handleGutterClick }}
          >
            {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        </div>
      )}
    </div>
  );
}
