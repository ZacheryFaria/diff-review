import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
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

  it("returns 400 if comments array is missing", async () => {
    const res = await supertest(app)
      .post("/api/agent/comments")
      .send({ base: "main", head: "feature" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /api/agent/comments", () => {
  it("returns comments filtered by file", async () => {
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

  it("returns comments filtered by source", async () => {
    await supertest(app).post("/api/agent/comments").send({
      base: "main", head: "feature",
      comments: [{ file: "src/a.ts", startLine: 1, endLine: 1, side: "new", body: "agent comment" }],
    });

    const res = await supertest(app)
      .get("/api/agent/comments?base=main&head=feature&source=agent");
    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(1);
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
