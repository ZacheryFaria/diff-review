import { useState } from "react";
import type { Comment } from "../../types/schema";

type Freshness = "fresh" | "stale" | "orphaned";

interface CommentWidgetProps {
  comment: Comment;
  freshness?: Freshness;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, body: string) => void;
}

export function CommentWidget({ comment, freshness, onResolve, onReopen, onDelete, onEdit }: CommentWidgetProps) {
  const isResolved = comment.status === "resolved";
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const handleSave = () => {
    onEdit(comment.id, editBody);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditBody(comment.body);
    setEditing(false);
  };

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
        {(comment as any).source && (comment as any).source !== "human" && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 3,
            background: "rgba(99, 102, 241, 0.15)",
            color: "#818cf8",
            border: "1px solid #818cf8",
            letterSpacing: "0.03em",
          }}>
            {(comment as any).source}
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
      {editing ? (
        <div>
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            style={{
              width: "100%",
              minHeight: 60,
              fontSize: 13,
              fontFamily: "inherit",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={handleSave} style={{ padding: "3px 10px", fontSize: 11, cursor: "pointer", borderRadius: 4, border: "1px solid var(--border)", background: "var(--accent)", color: "white" }}>
              Save
            </button>
            <button onClick={handleCancel} style={{ padding: "3px 10px", fontSize: 11, cursor: "pointer", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{comment.body}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
        <span>L{comment.startLine}{comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}</span>
        <span>{comment.side}</span>
        <span style={{ flex: 1 }} />
        {!editing && (
          <button onClick={() => { setEditBody(comment.body); setEditing(true); }} style={{ background: "none", border: "none", color: "var(--text-link)", cursor: "pointer", fontSize: 11 }}>
            Edit
          </button>
        )}
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
