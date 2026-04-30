import { execFile as execFileCb } from "child_process";
import { realpath } from "fs/promises";
import { promisify } from "util";

const execFile = promisify(execFileCb);

async function run(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trimEnd();
}

export async function getRepoRoot(cwd: string): Promise<string> {
  // git resolves symlinks internally (e.g. /var -> /private/var on macOS).
  // Resolve cwd to its real path so git's output matches the input.
  // Then return the caller's original cwd if it resolves to the same location.
  const realCwd = await realpath(cwd);
  const gitRoot = await run(realCwd, "rev-parse", "--show-toplevel");
  // If the git root equals the resolved cwd, return the original cwd path
  // so callers get back the same string they passed in.
  if (gitRoot === realCwd) return cwd;
  return gitRoot;
}

export async function getBranches(repoDir: string): Promise<{ branches: string[]; current: string }> {
  const raw = await run(repoDir, "branch", "-a", "--format=%(refname:short)|%(HEAD)");
  const lines = raw.split("\n").filter(Boolean);
  let current = "";
  const branches: string[] = [];
  for (const line of lines) {
    const [name, head] = line.split("|");
    const clean = name.replace(/^origin\//, "");
    if (!branches.includes(clean) && clean !== "HEAD") {
      branches.push(clean);
    }
    if (head === "*") current = clean;
  }
  return { branches, current };
}

export async function getMergeBase(repoDir: string, ref1: string, ref2: string): Promise<string> {
  return run(repoDir, "merge-base", ref1, ref2);
}

export async function resolveRef(repoDir: string, ref: string): Promise<string> {
  return run(repoDir, "rev-parse", "--short", ref);
}

export async function getDiff(repoDir: string, base: string, head: string): Promise<string> {
  return run(repoDir, "diff", "--no-ext-diff", base, head);
}

export interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

export async function getFileStats(repoDir: string, base: string, head: string): Promise<FileStat[]> {
  const raw = await run(repoDir, "diff", "--no-ext-diff", "--numstat", base, head);
  return raw.split("\n").filter(Boolean).map(line => {
    const [add, del, file] = line.split("\t");
    return {
      file,
      additions: add === "-" ? 0 : parseInt(add, 10),
      deletions: del === "-" ? 0 : parseInt(del, 10),
    };
  });
}
