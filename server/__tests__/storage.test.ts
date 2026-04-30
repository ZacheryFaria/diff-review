import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Storage } from "../storage.js";

let repoDir: string;
let storage: Storage;

beforeEach(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "diff-review-storage-"));
  storage = new Storage(repoDir);
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("ensureDir", () => {
  it("creates the .diff-review directory", async () => {
    await storage.ensureDir();
    const stat = await import("fs/promises").then(fs => fs.stat(join(repoDir, ".diff-review")));
    expect(stat.isDirectory()).toBe(true);
  });

  it("appends to existing .gitignore", async () => {
    await writeFile(join(repoDir, ".gitignore"), "node_modules/\n");
    await storage.ensureDir();
    const content = await readFile(join(repoDir, ".gitignore"), "utf-8");
    expect(content).toContain(".diff-review/");
    expect(content).toContain("node_modules/");
  });

  it("creates .gitignore if missing", async () => {
    await storage.ensureDir();
    const content = await readFile(join(repoDir, ".gitignore"), "utf-8");
    expect(content).toContain(".diff-review/");
  });
});

describe("reviewFilePath", () => {
  it("generates a safe filename from branch names", () => {
    const path = storage.reviewFilePath("main", "zf/my-feature");
    expect(path).toBe(join(repoDir, ".diff-review", "main..zf-my-feature.json"));
  });
});

describe("load / save", () => {
  it("returns null for a nonexistent review", async () => {
    await storage.ensureDir();
    const data = await storage.load("main", "feature");
    expect(data).toBeNull();
  });

  it("round-trips a review file", async () => {
    await storage.ensureDir();
    const review = {
      version: 1 as const,
      repo: repoDir,
      base: "main",
      head: "feature",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
    await storage.save(review);
    const loaded = await storage.load("main", "feature");
    expect(loaded).toEqual(review);
  });

  it("rejects invalid data", async () => {
    await storage.ensureDir();
    const bad = { version: 999, repo: repoDir };
    await expect(storage.save(bad as any)).rejects.toThrow();
  });
});
