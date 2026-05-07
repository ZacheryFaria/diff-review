import { useState, useEffect } from "react";
import { getBranches, getFiles } from "./api";
import { FileTree } from "./components/Sidebar/FileTree";
import { PreferencesModal } from "./components/PreferencesModal";
import { useDiff } from "./hooks/useDiff";
import { useComments } from "./hooks/useComments";
import { usePreferences } from "./hooks/usePreferences";
import { DiffView } from "./components/DiffView/DiffView";

function getInitialParam(key: string, fallback: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ?? fallback;
}

export function App() {
  const [branches, setBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [base, setBase] = useState(() => getInitialParam("base", "main"));
  const [head, setHead] = useState(() => getInitialParam("head", ""));
  const [files, setFiles] = useState<{ file: string; additions: number; deletions: number }[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const { diff, baseCommit, headCommit, loading: diffLoading, error: diffError, refresh: refreshDiff } = useDiff(base, head);
  const { comments, addComment, resolveComment, reopenComment, removeComment, reviewedFiles, markReviewed, unmarkReviewed, refresh: refreshComments } = useComments(base, head);
  const { patterns, isIgnored, addPattern, removePattern } = usePreferences();

  const handleRefresh = () => {
    refreshDiff();
    refreshComments();
    if (base && head && base !== head) {
      getFiles(base, head).then(({ files }) => setFiles(files));
    }
  };

  const openComments = comments.filter(c => c.status === "open");

  const scrollToFirstOpenComment = () => {
    const firstOpen = openComments[0];
    if (!firstOpen) return;
    const el = document.querySelector(`[data-comment-id="${firstOpen.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlHead = urlParams.get("head");
    const urlBase = urlParams.get("base");

    getBranches().then(({ branches, current }) => {
      setBranches(branches);
      setCurrent(current);
      if (!urlHead) setHead(current);
      if (!urlBase) {
        if (branches.includes("main")) setBase("main");
        else if (branches.includes("master")) setBase("master");
        else setBase(branches[0] ?? "");
      }
    });
  }, []);

  useEffect(() => {
    if (base && head && base !== head) {
      getFiles(base, head).then(({ files }) => setFiles(files));
    } else {
      setFiles([]);
    }
  }, [base, head]);

  useEffect(() => {
    if (base && head) {
      const params = new URLSearchParams({ base, head });
      const hash = window.location.hash;
      window.history.replaceState(null, "", `?${params}${hash}`);
    }
  }, [base, head]);

  useEffect(() => {
    if (diffLoading || !diff) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [diffLoading, diff]);

  void current;

  return (
    <>
      <aside style={{ width: 300, borderRight: "1px solid var(--border)", overflow: "auto" }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, margin: 0, color: "var(--text-secondary)" }}>diff-review</h2>
            <button
              onClick={() => setShowPreferences(true)}
              title="Preferences"
              style={{
                background: "none", border: "none", color: "var(--text-secondary)",
                cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 4,
              }}
            >
              ⚙
            </button>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Base</label>
            <select value={base} onChange={e => setBase(e.target.value)}
              style={{ width: "100%", marginBottom: 8, padding: 6, background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4 }}>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Head</label>
            <select value={head} onChange={e => setHead(e.target.value)}
              style={{ width: "100%", marginBottom: 8, padding: 6, background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4 }}>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            {base && head ? `Comparing ${base}...${head}` : "Select branches"}
          </p>
          <FileTree
            files={files}
            activeFile={activeFile}
            isIgnored={isIgnored}
            onIgnoreFile={(file) => addPattern(file, "repo")}
            onUnignoreFile={(file) => removePattern(file, "repo")}
            onFileClick={(file) => {
              setActiveFile(file);
              window.history.replaceState(null, "", `?${new URLSearchParams({ base, head })}#${encodeURIComponent(file)}`);
              document.getElementById(file)?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </aside>
      {openComments.length > 0 && (
        <button
          onClick={scrollToFirstOpenComment}
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 100,
            background: "var(--accent)",
            color: "white",
            borderRadius: 12,
            padding: "4px 12px",
            fontSize: 12,
            cursor: "pointer",
            border: "none",
            fontFamily: "inherit",
          }}
        >
          {openComments.length} open {openComments.length === 1 ? "comment" : "comments"}
        </button>
      )}
      <main style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {base && head && base !== head ? (
          diffLoading ? (
            <p style={{ color: "var(--text-secondary)" }}>Loading diff...</p>
          ) : diffError ? (
            <p style={{ color: "var(--text-secondary)" }}>Error: {diffError}</p>
          ) : !diff ? (
            <p style={{ color: "var(--text-secondary)" }}>No differences between {base} and {head}</p>
          ) : (
            <DiffView
              diffText={diff}
              baseCommit={baseCommit}
              headCommit={headCommit}
              base={base}
              head={head}
              comments={comments}
              onAddComment={addComment}
              onResolve={resolveComment}
              onReopen={reopenComment}
              onDelete={removeComment}
              reviewedFiles={reviewedFiles}
              onMarkReviewed={markReviewed}
              onUnmarkReviewed={unmarkReviewed}
              onRefresh={handleRefresh}
              isIgnored={isIgnored}
            />
          )
        ) : (
          <p style={{ color: "var(--text-secondary)" }}>Select two different branches to compare</p>
        )}
      </main>
      {showPreferences && (
        <PreferencesModal
          patterns={patterns}
          onAdd={addPattern}
          onRemove={removePattern}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );
}
