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

  it("returns 400 if pattern is missing", async () => {
    const res = await supertest(app)
      .put("/api/preferences/ignore")
      .send({ scope: "global" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/preferences/ignore", () => {
  it("removes a pattern", async () => {
    await supertest(app).put("/api/preferences/ignore").send({ pattern: "**/*.bazel", scope: "global" });
    const res = await supertest(app).delete("/api/preferences/ignore").send({ pattern: "**/*.bazel", scope: "global" });
    expect(res.status).toBe(200);

    const get = await supertest(app).get("/api/preferences");
    expect(get.body.global).toEqual([]);
  });
});
