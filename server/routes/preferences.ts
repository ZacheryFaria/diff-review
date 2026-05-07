import { Router, IRouter } from "express";
import { Preferences } from "../preferences.js";

export const preferencesRouter: IRouter = Router();

preferencesRouter.get("/", async (req, res) => {
  try {
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    const patterns = await prefs.getIgnoredPatterns(slug);
    res.json(patterns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

preferencesRouter.put("/ignore", async (req, res) => {
  try {
    const { pattern, scope } = req.body;
    if (!pattern || !scope) return res.status(400).json({ error: "pattern and scope required" });
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    await prefs.addPattern(pattern, scope, scope === "repo" ? slug : undefined);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

preferencesRouter.delete("/ignore", async (req, res) => {
  try {
    const { pattern, scope } = req.body;
    if (!pattern || !scope) return res.status(400).json({ error: "pattern and scope required" });
    const prefs: Preferences = req.app.locals.preferences;
    const slug: string = req.app.locals.repoSlug;
    await prefs.removePattern(pattern, scope, scope === "repo" ? slug : undefined);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
