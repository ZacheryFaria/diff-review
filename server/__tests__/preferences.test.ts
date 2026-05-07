import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Preferences } from "../preferences.js";

let testBaseDir: string;
let prefs: Preferences;

beforeEach(async () => {
  testBaseDir = await mkdtemp(join(tmpdir(), "diff-review-prefs-"));
  prefs = new Preferences(testBaseDir);
});

afterEach(async () => {
  await rm(testBaseDir, { recursive: true, force: true });
});

describe("getIgnoredPatterns", () => {
  it("returns empty arrays when no preferences exist", async () => {
    const result = await prefs.getIgnoredPatterns("some-repo");
    expect(result.global).toEqual([]);
    expect(result.repo).toEqual([]);
  });

  it("returns merged global and repo patterns", async () => {
    await prefs.addPattern("**/*.bazel", "global");
    await prefs.addPattern("l10n/*.lock", "repo", "some-repo");
    const result = await prefs.getIgnoredPatterns("some-repo");
    expect(result.global).toEqual(["**/*.bazel"]);
    expect(result.repo).toEqual(["l10n/*.lock"]);
  });
});

describe("addPattern", () => {
  it("adds a global pattern", async () => {
    await prefs.addPattern("**/*.bazel", "global");
    const result = await prefs.getIgnoredPatterns("any-repo");
    expect(result.global).toContain("**/*.bazel");
  });

  it("adds a repo-specific pattern", async () => {
    await prefs.addPattern("src/generated/**", "repo", "my-repo");
    const result = await prefs.getIgnoredPatterns("my-repo");
    expect(result.repo).toContain("src/generated/**");
  });

  it("does not duplicate patterns", async () => {
    await prefs.addPattern("**/*.bazel", "global");
    await prefs.addPattern("**/*.bazel", "global");
    const result = await prefs.getIgnoredPatterns("any-repo");
    expect(result.global).toEqual(["**/*.bazel"]);
  });
});

describe("removePattern", () => {
  it("removes a global pattern", async () => {
    await prefs.addPattern("**/*.bazel", "global");
    await prefs.removePattern("**/*.bazel", "global");
    const result = await prefs.getIgnoredPatterns("any-repo");
    expect(result.global).toEqual([]);
  });

  it("removes a repo-specific pattern", async () => {
    await prefs.addPattern("l10n/*.lock", "repo", "my-repo");
    await prefs.removePattern("l10n/*.lock", "repo", "my-repo");
    const result = await prefs.getIgnoredPatterns("my-repo");
    expect(result.repo).toEqual([]);
  });
});
