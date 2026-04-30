import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { resolveRef, getDiff, getMergeBase } from "../git.js";
import { Storage } from "../storage.js";

export const commentsRouter = Router();

function generateId(): string {
  return `c_${Date.now()}_${randomBytes(3).toString("hex")}`;
}

commentsRouter.get("/comments", async (req, res) => {
  try {
    const { base, head } = req.query as { base: string; head: string };
    if (!base || !head) return res.status(400).json({ error: "base and head query params required" });
    const storage: Storage = req.app.locals.storage;
    const review = await storage.load(base, head);
    if (!review) return res.json({ comments: [] });
    res.json({ comments: review.comments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

commentsRouter.post("/comments", async (req, res) => {
  try {
    const { base, head, file, startLine, endLine, side, body } = req.body;
    const storage: Storage = req.app.locals.storage;
    const repoDir: string = req.app.locals.repoDir;

    const baseCommit = await resolveRef(repoDir, base);
    const headCommit = await resolveRef(repoDir, head);
    const mergeBase = await getMergeBase(repoDir, base, head);
    const diffText = await getDiff(repoDir, mergeBase, head);

    // Find the hunk containing the commented file and hash it
    const filePattern = `diff --git a/${file} b/${file}`;
    const fileStart = diffText.indexOf(filePattern);
    let hunkHash = "";
    let context: string[] = [];
    if (fileStart !== -1) {
      const nextFile = diffText.indexOf("\ndiff --git", fileStart + 1);
      const fileDiff = nextFile === -1 ? diffText.slice(fileStart) : diffText.slice(fileStart, nextFile);
      hunkHash = createHash("sha256").update(fileDiff).digest("hex").slice(0, 16);
      const lines = fileDiff.split("\n");
      context = lines.filter(l => l.startsWith("+") || l.startsWith("-")).slice(0, 10);
    }

    const now = new Date().toISOString();
    const comment = {
      id: generateId(),
      file,
      startLine,
      endLine,
      side,
      body,
      status: "open" as const,
      createdAt: now,
      anchor: { baseCommit, headCommit, hunkHash, context },
    };

    let review = await storage.load(base, head);
    if (!review) {
      review = {
        version: 1,
        repo: repoDir,
        base,
        head,
        createdAt: now,
        updatedAt: now,
        comments: [],
      };
    }
    review.comments.push(comment);
    review.updatedAt = now;
    await storage.save(review);

    res.status(201).json(comment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

commentsRouter.patch("/comments/:id", async (req, res) => {
  try {
    const { base, head, status, body: newBody } = req.body;
    const storage: Storage = req.app.locals.storage;
    const review = await storage.load(base, head);
    if (!review) return res.status(404).json({ error: "Review not found" });

    const comment = review.comments.find((c: any) => c.id === req.params.id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (status) (comment as any).status = status;
    if (newBody) (comment as any).body = newBody;
    review.updatedAt = new Date().toISOString();
    await storage.save(review);
    res.json(comment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

commentsRouter.delete("/comments/:id", async (req, res) => {
  try {
    const { base, head } = req.body;
    const storage: Storage = req.app.locals.storage;
    const review = await storage.load(base, head);
    if (!review) return res.status(404).json({ error: "Review not found" });

    review.comments = review.comments.filter((c: any) => c.id !== req.params.id);
    review.updatedAt = new Date().toISOString();
    await storage.save(review);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
