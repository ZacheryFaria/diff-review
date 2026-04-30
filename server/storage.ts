import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createRequire } from "module";
import Ajv from "ajv";
import addFormats from "ajv-formats";

// Load schema.json from the project root using createRequire so it works
// regardless of JSON import assertion support in the runtime.
const require = createRequire(import.meta.url);
const schema = require("../schema.json");

// Mirror the generated type from src/types/schema.ts inline so this module
// stays within server/ (tsconfig.server.json has rootDir: "server").
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
  private repoDir: string;

  constructor(repoDir: string) {
    this.repoDir = repoDir;
    this.dir = join(repoDir, ".diff-review");
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });

    const gitignorePath = join(this.repoDir, ".gitignore");
    try {
      const content = await readFile(gitignorePath, "utf-8");
      if (!content.includes(".diff-review/")) {
        await writeFile(gitignorePath, content.trimEnd() + "\n.diff-review/\n");
      }
    } catch (e: any) {
      if (e.code === "ENOENT") {
        await writeFile(gitignorePath, ".diff-review/\n");
      } else {
        throw e;
      }
    }
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
