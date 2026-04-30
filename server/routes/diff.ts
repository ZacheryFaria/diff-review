import { Router } from "express";
import { getDiff, getMergeBase, getFileStats, resolveRef } from "../git.js";

export const diffRouter = Router();

diffRouter.get("/diff", async (req, res) => {
  try {
    const { base, head } = req.query as { base: string; head: string };
    if (!base || !head) return res.status(400).json({ error: "base and head query params required" });
    const repoDir = req.app.locals.repoDir;
    const mergeBase = await getMergeBase(repoDir, base, head);
    const diff = await getDiff(repoDir, mergeBase, head);
    const baseCommit = await resolveRef(repoDir, mergeBase);
    const headCommit = await resolveRef(repoDir, head);
    res.json({ diff, baseCommit, headCommit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

diffRouter.get("/merge-base", async (req, res) => {
  try {
    const { ref1, ref2 } = req.query as { ref1: string; ref2: string };
    if (!ref1 || !ref2) return res.status(400).json({ error: "ref1 and ref2 query params required" });
    const commit = await getMergeBase(req.app.locals.repoDir, ref1, ref2);
    res.json({ commit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

diffRouter.get("/files", async (req, res) => {
  try {
    const { base, head } = req.query as { base: string; head: string };
    if (!base || !head) return res.status(400).json({ error: "base and head query params required" });
    const repoDir = req.app.locals.repoDir;
    const mergeBase = await getMergeBase(repoDir, base, head);
    const files = await getFileStats(repoDir, mergeBase, head);
    res.json({ files });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
