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
