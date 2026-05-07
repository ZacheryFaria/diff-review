import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Storage } from "../storage.js";

let testBaseDir: string;
let storage: Storage;
const SLUG = "github.com-test-repo";

beforeEach(async () => {
  testBaseDir = await mkdtemp(join(tmpdir(), "diff-review-storage-"));
  storage = new Storage(SLUG, testBaseDir);
});

afterEach(async () => {
  await rm(testBaseDir, { recursive: true, force: true });
});

describe("ensureDir", () => {
  it("creates the reviews/<slug> directory", async () => {
    await storage.ensureDir();
    const s = await stat(join(testBaseDir, "reviews", SLUG));
    expect(s.isDirectory()).toBe(true);
  });
});

describe("reviewFilePath", () => {
  it("generates path under reviews/<slug>/", () => {
    const path = storage.reviewFilePath("main", "zf/my-feature");
    expect(path).toBe(join(testBaseDir, "reviews", SLUG, "main..zf-my-feature.json"));
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
      repo: "/tmp/repo",
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
    const bad = { version: 999, repo: "/tmp" };
    await expect(storage.save(bad as any)).rejects.toThrow();
  });

  it("accepts a comment with an optional source field", async () => {
    await storage.ensureDir();
    const review = {
      version: 1 as const,
      repo: "/tmp/repo",
      base: "main",
      head: "feature",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [{
        id: "c_123_abc",
        file: "test.ts",
        startLine: 1,
        endLine: 1,
        side: "new",
        body: "test comment",
        status: "open",
        source: "claude",
        createdAt: new Date().toISOString(),
        anchor: { baseCommit: "abc", headCommit: "def", hunkHash: "1234567890abcdef", context: [] },
      }],
    };
    await storage.save(review);
    const loaded = await storage.load("main", "feature");
    expect((loaded!.comments[0] as any).source).toBe("claude");
  });
});
