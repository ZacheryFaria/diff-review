import type { Comment } from "./types/schema";
import type { CommentWithFreshness } from "./hooks/useComments";

const BASE = "/api";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function getBranches(): Promise<{ branches: string[]; current: string }> {
  return fetchJson(`${BASE}/branches`);
}

export async function getDiff(base: string, head: string): Promise<{ diff: string; baseCommit: string; headCommit: string }> {
  return fetchJson(`${BASE}/diff?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
}

export async function getFiles(base: string, head: string): Promise<{ files: { file: string; additions: number; deletions: number }[] }> {
  return fetchJson(`${BASE}/files?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
}

export interface ReviewedFileState {
  reviewedAt: string;
  fileHash: string;
  fresh: boolean;
}

export async function getComments(base: string, head: string): Promise<{
  comments: CommentWithFreshness[];
  reviewedFiles: Record<string, ReviewedFileState>;
}> {
  return fetchJson(`${BASE}/comments?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
}

export async function createComment(data: {
  base: string;
  head: string;
  file: string;
  startLine: number;
  endLine: number;
  side: "old" | "new";
  body: string;
}): Promise<Comment> {
  return fetchJson(`${BASE}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateComment(id: string, data: {
  base: string;
  head: string;
  status?: string;
  body?: string;
}): Promise<Comment> {
  return fetchJson(`${BASE}/comments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteComment(id: string, base: string, head: string): Promise<void> {
  return fetchJson(`${BASE}/comments/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, head }),
  });
}

export async function markFileReviewed(file: string, base: string, head: string): Promise<void> {
  return fetchJson(`${BASE}/reviewed/${encodeURIComponent(file)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, head }),
  });
}

export async function unmarkFileReviewed(file: string, base: string, head: string): Promise<void> {
  return fetchJson(`${BASE}/reviewed/${encodeURIComponent(file)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, head }),
  });
}
