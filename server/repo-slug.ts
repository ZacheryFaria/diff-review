import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import { basename } from "path";

const execFile = promisify(execFileCb);

export function sanitizeSlug(raw: string): string {
  return raw.replace(/[/:@]/g, "-");
}

export function repoSlugFromRemote(remoteUrl: string): string {
  let cleaned = remoteUrl.replace(/\.git$/, "");

  // SSH format: git@github.com:org/repo
  const sshMatch = cleaned.match(/^[^@]+@([^:]+):(.+)$/);
  if (sshMatch) {
    return sanitizeSlug(`${sshMatch[1]}/${sshMatch[2]}`);
  }

  // HTTPS format: https://github.com/org/repo
  try {
    const url = new URL(cleaned);
    return sanitizeSlug(`${url.host}${url.pathname}`);
  } catch {
    return sanitizeSlug(cleaned);
  }
}

export async function getRepoSlug(repoDir: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", ["remote", "get-url", "origin"], { cwd: repoDir });
    return repoSlugFromRemote(stdout.trim());
  } catch {
    return sanitizeSlug(basename(repoDir));
  }
}
