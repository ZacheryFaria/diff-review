import type { Comment } from "../../types/schema";

interface CommentWidgetProps {
  comment: Comment;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CommentWidget({ comment, onResolve, onReopen, onDelete }: CommentWidgetProps) {
  const isResolved = comment.status === "resolved";
  return (
    <div style={{
      padding: 12,
      margin: "4px 0",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      borderLeft: `3px solid ${isResolved ? "var(--diff-add-text)" : "var(--accent)"}`,
      opacity: isResolved ? 0.7 : 1,
    }}>
      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{comment.body}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
        <span>L{comment.startLine}{comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}</span>
        <span>{comment.side}</span>
        <span style={{ flex: 1 }} />
        {isResolved ? (
          <button onClick={() => onReopen(comment.id)} style={{ background: "none", border: "none", color: "var(--text-link)", cursor: "pointer", fontSize: 11 }}>
            Reopen
          </button>
        ) : (
          <button onClick={() => onResolve(comment.id)} style={{ background: "none", border: "none", color: "var(--diff-add-text)", cursor: "pointer", fontSize: 11 }}>
            Resolve
          </button>
        )}
        <button onClick={() => onDelete(comment.id)} style={{ background: "none", border: "none", color: "var(--diff-del-text)", cursor: "pointer", fontSize: 11 }}>
          Delete
        </button>
      </div>
    </div>
  );
}
