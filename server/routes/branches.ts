import { Router, IRouter } from "express";
import { getBranches } from "../git.js";

export const branchesRouter: IRouter = Router();

branchesRouter.get("/branches", async (req, res) => {
  try {
    const result = await getBranches(req.app.locals.repoDir);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
