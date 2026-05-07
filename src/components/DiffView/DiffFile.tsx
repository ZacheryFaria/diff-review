import { useState, useEffect, type ReactNode } from "react";
import { Diff, Hunk, tokenize, markEdits, getChangeKey } from "react-diff-view";
import "react-diff-view/style/index.css";
import type { FileData, HunkData, ChangeData } from "react-diff-view";
import type { CommentWithFreshness } from "../../hooks/useComments";
import type { ReviewedFileState } from "../../api";
import { getStructuralDiff, type StructuralDiffResponse } from "../../api";
import { refractor, getLanguage } from "../../languages";
import { CommentWidget } from "./CommentWidget";
import { CommentInput } from "../CommentInput";

interface PendingComment {
  file: string;
  startLine: number;
  endLine: number;
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
  reviewedState?: ReviewedFileState;
  onMarkReviewed: () => Promise<void>;
  onUnmarkReviewed: () => Promise<void>;
  base: string;
  head: string;
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
    const change = findChangeForLine(allChanges, pendingComment.endLine, pendingComment.side);
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

export function DiffFile({ fileData, viewType, comments, onAddComment, onResolve, onReopen, onDelete, reviewedState, onMarkReviewed, onUnmarkReviewed, base, head }: DiffFileProps) {
  const { type, hunks, oldPath, newPath } = fileData;
  const fileName = newPath || oldPath || "unknown";
  const language = getLanguage(fileName);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [lastClickedLine, setLastClickedLine] = useState<{ line: number; side: "old" | "new" } | null>(null);
  const [showFileCommentInput, setShowFileCommentInput] = useState(false);
  const [collapsed, setCollapsed] = useState(!!reviewedState?.fresh);
  const [structuralMode, setStructuralMode] = useState(false);
  const [structuralData, setStructuralData] = useState<StructuralDiffResponse | null>(null);
  const [loadingStructural, setLoadingStructural] = useState(false);

  useEffect(() => {
    if (!structuralMode) return;
    if (structuralData) return;
    setLoadingStructural(true);
    getStructuralDiff(fileName, base, head)
      .then(setStructuralData)
      .finally(() => setLoadingStructural(false));
  }, [structuralMode]);

  const reviewed = !!reviewedState;
  const reviewedStale = reviewed && !reviewedState!.fresh;

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

  const handleGutterClick = ({ change, side }: { change: ChangeData | null; side?: "old" | "new" }, e?: MouseEvent) => {
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

    if (e?.shiftKey && lastClickedLine && lastClickedLine.side === side_) {
      const startLine = Math.min(lastClickedLine.line, line);
      const endLine = Math.max(lastClickedLine.line, line);
      setPendingComment({ file: fileName, startLine, endLine, side: side_ });
    } else {
      setPendingComment({ file: fileName, startLine: line, endLine: line, side: side_ });
      setLastClickedLine({ line, side: side_ });
    }
  };

  const handleSubmit = async (body: string) => {
    if (!pendingComment) return;
    await onAddComment({
      file: pendingComment.file,
      startLine: pendingComment.startLine,
      endLine: pendingComment.endLine,
      side: pendingComment.side,
      body,
    });
    setPendingComment(null);
    setLastClickedLine(null);
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
    if (e.target.checked) {
      onMarkReviewed();
      setCollapsed(true);
    } else {
      onUnmarkReviewed();
    }
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
        <span
          className="diff-file-link"
          onClick={e => {
            e.stopPropagation();
            const hash = `#${encodeURIComponent(fileName)}`;
            window.history.replaceState(null, "", `${window.location.search}${hash}`);
            navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}${hash}`);
          }}
          title="Click to copy link to this file"
        >{fileName}</span>
        <span style={{ flex: 1 }} />
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
          {reviewedStale ? "Reviewed (stale)" : "Reviewed"}
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
      {structuralMode && !collapsed && (
        <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          {loadingStructural && <span style={{ color: "var(--text-secondary)" }}>Analyzing...</span>}
          {structuralData && !structuralData.supported && (
            <span style={{ color: "var(--text-secondary)" }}>{structuralData.reason}</span>
          )}
          {structuralData && structuralData.supported && structuralData.changes && structuralData.changes.length === 0 && (
            <span style={{ color: "var(--text-secondary)" }}>No structural changes detected</span>
          )}
          {structuralData && structuralData.supported && structuralData.changes && structuralData.changes.map((change, i) => (
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
            gutterEvents={{ onClick: (info: any, e: any) => handleGutterClick(info, e) }}
          >
            {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        </div>
      )}
    </div>
  );
}
