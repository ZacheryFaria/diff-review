import { Router, IRouter } from "express";
import { getMergeBase, getFileAtRef } from "../git.js";
import { createParser, isStructuralDiffSupported } from "../structural/grammar-registry.js";
import { extractBlocks } from "../structural/block-extractor.js";
import { matchBlocks } from "../structural/matcher.js";
import type { StructuralChange } from "../structural/types.js";

export const structuralDiffRouter: IRouter = Router();

const MAX_LINES = 10000;

structuralDiffRouter.get("/structural-diff", async (req, res) => {
  try {
    const { file, base, head } = req.query as { file: string; base: string; head: string };
    if (!file || !base || !head) {
      return res.status(400).json({ error: "file, base, and head query params required" });
    }

    if (!isStructuralDiffSupported(file)) {
      return res.json({ supported: false, reason: "Language not supported for structural diff" });
    }

    const repoDir = req.app.locals.repoDir;
    const mergeBase = await getMergeBase(repoDir, base, head);

    let oldSource: string;
    let newSource: string;
    try {
      oldSource = await getFileAtRef(repoDir, mergeBase, file);
    } catch {
      oldSource = "";
    }
    try {
      newSource = await getFileAtRef(repoDir, head, file);
    } catch {
      newSource = "";
    }

    if (!oldSource && !newSource) {
      return res.json({ supported: true, changes: [] });
    }

    if (oldSource.split("\n").length > MAX_LINES || newSource.split("\n").length > MAX_LINES) {
      return res.json({ supported: false, reason: "File too large for structural analysis (>10K lines)" });
    }

    const parser = await createParser(file);
    if (!parser) {
      return res.json({ supported: false, reason: "No parser available for this file type" });
    }

    const oldTree = oldSource ? parser.parse(oldSource) : null;
    const newTree = newSource ? parser.parse(newSource) : null;

    const oldBlocks = oldTree ? extractBlocks(oldTree, oldSource) : [];
    const newBlocks = newTree ? extractBlocks(newTree, newSource) : [];

    const changes: StructuralChange[] = matchBlocks(oldBlocks, newBlocks, oldSource, newSource);

    res.json({ supported: true, changes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
