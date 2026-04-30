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

  const widgets = buildWidgets(
    hunks,
    comments,
    pendingComment,
    handleSubmit,
    handleCancel,
    onResolve,
    onReopen,
    onDelete
  );

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
        style={{
          padding: "6px 12px",
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          fontFamily: "monospace",
          color: "var(--text-primary)",
        }}
      >
        {fileName}
      </div>
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
    </div>
  );
}
