import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import request from "supertest";
import { createApp } from "../index.js";

let repoDir: string;
let app: Awaited<ReturnType<typeof createApp>>;

function git(...args: string[]) {
  execFileSync("git", args, { cwd: repoDir });
}

beforeAll(async () => {
  repoDir = await mkdtemp(join(tmpdir(), "diff-review-routes-"));
  git("init");
  git("config", "user.email", "test@test.com");
  git("config", "user.name", "Test");
  await writeFile(join(repoDir, "hello.txt"), "hello\n");
  git("add", ".");
  git("commit", "-m", "initial");
  git("branch", "-M", "main");
  git("checkout", "-b", "feat");
  await writeFile(join(repoDir, "hello.txt"), "hello world\n");
  git("add", ".");
  git("commit", "-m", "update");

  app = await createApp(repoDir);
});

afterAll(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

describe("GET /api/branches", () => {
  it("returns branches", async () => {
    const res = await request(app).get("/api/branches");
    expect(res.status).toBe(200);
    expect(res.body.branches).toContain("main");
    expect(res.body.branches).toContain("feat");
  });
});

describe("GET /api/diff", () => {
  it("returns a diff", async () => {
    const res = await request(app).get("/api/diff?base=main&head=feat");
    expect(res.status).toBe(200);
    expect(res.body.diff).toContain("hello world");
  });
});

describe("GET /api/files", () => {
  it("returns file stats", async () => {
    const res = await request(app).get("/api/files?base=main&head=feat");
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].file).toBe("hello.txt");
  });
});

describe("POST /api/comments", () => {
  it("creates a comment and retrieves it", async () => {
    const comment = {
      base: "main",
      head: "feat",
      file: "hello.txt",
      startLine: 1,
      endLine: 1,
      side: "new",
      body: "Looks good",
    };
    const postRes = await request(app).post("/api/comments").send(comment);
    expect(postRes.status).toBe(201);
    expect(postRes.body.id).toBeDefined();

    const getRes = await request(app).get("/api/comments?base=main&head=feat");
    expect(getRes.status).toBe(200);
    expect(getRes.body.comments).toHaveLength(1);
    expect(getRes.body.comments[0].body).toBe("Looks good");
  });
});

describe("PATCH /api/comments/:id", () => {
  it("updates a comment status", async () => {
    const getRes = await request(app).get("/api/comments?base=main&head=feat");
    const id = getRes.body.comments[0].id;

    const patchRes = await request(app).patch(`/api/comments/${id}`).send({
      base: "main",
      head: "feat",
      status: "resolved",
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe("resolved");
  });
});

describe("DELETE /api/comments/:id", () => {
  it("removes a comment", async () => {
    const getRes = await request(app).get("/api/comments?base=main&head=feat");
    const id = getRes.body.comments[0].id;

    const delRes = await request(app).delete(`/api/comments/${id}`).send({
      base: "main",
      head: "feat",
    });
    expect(delRes.status).toBe(204);

    const getRes2 = await request(app).get("/api/comments?base=main&head=feat");
    expect(getRes2.body.comments).toHaveLength(0);
  });
});
