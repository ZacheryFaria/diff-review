import type { Comment } from "../../types/schema";

type Freshness = "fresh" | "stale" | "orphaned";

interface CommentWidgetProps {
  comment: Comment;
  freshness?: Freshness;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CommentWidget({ comment, freshness, onResolve, onReopen, onDelete }: CommentWidgetProps) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {freshness === "stale" && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 3,
            background: "var(--diff-mod-bg, #7a4f00)",
            color: "var(--diff-mod-text, #e6a817)",
            border: "1px solid var(--diff-mod-text, #e6a817)",
            letterSpacing: "0.03em",
          }}>
            Outdated
          </span>
        )}
        {freshness === "orphaned" && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 3,
            background: "rgba(220, 38, 38, 0.15)",
            color: "var(--diff-del-text, #f87171)",
            border: "1px solid var(--diff-del-text, #f87171)",
            letterSpacing: "0.03em",
          }}>
            Orphaned
          </span>
        )}
      </div>
      {freshness === "orphaned" && comment.anchor.context.length > 0 && (
        <pre style={{
          margin: "0 0 8px 0",
          padding: "6px 8px",
          fontSize: 11,
          fontFamily: "monospace",
          background: "var(--bg-tertiary, rgba(0,0,0,0.2))",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflowX: "auto",
          color: "var(--text-secondary)",
          whiteSpace: "pre",
        }}>
          {comment.anchor.context.join("\n")}
        </pre>
      )}
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
