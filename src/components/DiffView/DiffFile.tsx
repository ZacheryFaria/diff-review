import { Diff, Hunk, tokenize, markEdits } from "react-diff-view";
import "react-diff-view/style/index.css";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const refractor = require("refractor") as { highlight: (code: string, language: string) => unknown };
import type { FileData } from "react-diff-view";

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

interface DiffFileProps {
  fileData: FileData;
  viewType: "unified" | "split";
}

export function DiffFile({ fileData, viewType }: DiffFileProps) {
  const { oldRevision, newRevision, type, hunks, oldPath, newPath } = fileData;
  const fileName = newPath || oldPath || "unknown";
  const language = getLanguage(fileName);

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
        >
          {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      </div>
    </div>
  );
}
