---
name: diff-review
description: Use when the user wants to start a code review, launch diff-review, consume review feedback, or when they mention diff-review comments. Covers launching the diff-review server, reading review comments from ~/.diff-review/ JSON files, and acting on feedback.
---

# diff-review — Local Code Review for Claude

## Overview

`diff-review` is a local tool that provides a GitHub-style diff view in the browser where the user leaves inline comments for Claude to act on. Comments are stored centrally at `~/.diff-review/reviews/<repo-slug>/` keyed by branch comparison.

## Commands

### Launch diff-review

Start the server for the current repo (random available port):

```bash
diff-review &
```

Or with a specific port/repo:

```bash
diff-review --repo /path/to/repo --port 9000 &
```

The server picks a random port by default and prints it on startup. Instance metadata is written to `~/.diff-review/instances/<repo-slug>.json`.

### Discover a running instance

Check if a server is already running for a repo:

```bash
cat ~/.diff-review/instances/<repo-slug>.json
```

This returns `{ "port": N, "pid": N, "repoPath": "...", "startedAt": "..." }`.

### Stop diff-review

Via the agent API:

```bash
curl -s -X POST http://localhost:<port>/api/agent/shutdown
```

Or via signal:

```bash
kill $(cat ~/.diff-review/instances/<repo-slug>.json | python3 -c "import json,sys;print(json.load(sys.stdin)['pid'])")
```

### Consume review feedback

When the user says something like "check my review", "read my comments", "address the feedback", or "look at diff-review":

1. **Find the review file.** Look in `~/.diff-review/reviews/<repo-slug>/` for JSON files. The filename encodes the branch comparison: `base..head.json` (slashes replaced with dashes).

   ```bash
   ls ~/.diff-review/reviews/<repo-slug>/*.json 2>/dev/null
   ```

2. **Read the review file.** Parse the JSON. The schema:

   ```typescript
   interface DiffReviewFile {
     version: 1;
     repo: string;
     base: string;          // base branch name
     head: string;          // head branch name
     comments: Comment[];
   }

   interface Comment {
     id: string;
     file: string;          // relative path from repo root
     startLine: number;     // line in the file (not diff-relative)
     endLine: number;       // same as startLine for single-line comments
     side: "old" | "new";   // "old" = base version, "new" = head version
     body: string;          // the feedback text
     status: "open" | "resolved";
     source?: string;       // "human", "agent", "claude", etc.
     anchor: {
       baseCommit: string;
       headCommit: string;
       hunkHash: string;
       context: string[];   // original source lines
     };
   }
   ```

3. **Process only open comments.** Filter for `status: "open"`. Ignore resolved comments.

4. **For each open comment:**
   - Read the file at `comment.file`
   - Go to `comment.startLine` through `comment.endLine`
   - `comment.side` tells you whether it's about the old (base) or new (head) code
   - `comment.body` is the user's feedback — implement it
   - `comment.anchor.context` shows the exact lines the comment was placed on (useful if line numbers have shifted)

5. **After addressing a comment**, mark it resolved via the API if the server is running:

   ```bash
   curl -s -X PATCH http://localhost:<port>/api/comments/<id> \
     -H "Content-Type: application/json" \
     -d '{"base":"<base>","head":"<head>","status":"resolved"}'
   ```

   Or if the server is not running, update the JSON file directly — set `"status": "resolved"` on the comment.

6. **Report what you did** — summarize which comments you addressed and how.

## Agent API

The agent API is at `/api/agent/` and provides bulk operations:

### Bulk create comments

```bash
curl -s -X POST http://localhost:<port>/api/agent/comments \
  -H "Content-Type: application/json" \
  -d '{
    "base": "main",
    "head": "feature",
    "comments": [
      { "file": "src/foo.ts", "startLine": 10, "endLine": 12, "side": "new", "body": "Consider extracting this" }
    ]
  }'
```

Returns `{ "success": true, "data": { "comments": [...] } }`. All comments get `source: "agent"`.

### List comments (filtered)

```bash
curl -s "http://localhost:<port>/api/agent/comments?base=main&head=feature&file=src/foo.ts&status=open&source=agent"
```

### Bulk resolve

```bash
curl -s -X PATCH http://localhost:<port>/api/agent/comments/resolve \
  -H "Content-Type: application/json" \
  -d '{"base":"main","head":"feature","ids":["c_123_abc","c_124_def"]}'
```

### Graceful shutdown

```bash
curl -s -X POST http://localhost:<port>/api/agent/shutdown
```

## Structural Diff (AST Analysis)

diff-review includes an AST-aware structural diff powered by tree-sitter. Users can toggle it per-file via the "AST" button in the file header. When enabled, it detects:

- **Moved blocks** — functions/classes that moved position but are otherwise unchanged
- **Renamed symbols** — blocks whose identifier changed but body is >80% similar
- **Formatting-only changes** — blocks (or whole files) where only whitespace differs

The structural diff API endpoint:

```bash
curl -s "http://localhost:<port>/api/structural-diff?file=src/foo.ts&base=main&head=feature"
```

Returns `{ "supported": true, "changes": [...] }` or `{ "supported": false, "reason": "..." }`.

Supported languages: JS, TS, JSX, TSX, Python, Go, Rust, CSS, HTML, JSON, YAML, Bash, SQL, C, C++, Java, Ruby, PHP, Swift, Kotlin.

## Staleness

Each comment has a `freshness` field when fetched from the API:
- `"fresh"` — the comment is still relevant
- `"stale"` — the underlying code changed since the comment was made
- `"orphaned"` — the file/hunk no longer exists in the diff

For stale/orphaned comments, check `anchor.context` to understand what the user was referring to, then use your judgment about whether the feedback still applies.

## Repo Slug

The repo slug is derived from the git remote `origin` URL:
- `https://github.com/org/repo.git` → `github.com-org-repo`
- `git@github.com:org/repo.git` → `github.com-org-repo`
- Fallback: directory basename if no remote

## File Ignore Preferences

Preferences are stored at `~/.diff-review/preferences.json` with global and per-repo patterns:

```json
{
  "global": { "ignoredPatterns": ["**/*.bazel"] },
  "repos": { "github.com-org-repo": { "ignoredPatterns": ["l10n/*.lock"] } }
}
```

The UI provides a gear icon to manage these patterns, and right-click context menu on files.

## Workflow

Typical flow:

1. User asks Claude to start a review: launch `diff-review`
2. User reviews in browser, leaves comments
3. User returns and asks Claude to address the feedback
4. Claude reads the review JSON, implements changes for each open comment
5. Claude marks comments as resolved via the API
6. If more review is needed, the cycle repeats

## URL Format

```
http://localhost:<port>/?base=main&head=feature-branch#src/components/Button.tsx
```

- `base` — the base branch
- `head` — the head branch
- `#fragment` — the file path to scroll to on load (URL-encoded)

## Rules

- Never modify the review JSON files except to change comment `status` to `"resolved"`
- Always address ALL open comments, not just some
- If a comment is ambiguous, read the surrounding code context before acting
- After making changes, run any relevant tests
