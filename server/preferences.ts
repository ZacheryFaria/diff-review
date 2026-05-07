import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

interface PreferencesData {
  global: { ignoredPatterns: string[] };
  repos: Record<string, { ignoredPatterns: string[] }>;
}

export class Preferences {
  private filePath: string;

  constructor(baseDir: string) {
    this.filePath = join(baseDir, "preferences.json");
  }

  private async load(): Promise<PreferencesData> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch (e: any) {
      if (e.code === "ENOENT") {
        return { global: { ignoredPatterns: [] }, repos: {} };
      }
      throw e;
    }
  }

  private async save(data: PreferencesData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2) + "\n");
  }

  async getIgnoredPatterns(repoSlug: string): Promise<{ global: string[]; repo: string[] }> {
    const data = await this.load();
    return {
      global: data.global.ignoredPatterns,
      repo: data.repos[repoSlug]?.ignoredPatterns ?? [],
    };
  }

  async addPattern(pattern: string, scope: "global" | "repo", repoSlug?: string): Promise<void> {
    const data = await this.load();
    if (scope === "global") {
      if (!data.global.ignoredPatterns.includes(pattern)) {
        data.global.ignoredPatterns.push(pattern);
      }
    } else {
      if (!repoSlug) throw new Error("repoSlug required for repo scope");
      if (!data.repos[repoSlug]) data.repos[repoSlug] = { ignoredPatterns: [] };
      if (!data.repos[repoSlug].ignoredPatterns.includes(pattern)) {
        data.repos[repoSlug].ignoredPatterns.push(pattern);
      }
    }
    await this.save(data);
  }

  async removePattern(pattern: string, scope: "global" | "repo", repoSlug?: string): Promise<void> {
    const data = await this.load();
    if (scope === "global") {
      data.global.ignoredPatterns = data.global.ignoredPatterns.filter(p => p !== pattern);
    } else {
      if (!repoSlug) throw new Error("repoSlug required for repo scope");
      if (data.repos[repoSlug]) {
        data.repos[repoSlug].ignoredPatterns = data.repos[repoSlug].ignoredPatterns.filter(p => p !== pattern);
      }
    }
    await this.save(data);
  }
}
