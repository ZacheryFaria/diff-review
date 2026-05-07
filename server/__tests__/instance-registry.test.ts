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
