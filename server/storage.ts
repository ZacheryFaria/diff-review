import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const schema = require("../schema.json");

export interface DiffReviewFile {
  version: 1;
  repo: string;
  base: string;
  head: string;
  createdAt: string;
  updatedAt: string;
  comments: unknown[];
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile<DiffReviewFile>(schema);

export class Storage {
  private dir: string;

  constructor(repoSlug: string, baseDir?: string) {
    const root = baseDir ?? join(homedir(), ".diff-review");
    this.dir = join(root, "reviews", repoSlug);
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  reviewFilePath(base: string, head: string): string {
    const safeName = `${base}..${head}`.replace(/\//g, "-");
    return join(this.dir, `${safeName}.json`);
  }

  async load(base: string, head: string): Promise<DiffReviewFile | null> {
    const filePath = this.reviewFilePath(base, head);
    try {
      const raw = await readFile(filePath, "utf-8");
      const data = JSON.parse(raw);
      if (!validate(data)) {
        throw new Error(`Invalid review file: ${JSON.stringify(validate.errors)}`);
      }
      return data;
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  async save(review: DiffReviewFile): Promise<void> {
    if (!validate(review)) {
      throw new Error(`Invalid review data: ${JSON.stringify(validate.errors)}`);
    }
    const filePath = this.reviewFilePath(review.base, review.head);
    await writeFile(filePath, JSON.stringify(review, null, 2) + "\n");
  }
}
