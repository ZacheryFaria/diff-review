import express, { Express } from "express";
import { resolve, join } from "path";
import { existsSync } from "fs";
import { homedir } from "os";
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

  const existing = await registry.lookup(repoSlug);
  if (existing && await registry.isAlive(repoSlug)) {
    console.log(`Already running for ${repoSlug} at http://localhost:${existing.port}`);
    return { app: null as any, port: existing.port, slug: repoSlug };
  }

  const app = await createApp(repoDir, root);

  return new Promise((resolvePromise) => {
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

      resolvePromise({ app, port: actualPort, slug: repoSlug });
    });
  });
}
