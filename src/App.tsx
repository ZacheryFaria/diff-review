import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBranches } from "./api";
import { FileTree } from "./components/Sidebar/FileTree";
import { PreferencesModal } from "./components/PreferencesModal";
import {
  useDiffQuery,
  useFilesQuery,
  useCommentsQuery,
  useMarkReviewedMutation,
  useUnmarkReviewedMutation,
  useAddCommentMutation,
  useResolveCommentMutation,
  useReopenCommentMutation,
  useDeleteCommentMutation,
  useEditCommentMutation,
  usePreferencesQuery,
  useAddIgnorePatternMutation,
  useRemoveIgnorePatternMutation,
  reviewKeys,
} from "./hooks/queries";
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
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  const queryClient = useQueryClient();

  const diffQuery = useDiffQuery(base, head);
  const filesQuery = useFilesQuery(base, head);
  const commentsQuery = useCommentsQuery(base, head);
  const { patterns, isIgnored } = usePreferencesQuery();

  const addCommentMutation = useAddCommentMutation(base, head);
  const resolveCommentMutation = useResolveCommentMutation(base, head);
  const reopenCommentMutation = useReopenCommentMutation(base, head);
  const deleteCommentMutation = useDeleteCommentMutation(base, head);
  const editCommentMutation = useEditCommentMutation(base, head);
  const markReviewedMutation = useMarkReviewedMutation(base, head);
  const unmarkReviewedMutation = useUnmarkReviewedMutation(base, head);
  const addPatternMutation = useAddIgnorePatternMutation();
  const removePatternMutation = useRemoveIgnorePatternMutation();

  const diff = diffQuery.data?.diff ?? "";
  const baseCommit = diffQuery.data?.baseCommit ?? "";
  const headCommit = diffQuery.data?.headCommit ?? "";
  const diffLoading = diffQuery.isLoading;
  const diffError = diffQuery.error?.message ?? null;
  const comments = commentsQuery.data?.comments ?? [];
  const reviewedFiles = commentsQuery.data?.reviewedFiles ?? {};
  const files = filesQuery.data ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: reviewKeys.all });
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
            onIgnoreFile={(file) => addPatternMutation.mutate({ pattern: file, scope: "repo" })}
            onUnignoreFile={(file) => removePatternMutation.mutate({ pattern: file, scope: "repo" })}
            onFileClick={(file) => {
              setActiveFile(file);
              window.history.replaceState(null, "", `?${new URLSearchParams({ base, head })}#${encodeURIComponent(file)}`);
              document.getElementById(file)?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </aside>
      <main style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
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
              onAddComment={(data) => addCommentMutation.mutateAsync(data)}
              onResolve={(id) => resolveCommentMutation.mutate(id)}
              onReopen={(id) => reopenCommentMutation.mutate(id)}
              onDelete={(id) => deleteCommentMutation.mutate(id)}
              onEdit={(id, body) => editCommentMutation.mutate({ id, body })}
              reviewedFiles={reviewedFiles}
              onMarkReviewed={(file) => markReviewedMutation.mutateAsync(file)}
              onUnmarkReviewed={(file) => unmarkReviewedMutation.mutateAsync(file)}
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
          onAdd={(p, s) => addPatternMutation.mutate({ pattern: p, scope: s })}
          onRemove={(p, s) => removePatternMutation.mutate({ pattern: p, scope: s })}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );
}
