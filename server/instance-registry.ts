import { readFile, writeFile, mkdir, unlink, readdir } from "fs/promises";
import { join } from "path";

export interface InstanceInfo {
  port: number;
  pid: number;
  repoPath: string;
  startedAt: string;
}

export class InstanceRegistry {
  private dir: string;

  constructor(baseDir: string) {
    this.dir = join(baseDir, "instances");
  }

  private filePath(slug: string): string {
    return join(this.dir, `${slug}.json`);
  }

  async register(slug: string, info: Omit<InstanceInfo, "startedAt">): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const data: InstanceInfo = { ...info, startedAt: new Date().toISOString() };
    await writeFile(this.filePath(slug), JSON.stringify(data, null, 2) + "\n");
  }

  async lookup(slug: string): Promise<InstanceInfo | null> {
    try {
      const raw = await readFile(this.filePath(slug), "utf-8");
      return JSON.parse(raw);
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  async unregister(slug: string): Promise<void> {
    try {
      await unlink(this.filePath(slug));
    } catch (e: any) {
      if (e.code === "ENOENT") return;
      throw e;
    }
  }

  async isAlive(slug: string): Promise<boolean> {
    const info = await this.lookup(slug);
    if (!info) return false;
    try {
      process.kill(info.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async listAll(): Promise<Array<{ slug: string } & InstanceInfo>> {
    await mkdir(this.dir, { recursive: true });
    const files = await readdir(this.dir);
    const results: Array<{ slug: string } & InstanceInfo> = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const slug = file.replace(/\.json$/, "");
      const info = await this.lookup(slug);
      if (info) results.push({ slug, ...info });
    }
    return results;
  }
}
