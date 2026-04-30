import express, { Express } from "express";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { branchesRouter } from "./routes/branches.js";
import { diffRouter } from "./routes/diff.js";
import { commentsRouter } from "./routes/comments.js";
import { Storage } from "./storage.js";
import { getRepoRoot } from "./git.js";

export async function createApp(repoDir: string): Promise<Express> {
  const app = express();
  app.use(express.json());

  const storage = new Storage(repoDir);
  await storage.ensureDir();

  app.locals.repoDir = repoDir;
  app.locals.storage = storage;

  app.use("/api", branchesRouter);
  app.use("/api", diffRouter);
  app.use("/api", commentsRouter);

  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const clientDir = resolve(__dirname, "../client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(clientDir, "index.html"));
  });

  return app;
}

export async function startServer(cwd: string, port: number): Promise<Express> {
  const repoDir = await getRepoRoot(cwd);
  const app = await createApp(repoDir);
  app.listen(port, () => {
    console.log(`diff-review running at http://localhost:${port}`);
    console.log(`Reviewing repo: ${repoDir}`);
  });
  return app;
}
