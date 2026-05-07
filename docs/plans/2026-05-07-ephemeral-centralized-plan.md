# Ephemeral Server + Centralized Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor diff-review to use centralized `~/.diff-review/` storage, ephemeral random-port servers with instance registry, a dedicated agent API, and a file ignore system with UI.

**Architecture:** Single-repo Express server, data centralized in `~/.diff-review/`. Each server instance registers itself in `~/.diff-review/instances/`. New `/api/agent/` namespace for bulk operations. Preferences stored in `~/.diff-review/preferences.json` with glob matching via `picomatch`.

**Tech Stack:** Node.js, Express, TypeScript, React 18, Vite, picomatch (new dep), AJV, yargs

---

### Task 1: Add `picomatch` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install picomatch**

Run: `pnpm add picomatch && pnpm add -D @types/picomatch`

**Step 2: Verify installation**

Run: `pnpm ls picomatch`
Expected: picomatch listed in dependencies

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "minor: add picomatch dependency for glob pattern matching"
```

---

### Task 2: Add `source` field to Comment schema

**Files:**
- Modify: `schema.json`
- Regenerate: `src/types/schema.ts`

**Step 1: Write failing test — validate a comment with source field**

Add to `server/__tests__/storage.test.ts`:

```typescript
it("accepts a comment with an optional source field", async () => {
  await storage.ensureDir();
  const review = {
    version: 1 as const,
    repo: repoDir,
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/__tests__/storage.test.ts`
Expected: FAIL — AJV rejects `source` as additional property

**Step 3: Add source field to schema.json**

In `schema.json`, inside `$defs.Comment.properties`, add:

```json
"source": {
  "type": "string",
  "description": "Origin of the comment (e.g. 'human', 'claude'). Defaults to 'human' if omitted."
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/__tests__/storage.test.ts`
Expected: PASS

**Step 5: Regenerate types**

Run: `pnpm run generate-types`

**Step 6: Commit**

```bash
git add schema.json src/types/schema.ts server/__tests__/storage.test.ts
git commit -m "minor: add optional source field to Comment schema"
```

---

### Task 3: Repo slug resolution utility

**Files:**
- Create: `server/repo-slug.ts`
- Create: `server/__tests__/repo-slug.test.ts`

**Step 1: Write failing test**

Create `server/__tests__/repo-slug.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { repoSlugFromRemote, sanitizeSlug } from "../repo-slug.js";

describe("repoSlugFromRemote", () => {
  it("parses HTTPS github remote", () => {
    expect(repoSlugFromRemote("https://github.com/zfaria/diff-review.git"))
      .toBe("github.com-zfaria-diff-review");
  });

  it("parses SSH github remote", () => {
    expect(repoSlugFromRemote("git@github.com:zfaria/diff-review.git"))
      .toBe("github.com-zfaria-diff-review");
  });

  it("strips .git suffix", () => {
    expect(repoSlugFromRemote("https://github.com/org/repo.git"))
      .toBe("github.com-org-repo");
  });

  it("handles URLs without .git suffix", () => {
    expect(repoSlugFromRemote("https://github.com/org/repo"))
      .toBe("github.com-org-repo");
  });
});

describe("sanitizeSlug", () => {
  it("replaces unsafe characters", () => {
    expect(sanitizeSlug("git@github.com:org/repo")).toBe("git-github.com-org-repo");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/__tests__/repo-slug.test.ts`
Expected: FAIL — module not found

**Step 3: Implement repo-slug.ts**

Create `server/repo-slug.ts`:

```typescript
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import { basename } from "path";

const execFile = promisify(execFileCb);

export function sanitizeSlug(raw: string): string {
  return raw.replace(/[/:@]/g, "-");
}

export function repoSlugFromRemote(remoteUrl: string): string {
  let cleaned = remoteUrl.replace(/\.git$/, "");

  // SSH format: git@github.com:org/repo
  const sshMatch = cleaned.match(/^[^@]+@([^:]+):(.+)$/);
  if (sshMatch) {
    return sanitizeSlug(`${sshMatch[1]}/${sshMatch[2]}`);
  }

  // HTTPS format: https://github.com/org/repo
  try {
    const url = new URL(cleaned);
    return sanitizeSlug(`${url.host}${url.pathname}`);
  } catch {
    return sanitizeSlug(cleaned);
  }
}

export async function getRepoSlug(repoDir: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", ["remote", "get-url", "origin"], { cwd: repoDir });
    return repoSlugFromRemote(stdout.trim());
  } catch {
    return sanitizeSlug(basename(repoDir));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/__tests__/repo-slug.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/repo-slug.ts server/__tests__/repo-slug.test.ts
git commit -m "minor: add repo slug resolution from git remote URL"
```

---

### Task 4: Rewrite Storage class for centralized `~/.diff-review/`

**Files:**
- Modify: `server/storage.ts`
- Modify: `server/__tests__/storage.test.ts`

**Step 1: Rewrite storage tests for new directory structure**

Replace the storage test file contents. The Storage constructor now takes `(repoSlug: string, baseDir?: string)` where `baseDir` defaults to `~/.diff-review` but can be overridden for tests.

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stat } from "fs/promises";
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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/__tests__/storage.test.ts`
Expected: FAIL — constructor signature mismatch

**Step 3: Rewrite storage.ts**

```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const schema = require("../schema.json");

export interface DiffReviewFile {
  version: 1;
  repo: string;
  base: string;
  head: string;
  createdAt: string;
  updatedAt: string;
  comments: unknown[];
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile<DiffReviewFile>(schema);

export class Storage {
  private dir: string;

  constructor(repoSlug: string, baseDir?: string) {
    const root = baseDir ?? join(homedir(), ".diff-review");
    this.dir = join(root, "reviews", repoSlug);
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  reviewFilePath(base: string, head: string): string {
    const safeName = `${base}..${head}`.replace(/\//g, "-");
    return join(this.dir, `${safeName}.json`);
  }

  async load(base: string, head: string): Promise<DiffReviewFile | null> {
    const filePath = this.reviewFilePath(base, head);
    try {
      const raw = await readFile(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (!validate(data)) {
        throw new Error(`Invalid review file: ${JSON.stringify(validate.errors)}`);
      }
      return data;
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  async save(review: DiffReviewFile): Promise<void> {
    if (!validate(review)) {
      throw new Error(`Invalid review data: ${JSON.stringify(validate.errors)}`);
    }
    const filePath = this.reviewFilePath(review.base, review.head);
    await writeFile(filePath, JSON.stringify(review, null, 2) + "\n");
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/__tests__/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/storage.ts server/__tests__/storage.test.ts
git commit -m "major: rewrite storage to use centralized ~/.diff-review/reviews/"
```

---

### Task 5: Instance registry

**Files:**
- Create: `server/instance-registry.ts`
- Create: `server/__tests__/instance-registry.test.ts`

**Step 1: Write failing tests**

Create `server/__tests__/instance-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { InstanceRegistry } from "../instance-registry.js";

let testBaseDir: string;
let registry: InstanceRegistry;

beforeEach(async () => {
  testBaseDir = await mkdtemp(join(tmpdir(), "diff-review-instances-"));
  registry = new InstanceRegistry(testBaseDir);
});

afterEach(async () => {
  await rm(testBaseDir, { recursive: true, force: true });
});

describe("register", () => {
  it("writes instance file with port, pid, repoPath, startedAt", async () => {
    await registry.register("github.com-test-repo", { port: 9281, pid: 12345, repoPath: "/tmp/repo" });
    const raw = await readFile(join(testBaseDir, "instances", "github.com-test-repo.json"), "utf-8");
    const data = JSON.parse(raw);
    expect(data.port).toBe(9281);
    expect(data.pid).toBe(12345);
    expect(data.repoPath).toBe("/tmp/repo");
    expect(data.startedAt).toBeDefined();
  });
});

describe("lookup", () => {
  it("returns null if no instance registered", async () => {
    const result = await registry.lookup("nonexistent");
    expect(result).toBeNull();
  });

  it("returns instance data if registered", async () => {
    await registry.register("github.com-test-repo", { port: 9281, pid: 12345, repoPath: "/tmp/repo" });
    const result = await registry.lookup("github.com-test-repo");
    expect(result!.port).toBe(9281);
  });
});

describe("unregister", () => {
  it("removes the instance file", async () => {
    await registry.register("github.com-test-repo", { port: 9281, pid: 12345, repoPath: "/tmp/repo" });
    await registry.unregister("github.com-test-repo");
    const result = await registry.lookup("github.com-test-repo");
    expect(result).toBeNull();
  });
});

describe("isAlive", () => {
  it("returns true for current process pid", async () => {
    await registry.register("github.com-test-repo", { port: 9281, pid: process.pid, repoPath: "/tmp/repo" });
    const alive = await registry.isAlive("github.com-test-repo");
    expect(alive).toBe(true);
  });

  it("returns false for non-existent pid", async () => {
    await registry.register("github.com-test-repo", { port: 9281, pid: 999999, repoPath: "/tmp/repo" });
    const alive = await registry.isAlive("github.com-test-repo");
    expect(alive).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/__tests__/instance-registry.test.ts`
Expected: FAIL — module not found

**Step 3: Implement instance-registry.ts**

Create `server/instance-registry.ts`:

```typescript
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

export interface InstanceInfo {
  port: number;
  pid: number;
  repoPath: string;
  startedAt: string;
}

export class InstanceRegistry {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = join(baseDir, "instances");
  }

  private filePath(slug: string): string {
    return join(this.dir, `${slug}.json`);
  }

  async register(slug: string, info: Omit<InstanceInfo, "startedAt">): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const data: InstanceInfo = { ...info, startedAt: new Date().toISOString() };
    await writeFile(this.filePath(slug), JSON.stringify(data, null, 2) + "\n");
  }

  async lookup(slug: string): Promise<InstanceInfo | null> {
    try {
      const raw = await readFile(this.filePath(slug), "utf-8");
      return JSON.parse(raw);
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  async unregister(slug: string): Promise<void> {
    try {
      await unlink(this.filePath(slug));
    } catch (e: any) {
      if (e.code === "ENOENT") return;
      throw e;
    }
  }

  async isAlive(slug: string): Promise<boolean> {
    const info = await this.lookup(slug);
    if (!info) return false;
    try {
      process.kill(info.pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/__tests__/instance-registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/instance-registry.ts server/__tests__/instance-registry.test.ts
git commit -m "minor: add instance registry for tracking running servers"
```

---

### Task 6: Preferences storage utility

**Files:**
- Create: `server/preferences.ts`
- Create: `server/__tests__/preferences.test.ts`

**Step 1: Write failing tests**

Create `server/__tests__/preferences.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/__tests__/preferences.test.ts`
Expected: FAIL — module not found

**Step 3: Implement preferences.ts**

Create `server/preferences.ts`:

```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

interface PreferencesData {
  global: { ignoredPatterns: string[] };
  repos: Record<string, { ignoredPatterns: string[] }>;
}

export class Preferences {
  private filePath: string;

  constructor(baseDir: string) {
    this.filePath = join(baseDir, "preferences.json");
  }

  private async load(): Promise<PreferencesData> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        return { global: { ignoredPatterns: [] }, repos: {} };
      }
      throw e;
    }
  }

  private async save(data: PreferencesData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2) + "\n");
  }

  async getIgnoredPatterns(repoSlug: string): Promise<{ global: string[]; repo: string[] }> {
    const data = await this.load();
    return {
      global: data.global.ignoredPatterns,
      repo: data.repos[repoSlug]?.ignoredPatterns ?? [],
    };
  }

  async addPattern(pattern: string, scope: "global" | "repo", repoSlug?: string): Promise<void> {
    const data = await this.load();
    if (scope === "global") {
      if (!data.global.ignoredPatterns.includes(pattern)) {
        data.global.ignoredPatterns.push(pattern);
      }
    } else {
      if (!repoSlug) throw new Error("repoSlug required for repo scope");
      if (!data.repos[repoSlug]) data.repos[repoSlug] = { ignoredPatterns: [] };
      if (!data.repos[repoSlug].ignoredPatterns.includes(pattern)) {
        data.repos[repoSlug].ignoredPatterns.push(pattern);
      }
    }
    await this.save(data);
  }

  async removePattern(pattern: string, scope: "global" | "repo", repoSlug?: string): Promise<void> {
    const data = await this.load();
    if (scope === "global") {
      data.global.ignoredPatterns = data.global.ignoredPatterns.filter(p => p !== pattern);
    } else {
      if (!repoSlug) throw new Error("repoSlug required for repo scope");
      if (data.repos[repoSlug]) {
        data.repos[repoSlug].ignoredPatterns = data.repos[repoSlug].ignoredPatterns.filter(p => p !== pattern);
      }
    }
    await this.save(data);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/__tests__/preferences.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/preferences.ts server/__tests__/preferences.test.ts
git commit -m "minor: add preferences storage for file ignore patterns"
```

---

### Task 7: Agent API router

**Files:**
- Create: `server/routes/agent.ts`
- Create: `server/__tests__/agent-routes.test.ts`

**Step 1: Write failing tests**

Create `server/__tests__/agent-routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import supertest from "supertest";
import express from "express";
import { agentRouter } from "../routes/agent.js";
import { Storage } from "../storage.js";

let testBaseDir: string;
let app: express.Express;
const SLUG = "github.com-test-repo";

beforeEach(async () => {
  testBaseDir = await mkdtemp(join(tmpdir(), "diff-review-agent-"));
  const storage = new Storage(SLUG, testBaseDir);
  await storage.ensureDir();

  app = express();
  app.use(express.json());
  app.locals.storage = storage;
  app.locals.repoDir = "/tmp/test-repo";
  app.locals.repoSlug = SLUG;
  app.use("/api/agent", agentRouter);
});

afterEach(async () => {
  await rm(testBaseDir, { recursive: true, force: true });
});

describe("POST /api/agent/comments", () => {
  it("bulk creates comments and returns them", async () => {
    const res = await supertest(app)
      .post("/api/agent/comments")
      .send({
        base: "main",
        head: "feature",
        comments: [
          { file: "src/a.ts", startLine: 1, endLine: 1, side: "new", body: "first" },
          { file: "src/b.ts", startLine: 5, endLine: 10, side: "new", body: "second" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comments).toHaveLength(2);
    expect(res.body.data.comments[0].source).toBe("agent");
    expect(res.body.data.comments[0].file).toBe("src/a.ts");
    expect(res.body.data.comments[1].file).toBe("src/b.ts");
  });
});

describe("GET /api/agent/comments", () => {
  it("returns comments filtered by file", async () => {
    // Create some comments first
    await supertest(app).post("/api/agent/comments").send({
      base: "main", head: "feature",
      comments: [
        { file: "src/a.ts", startLine: 1, endLine: 1, side: "new", body: "on a" },
        { file: "src/b.ts", startLine: 1, endLine: 1, side: "new", body: "on b" },
      ],
    });

    const res = await supertest(app)
      .get("/api/agent/comments?base=main&head=feature&file=src/a.ts");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.comments[0].file).toBe("src/a.ts");
  });

  it("returns comments filtered by status", async () => {
    await supertest(app).post("/api/agent/comments").send({
      base: "main", head: "feature",
      comments: [{ file: "src/a.ts", startLine: 1, endLine: 1, side: "new", body: "open one" }],
    });

    const res = await supertest(app)
      .get("/api/agent/comments?base=main&head=feature&status=resolved");
    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(0);
  });
});

describe("PATCH /api/agent/comments/resolve", () => {
  it("bulk resolves comments by ID", async () => {
    const createRes = await supertest(app).post("/api/agent/comments").send({
      base: "main", head: "feature",
      comments: [
        { file: "src/a.ts", startLine: 1, endLine: 1, side: "new", body: "first" },
        { file: "src/b.ts", startLine: 1, endLine: 1, side: "new", body: "second" },
      ],
    });
    const ids = createRes.body.data.comments.map((c: any) => c.id);

    const res = await supertest(app)
      .patch("/api/agent/comments/resolve")
      .send({ base: "main", head: "feature", ids });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resolved).toBe(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/__tests__/agent-routes.test.ts`
Expected: FAIL — module not found

**Step 3: Implement agent router**

Create `server/routes/agent.ts`:

```typescript
import { Router, IRouter } from "express";
import { randomBytes } from "crypto";
import { Storage } from "../storage.js";

export const agentRouter: IRouter = Router();

function generateId(): string {
  return `c_${Date.now()}_${randomBytes(3).toString("hex")}`;
}

agentRouter.post("/comments", async (req, res) => {
  try {
    const { base, head, comments: inputComments } = req.body;
    if (!base || !head || !Array.isArray(inputComments)) {
      return res.status(400).json({ success: false, error: "base, head, and comments[] required" });
    }

    const storage: Storage = req.app.locals.storage;
    const repoDir: string = req.app.locals.repoDir;
    const now = new Date().toISOString();

    let review = await storage.load(base, head);
    if (!review) {
      review = { version: 1, repo: repoDir, base, head, createdAt: now, updatedAt: now, comments: [] };
    }

    const created = inputComments.map((c: any) => ({
      id: generateId(),
      file: c.file,
      startLine: c.startLine ?? 0,
      endLine: c.endLine ?? 0,
      side: c.side ?? "new",
      body: c.body,
      status: "open" as const,
      source: "agent",
      createdAt: now,
      anchor: { baseCommit: "", headCommit: "", hunkHash: "", context: [] },
    }));

    review.comments.push(...created);
    review.updatedAt = now;
    await storage.save(review);

    res.status(201).json({ success: true, data: { comments: created } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

agentRouter.get("/comments", async (req, res) => {
  try {
    const { base, head, file, status, source } = req.query as Record<string, string>;
    if (!base || !head) {
      return res.status(400).json({ success: false, error: "base and head query params required" });
    }

    const storage: Storage = req.app.locals.storage;
    const review = await storage.load(base, head);
    if (!review) return res.json({ success: true, data: { comments: [] } });

    let comments = review.comments as any[];
    if (file) comments = comments.filter(c => c.file === file);
    if (status) comments = comments.filter(c => c.status === status);
    if (source) comments = comments.filter(c => c.source === source);

    res.json({ success: true, data: { comments } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

agentRouter.patch("/comments/resolve", async (req, res) => {
  try {
    const { base, head, ids } = req.body;
    if (!base || !head || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: "base, head, and ids[] required" });
    }

    const storage: Storage = req.app.locals.storage;
    const review = await storage.load(base, head);
    if (!review) return res.status(404).json({ success: false, error: "Review not found" });

    let resolved = 0;
    for (const comment of review.comments as any[]) {
      if (ids.includes(comment.id) && comment.status !== "resolved") {
        comment.status = "resolved";
        resolved++;
      }
    }
    review.updatedAt = new Date().toISOString();
    await storage.save(review);

    res.json({ success: true, data: { resolved } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

agentRouter.post("/shutdown", (_req, res) => {
  res.json({ success: true, data: { message: "shutting down" } });
  setTimeout(() => process.exit(0), 100);
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/__tests__/agent-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/agent.ts server/__tests__/agent-routes.test.ts
git commit -m "minor: add /api/agent/ router with bulk comment operations and shutdown"
```

---

### Task 8: Preferences API router

**Files:**
- Create: `server/routes/preferences.ts`
- Create: `server/__tests__/preferences-routes.test.ts`

**Step 1: Write failing tests**

Create `server/__tests__/preferences-routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import supertest from "supertest";
import express from "express";
import { preferencesRouter } from "../routes/preferences.js";
import { Preferences } from "../preferences.js";

let testBaseDir: string;
let app: express.Express;

beforeEach(async () => {
  testBaseDir = await mkdtemp(join(tmpdir(), "diff-review-prefs-routes-"));
  const prefs = new Preferences(testBaseDir);

  app = express();
  app.use(express.json());
  app.locals.preferences = prefs;
  app.locals.repoSlug = "github.com-test-repo";
  app.use("/api/preferences", preferencesRouter);
});

afterEach(async () => {
  await rm(testBaseDir, { recursive: true, force: true });
});

describe("GET /api/preferences", () => {
  it("returns empty patterns initially", async () => {
    const res = await supertest(app).get("/api/preferences");
    expect(res.status).toBe(200);
    expect(res.body.global).toEqual([]);
    expect(res.body.repo).toEqual([]);
  });
});

describe("PUT /api/preferences/ignore", () => {
  it("adds a global pattern", async () => {
    const res = await supertest(app)
      .put("/api/preferences/ignore")
      .send({ pattern: "**/*.bazel", scope: "global" });
    expect(res.status).toBe(200);

    const get = await supertest(app).get("/api/preferences");
    expect(get.body.global).toContain("**/*.bazel");
  });

  it("adds a repo pattern", async () => {
    const res = await supertest(app)
      .put("/api/preferences/ignore")
      .send({ pattern: "l10n/*.lock", scope: "repo" });
    expect(res.status).toBe(200);

    const get = await supertest(app).get("/api/preferences");
    expect(get.body.repo).toContain("l10n/*.lock");
  });
});

describe("DELETE /api/preferences/ignore", () => {
  it("removes a pattern", async () => {
    await supertest(app).put("/api/preferences/ignore").send({ pattern: "**/*.bazel", scope: "global" });
    await supertest(app).delete("/api/preferences/ignore").send({ pattern: "**/*.bazel", scope: "global" });

    const get = await supertest(app).get("/api/preferences");
    expect(get.body.global).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/__tests__/preferences-routes.test.ts`
Expected: FAIL — module not found

**Step 3: Implement preferences router**

Create `server/routes/preferences.ts`:

```typescript
import { Router, IRouter } from "express";
import { Preferences } from "../preferences.js";

export const preferencesRouter: IRouter = Router();

preferencesRouter.get("/", async (req, res) => {
  try {
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    const patterns = await prefs.getIgnoredPatterns(slug);
    res.json(patterns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

preferencesRouter.put("/ignore", async (req, res) => {
  try {
    const { pattern, scope } = req.body;
    if (!pattern || !scope) return res.status(400).json({ error: "pattern and scope required" });
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    await prefs.addPattern(pattern, scope, scope === "repo" ? slug : undefined);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

preferencesRouter.delete("/ignore", async (req, res) => {
  try {
    const { pattern, scope } = req.body;
    if (!pattern || !scope) return res.status(400).json({ error: "pattern and scope required" });
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    await prefs.removePattern(pattern, scope, scope === "repo" ? slug : undefined);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/__tests__/preferences-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/preferences.ts server/__tests__/preferences-routes.test.ts
git commit -m "minor: add /api/preferences router for ignore pattern management"
```

---

### Task 9: Wire up server/index.ts with new modules

**Files:**
- Modify: `server/index.ts`

**Step 1: Update createApp to use new Storage, agent router, preferences router**

Rewrite `server/index.ts`:

```typescript
import express, { Express } from "express";
import { resolve } from "path";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { branchesRouter } from "./routes/branches.js";
import { diffRouter } from "./routes/diff.js";
import { commentsRouter } from "./routes/comments.js";
import { agentRouter } from "./routes/agent.js";
import { preferencesRouter } from "./routes/preferences.js";
import { Storage } from "./storage.js";
import { Preferences } from "./preferences.js";
import { InstanceRegistry } from "./instance-registry.js";
import { getRepoRoot } from "./git.js";
import { getRepoSlug } from "./repo-slug.js";

export async function createApp(repoDir: string, baseDir?: string): Promise<Express> {
  const app = express();
  app.use(express.json());

  const root = baseDir ?? join(homedir(), ".diff-review");
  const repoSlug = await getRepoSlug(repoDir);

  const storage = new Storage(repoSlug, root);
  await storage.ensureDir();

  const preferences = new Preferences(root);

  app.locals.repoDir = repoDir;
  app.locals.repoSlug = repoSlug;
  app.locals.storage = storage;
  app.locals.preferences = preferences;

  app.use("/api", branchesRouter);
  app.use("/api", diffRouter);
  app.use("/api", commentsRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/preferences", preferencesRouter);

  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const clientDir = resolve(__dirname, "../client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(resolve(clientDir, "index.html"));
    });
  }

  return app;
}

export async function startServer(cwd: string, port?: number): Promise<{ app: Express; port: number; slug: string }> {
  const repoDir = await getRepoRoot(cwd);
  const root = join(homedir(), ".diff-review");
  const repoSlug = await getRepoSlug(repoDir);
  const registry = new InstanceRegistry(root);

  // Check for existing instance
  const existing = await registry.lookup(repoSlug);
  if (existing && await registry.isAlive(repoSlug)) {
    console.log(`Already running for ${repoSlug} at http://localhost:${existing.port}`);
    return { app: null as any, port: existing.port, slug: repoSlug };
  }

  const app = await createApp(repoDir, root);

  return new Promise((resolve) => {
    const server = app.listen(port ?? 0, async () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port ?? 0;

      await registry.register(repoSlug, { port: actualPort, pid: process.pid, repoPath: repoDir });

      const cleanup = async () => {
        await registry.unregister(repoSlug);
        process.exit(0);
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      console.log(`diff-review running at http://localhost:${actualPort}`);
      console.log(`Reviewing repo: ${repoDir} (${repoSlug})`);

      resolve({ app, port: actualPort, slug: repoSlug });
    });
  });
}
```

**Step 2: Run all existing tests to verify nothing broke**

Run: `pnpm vitest run`
Expected: PASS (the routes test may need adjustment — see next step)

**Step 3: Fix routes test if needed**

The `server/__tests__/routes.test.ts` may construct Storage with the old API. Update its `beforeEach` to pass `(SLUG, testBaseDir)` instead of `(repoDir)`. Read the file first to see what's needed.

**Step 4: Commit**

```bash
git add server/index.ts
git commit -m "major: wire up centralized storage, agent API, and preferences in server"
```

---

### Task 10: Update CLI entry point for random port + instance detection

**Files:**
- Modify: `bin/diff-review.js`

**Step 1: Rewrite bin/diff-review.js**

```javascript
#!/usr/bin/env node

import { startServer } from "../dist/server/index.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import open from "open";

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    describe: "Port to run the server on (default: random available port)",
  })
  .option("repo", {
    alias: "r",
    type: "string",
    default: ".",
    describe: "Path to the git repository",
  })
  .option("no-open", {
    type: "boolean",
    default: false,
    describe: "Don't open the browser automatically",
  })
  .parseSync();

startServer(argv.repo, argv.port).then(({ port }) => {
  if (!argv["no-open"]) {
    open(`http://localhost:${port}`);
  }
});
```

**Step 2: Verify the build compiles cleanly**

Run: `pnpm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add bin/diff-review.js
git commit -m "minor: update CLI for random port default and instance detection"
```

---

### Task 11: Update existing routes test for new Storage constructor

**Files:**
- Modify: `server/__tests__/routes.test.ts`

**Step 1: Read the existing test to understand what needs changing**

The test likely creates `new Storage(repoDir)` — change to `new Storage("test-slug", testBaseDir)`.

**Step 2: Run tests after fix**

Run: `pnpm vitest run server/__tests__/routes.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add server/__tests__/routes.test.ts
git commit -m "chore: update routes test for new Storage constructor signature"
```

---

### Task 12: Frontend — preferences API client

**Files:**
- Modify: `src/api.ts`

**Step 1: Add preferences API functions to src/api.ts**

Append to `src/api.ts`:

```typescript
export async function getPreferences(): Promise<{ global: string[]; repo: string[] }> {
  return fetchJson(`${BASE}/preferences`);
}

export async function addIgnorePattern(pattern: string, scope: "global" | "repo"): Promise<void> {
  return fetchJson(`${BASE}/preferences/ignore`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, scope }),
  });
}

export async function removeIgnorePattern(pattern: string, scope: "global" | "repo"): Promise<void> {
  return fetchJson(`${BASE}/preferences/ignore`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, scope }),
  });
}
```

**Step 2: Commit**

```bash
git add src/api.ts
git commit -m "minor: add preferences API client functions"
```

---

### Task 13: Frontend — usePreferences hook

**Files:**
- Create: `src/hooks/usePreferences.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import { getPreferences, addIgnorePattern, removeIgnorePattern } from "../api";
import picomatch from "picomatch";

export function usePreferences() {
  const [patterns, setPatterns] = useState<{ global: string[]; repo: string[] }>({ global: [], repo: [] });

  const refresh = useCallback(() => {
    getPreferences().then(setPatterns);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const allPatterns = [...patterns.global, ...patterns.repo];

  const isIgnored = useCallback((filePath: string) => {
    if (allPatterns.length === 0) return false;
    return picomatch.isMatch(filePath, allPatterns);
  }, [allPatterns]);

  const addPattern = useCallback(async (pattern: string, scope: "global" | "repo") => {
    await addIgnorePattern(pattern, scope);
    refresh();
  }, [refresh]);

  const removePattern = useCallback(async (pattern: string, scope: "global" | "repo") => {
    await removeIgnorePattern(pattern, scope);
    refresh();
  }, [refresh]);

  return { patterns, isIgnored, addPattern, removePattern, refresh };
}
```

**Step 2: Commit**

```bash
git add src/hooks/usePreferences.ts
git commit -m "minor: add usePreferences hook with glob matching"
```

---

### Task 14: Frontend — PreferencesModal component

**Files:**
- Create: `src/components/PreferencesModal.tsx`

**Step 1: Create the modal component**

```tsx
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
```

**Step 2: Commit**

```bash
git add src/components/PreferencesModal.tsx
git commit -m "minor: add PreferencesModal component"
```

---

### Task 15: Frontend — FileTree with ignore filtering and context menu

**Files:**
- Modify: `src/components/Sidebar/FileTree.tsx`

**Step 1: Update FileTree to accept ignore props and show context menu**

Rewrite `src/components/Sidebar/FileTree.tsx`:

```tsx
import { useState } from "react";

interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

interface FileTreeProps {
  files: FileStat[];
  activeFile: string | null;
  onFileClick: (file: string) => void;
  isIgnored: (file: string) => boolean;
  onIgnoreFile: (file: string) => void;
  onUnignoreFile: (file: string) => void;
}

export function FileTree({ files, activeFile, onFileClick, isIgnored, onIgnoreFile, onUnignoreFile }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: string } | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const visibleFiles = files.filter(f => !isIgnored(f.file));
  const ignoredFiles = files.filter(f => isIgnored(f.file));

  const handleContextMenu = (e: React.MouseEvent, file: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Files changed ({visibleFiles.length})
      </h3>
      <ul style={{ listStyle: "none" }}>
        {visibleFiles.map(f => (
          <li key={f.file}>
            <button
              onClick={() => onFileClick(f.file)}
              onContextMenu={(e) => handleContextMenu(e, f.file)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                background: activeFile === f.file ? "var(--bg-tertiary)" : "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                borderRadius: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.file}
              </span>
              <span style={{ flexShrink: 0, marginLeft: 8, fontSize: 11 }}>
                {f.additions > 0 && <span style={{ color: "var(--diff-add-text)" }}>+{f.additions}</span>}
                {f.additions > 0 && f.deletions > 0 && " "}
                {f.deletions > 0 && <span style={{ color: "var(--diff-del-text)" }}>-{f.deletions}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {ignoredFiles.length > 0 && (
        <button
          onClick={() => setShowIgnored(!showIgnored)}
          style={{
            width: "100%", textAlign: "left", padding: "6px 8px", marginTop: 8,
            background: "transparent", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", fontSize: 11, opacity: 0.7,
          }}
        >
          {showIgnored ? "▼" : "▶"} {ignoredFiles.length} ignored {ignoredFiles.length === 1 ? "file" : "files"}
        </button>
      )}
      {showIgnored && (
        <ul style={{ listStyle: "none", opacity: 0.5 }}>
          {ignoredFiles.map(f => (
            <li key={f.file}>
              <button
                onClick={() => onUnignoreFile(f.file)}
                style={{
                  width: "100%", textAlign: "left", padding: "4px 8px",
                  background: "transparent", border: "none", color: "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)", borderRadius: 4,
                }}
                title="Click to un-ignore"
              >
                {f.file}
              </button>
            </li>
          ))}
        </ul>
      )}

      {contextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setContextMenu(null)} />
          <div style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 6, padding: 4, minWidth: 160, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            <button
              onClick={() => { onIgnoreFile(contextMenu.file); setContextMenu(null); }}
              style={{
                width: "100%", textAlign: "left", padding: "6px 12px",
                background: "transparent", border: "none", color: "var(--text-primary)",
                cursor: "pointer", fontSize: 12, borderRadius: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-tertiary)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              Ignore this file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Sidebar/FileTree.tsx
git commit -m "minor: add ignore filtering and context menu to FileTree"
```

---

### Task 16: Frontend — Wire up App.tsx with preferences + gear icon

**Files:**
- Modify: `src/App.tsx`

**Step 1: Integrate usePreferences, PreferencesModal, and pass ignore props to FileTree and DiffView**

Key changes to `src/App.tsx`:
- Import `usePreferences` and `PreferencesModal`
- Add state: `showPreferences`
- Call `usePreferences()` to get `{ patterns, isIgnored, addPattern, removePattern }`
- Add gear icon button in the sidebar header
- Pass `isIgnored`, `onIgnoreFile`, `onUnignoreFile` to `<FileTree>`
- Pass `isIgnored` to `<DiffView>` (so ignored files are also hidden from the diff view)
- Render `<PreferencesModal>` when `showPreferences` is true
- `onIgnoreFile` calls `addPattern(file, "repo")` (exact path)
- `onUnignoreFile` calls `removePattern(file, "repo")`

**Step 2: Update DiffView to filter ignored files**

In `src/components/DiffView/DiffView.tsx`, add an `isIgnored` prop and filter the parsed files before rendering.

**Step 3: Verify dev server works**

Run: `pnpm dev`
Open browser, confirm gear icon appears, modal opens, file ignore works.

**Step 4: Commit**

```bash
git add src/App.tsx src/components/DiffView/DiffView.tsx
git commit -m "minor: integrate preferences UI with gear icon, modal, and file ignore filtering"
```

---

### Task 17: Frontend — Badge agent-sourced comments

**Files:**
- Modify: `src/components/DiffView/CommentWidget.tsx`

**Step 1: Add source badge to CommentWidget**

In `CommentWidget.tsx`, check if `(comment as any).source` exists and is not `"human"`. If so, render a small badge (similar to "Outdated" badge styling) showing the source name (e.g. "claude", "agent").

Add after the existing freshness badges:

```tsx
{(comment as any).source && (comment as any).source !== "human" && (
  <span style={{
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 3,
    background: "rgba(99, 102, 241, 0.15)",
    color: "#818cf8",
    border: "1px solid #818cf8",
    letterSpacing: "0.03em",
  }}>
    {(comment as any).source}
  </span>
)}
```

**Step 2: Commit**

```bash
git add src/components/DiffView/CommentWidget.tsx
git commit -m "minor: badge agent-sourced comments in diff view"
```

---

### Task 18: Run full test suite and verify build

**Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All PASS

**Step 2: Run build**

Run: `pnpm run build`
Expected: No errors

**Step 3: Commit any remaining fixes**

If any tests or build issues arise, fix and commit.

---

### Task 19: Update SKILL.md for new usage patterns

**Files:**
- Modify: `SKILL.md`

**Step 1: Update the skill doc to reflect:**
- Random port by default (no longer 3142)
- Instance registry at `~/.diff-review/instances/`
- Agent API endpoints at `/api/agent/`
- Shutdown endpoint
- Preferences at `~/.diff-review/preferences.json`

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "chore: update SKILL.md for ephemeral server and agent API"
```
