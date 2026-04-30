import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { getBranches, getDiff, getMergeBase, getFileStats, getRepoRoot, resolveRef } from "../git.js";

let repoDir: string;

function git(...args: string[]) {
  execFileSync("git", args, { cwd: repoDir });
}

beforeAll(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "diff-review-test-"));
  git("init");
  git("config", "user.email", "test@test.com");
  git("config", "user.name", "Test");

  await writeFile(join(repoDir, "file1.txt"), "line1\nline2\nline3\n");
  git("add", ".");
  git("commit", "-m", "initial");
  git("branch", "-M", "main");

  git("checkout", "-b", "feature");
  await writeFile(join(repoDir, "file1.txt"), "line1\nchanged\nline3\n");
  await writeFile(join(repoDir, "file2.txt"), "new file\n");
  git("add", ".");
  git("commit", "-m", "feature changes");
});

afterAll(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("getRepoRoot", () => {
  it("returns the repo root", async () => {
    const root = await getRepoRoot(repoDir);
    expect(root).toBe(repoDir);
  });
});

describe("getBranches", () => {
  it("returns all branches with current marked", async () => {
    const result = await getBranches(repoDir);
    expect(result.branches).toContain("main");
    expect(result.branches).toContain("feature");
    expect(result.current).toBe("feature");
  });
});

describe("getMergeBase", () => {
  it("returns the merge base commit", async () => {
    const base = await getMergeBase(repoDir, "main", "feature");
    expect(base).toMatch(/^[a-f0-9]+$/);
  });
});

describe("getDiff", () => {
  it("returns a unified diff string", async () => {
    const base = await getMergeBase(repoDir, "main", "feature");
    const diff = await getDiff(repoDir, base, "feature");
    expect(diff).toContain("file1.txt");
    expect(diff).toContain("+changed");
    expect(diff).toContain("file2.txt");
  });
});

describe("getFileStats", () => {
  it("returns changed files with addition/deletion counts", async () => {
    const base = await getMergeBase(repoDir, "main", "feature");
    const stats = await getFileStats(repoDir, base, "feature");
    expect(stats.length).toBe(2);
    const file1 = stats.find(s => s.file === "file1.txt");
    expect(file1).toBeDefined();
    expect(file1!.additions).toBeGreaterThan(0);
  });
});

describe("resolveRef", () => {
  it("resolves a branch name to a short SHA", async () => {
    const sha = await resolveRef(repoDir, "main");
    expect(sha).toMatch(/^[a-f0-9]{7,}$/);
  });
});
