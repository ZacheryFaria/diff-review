import { useState } from "react";

interface CommentInputProps {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

export function CommentInput({ onSubmit, onCancel }: CommentInputProps) {
  const [body, setBody] = useState("");

  return (
    <div style={{
      padding: 12,
      margin: "4px 0",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      borderLeft: "3px solid var(--accent)",
    }}>
      <textarea
        autoFocus
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Leave a comment..."
        rows={3}
        style={{
          width: "100%",
          padding: 8,
          background: "var(--bg-tertiary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          resize: "vertical",
          boxSizing: "border-box",
        }}
        onKeyDown={e => {
          if (e.key === "Enter" && e.metaKey && body.trim()) {
            onSubmit(body.trim());
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{
          padding: "4px 12px", fontSize: 12, cursor: "pointer",
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--text-secondary)", borderRadius: 4,
        }}>Cancel</button>
        <button
          onClick={() => body.trim() && onSubmit(body.trim())}
          disabled={!body.trim()}
          style={{
            padding: "4px 12px", fontSize: 12, cursor: "pointer",
            background: "var(--accent)", border: "none",
            color: "#fff", borderRadius: 4, opacity: body.trim() ? 1 : 0.5,
          }}
        >Comment (Cmd+Enter)</button>
      </div>
    </div>
  );
}
