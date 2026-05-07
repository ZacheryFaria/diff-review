import { useState } from "react";

interface PreferencesModalProps {
  patterns: { global: string[]; repo: string[] };
  onAdd: (pattern: string, scope: "global" | "repo") => void;
  onRemove: (pattern: string, scope: "global" | "repo") => void;
  onClose: () => void;
}

export function PreferencesModal({ patterns, onAdd, onRemove, onClose }: PreferencesModalProps) {
  const [newPattern, setNewPattern] = useState("");
  const [scope, setScope] = useState<"global" | "repo">("repo");

  const handleAdd = () => {
    if (!newPattern.trim()) return;
    onAdd(newPattern.trim(), scope);
    setNewPattern("");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: 8, padding: 24, width: 480, maxHeight: "70vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Ignored Files</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>Global Patterns</h3>
          {patterns.global.length === 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>None</p>}
          {patterns.global.map(p => (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <code style={{ fontSize: 12 }}>{p}</code>
              <button onClick={() => onRemove(p, "global")} style={{ background: "none", border: "none", color: "var(--diff-del-text)", cursor: "pointer", fontSize: 11 }}>Remove</button>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>Repo Patterns</h3>
          {patterns.repo.length === 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>None</p>}
          {patterns.repo.map(p => (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <code style={{ fontSize: 12 }}>{p}</code>
              <button onClick={() => onRemove(p, "repo")} style={{ background: "none", border: "none", color: "var(--diff-del-text)", cursor: "pointer", fontSize: 11 }}>Remove</button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newPattern}
              onChange={e => setNewPattern(e.target.value)}
              placeholder="e.g. **/*.bazel"
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              style={{ flex: 1, padding: 6, background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, fontFamily: "var(--font-mono)" }}
            />
            <select value={scope} onChange={e => setScope(e.target.value as "global" | "repo")}
              style={{ padding: 6, background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}>
              <option value="repo">Repo</option>
              <option value="global">Global</option>
            </select>
            <button onClick={handleAdd} style={{ padding: "6px 12px", background: "var(--accent)", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
