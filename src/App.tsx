import { useState, useEffect } from "react";
import { getBranches, getFiles } from "./api";
import { FileTree } from "./components/Sidebar/FileTree";

export function App() {
  const [branches, setBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [base, setBase] = useState("main");
  const [head, setHead] = useState("");
  const [files, setFiles] = useState<{ file: string; additions: number; deletions: number }[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  useEffect(() => {
    getBranches().then(({ branches, current }) => {
      setBranches(branches);
      setCurrent(current);
      setHead(current);
      if (branches.includes("main")) setBase("main");
      else if (branches.includes("master")) setBase("master");
      else setBase(branches[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (base && head && base !== head) {
      getFiles(base, head).then(({ files }) => setFiles(files));
    } else {
      setFiles([]);
    }
  }, [base, head]);

  return (
    <>
      <aside style={{ width: 300, borderRight: "1px solid var(--border)", overflow: "auto" }}>
        <div style={{ padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "var(--text-secondary)" }}>diff-review</h2>
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
            onFileClick={(file) => {
              setActiveFile(file);
              document.getElementById(file)?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </aside>
      <main style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {base && head && base !== head ? (
          <p>Diff view goes here — {base}...{head}</p>
        ) : (
          <p style={{ color: "var(--text-secondary)" }}>Select two different branches to compare</p>
        )}
      </main>
    </>
  );
}
