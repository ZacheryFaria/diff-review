# Ephemeral Server + Centralized Storage Design

## Goals

- Remove the daemon model; servers are ephemeral (spawn and kill freely)
- Centralize all review data in `~/.diff-review/` so it's accessible regardless of where/how the server is started
- First-class agent API for bulk comment operations
- File ignore system (global + per-repo patterns) with UI support

## Centralized Storage

Location: `~/.diff-review/`

```
~/.diff-review/
├── reviews/
│   └── <repo-slug>/
│       └── base..head.json
├── instances/
│   └── <repo-slug>.json
└── preferences.json
```

### Repo Slug Derivation

1. Parse git remote `origin` URL → `github.com-org-repo`
2. Fallback to directory name if no remote
3. Sanitize: replace `/`, `:`, `@` with `-`

No migration of existing `.diff-review/` data in repos.

## Ephemeral Server & Instance Registry

### Startup

- `diff-review [--repo .] [--port N]` — defaults to CWD, random available port
- Resolves repo slug from git remote
- Writes `~/.diff-review/instances/<repo-slug>.json`:
  ```json
  { "port": 9281, "pid": 54321, "repoPath": "/path/to/repo", "startedAt": "..." }
  ```
- If instance file exists and PID is alive: print existing port, open browser, exit
- If stale: overwrite

### Shutdown

- SIGINT/SIGTERM or `POST /api/agent/shutdown`: clean up instance file, exit
- Shutdown endpoint returns 200 before exiting

### Port Selection

- Default: `server.listen(0)` for random available port
- `--port N` for explicit override

## Agent API (`/api/agent/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/comments` | Bulk create comments |
| `GET` | `/api/agent/comments` | List with filters (`?file=`, `?status=`, `?source=`) |
| `PATCH` | `/api/agent/comments/resolve` | Bulk resolve by ID list |
| `POST` | `/api/agent/shutdown` | Graceful shutdown |

### Bulk Create Body

```json
{
  "base": "main",
  "head": "feature",
  "comments": [
    { "file": "src/foo.ts", "startLine": 10, "endLine": 12, "side": "new", "body": "..." }
  ]
}
```

### Comment Source Field

New optional `source` field on comments (string, default `"human"`). Allows the UI to badge agent comments and agents to filter to their own.

### Response Format

All agent endpoints: `{ success: true, data: ... }` or `{ success: false, error: "..." }`.

## File Ignore System

### Storage (`~/.diff-review/preferences.json`)

```json
{
  "global": {
    "ignoredPatterns": ["**/*.bazel"]
  },
  "repos": {
    "github.com-zfaria-lca": {
      "ignoredPatterns": ["**/l10n/*.lock"]
    }
  }
}
```

Merge: union of global + repo-specific patterns. Glob matching via `picomatch` or `minimatch`.

### API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/preferences` | Merged ignore patterns for current repo |
| `PUT` | `/api/preferences/ignore` | Add pattern (`{ pattern, scope }`) |
| `DELETE` | `/api/preferences/ignore` | Remove pattern (`{ pattern, scope }`) |

### UI Behavior

- **Sidebar:** ignored files hidden; dimmed "N ignored files" badge at bottom, expandable with un-ignore buttons
- **Context menu:** right-click file → "Ignore this file" (exact path) or "Ignore files matching..." (glob input)
- **Gear icon modal:** two sections (Global / Repo), each with add/remove pattern controls

## Implementation Details

### Repo Slug Resolution

1. Parse git remote `origin` URL via `git remote get-url origin`
2. SSH format (`git@host:org/repo`) → extract host and path
3. HTTPS format → extract host + pathname via `new URL()`
4. Strip `.git` suffix
5. Sanitize: replace `/`, `:`, `@` with `-`
6. Fallback to `basename(cwd)` if no remote

### Storage Class Rewrite

Constructor: `Storage(repoSlug: string, baseDir?: string)` — baseDir defaults to `~/.diff-review`.

Review file path: `<baseDir>/reviews/<slug>/<base>..<head>.json` (slashes in branch names replaced with `-`).

Validates via AJV against `schema.json` on both load and save. Returns `null` for missing files.

### Instance Registry

- `register(slug, { port, pid, repoPath })` — writes `<baseDir>/instances/<slug>.json` with `startedAt` timestamp
- `lookup(slug)` — reads instance file, returns null if ENOENT
- `unregister(slug)` — deletes instance file
- `isAlive(slug)` — lookup + `process.kill(pid, 0)` to check if PID is alive

### CLI Entry Point

Uses `yargs` for CLI parsing with options: `--port` (optional, default random), `--repo` (default `.`), `--no-open`.

Calls `startServer()` which checks the instance registry before spawning. Opens browser via `open` package unless `--no-open`.

SIGINT/SIGTERM handlers unregister the instance before exiting.

### Agent Comment ID Generation

Format: `c_<timestamp>_<6 hex chars from randomBytes(3)>`

### Frontend Preferences Hook

`usePreferences()` returns `{ patterns, isIgnored, addPattern, removePattern, refresh }`.

`isIgnored` uses `picomatch.isMatch(filePath, allPatterns)` where allPatterns is the union of global + repo patterns.

### Comment Source Badge Styling

Agent-sourced comments get a small inline badge (indigo color scheme: `#818cf8` text, `rgba(99, 102, 241, 0.15)` background) showing the source value.

---

## Changes to Existing Code

### Storage class
- Read/write from `~/.diff-review/reviews/<repo-slug>/`
- Remove `.gitignore` auto-append logic
- New constructor: `Storage(repoSlug, baseDir?)`

### Schema
- Add optional `source: string` field to Comment

### CLI
- Default to random port via `listen(0)`
- Write/clean instance file
- Detect already-running instance

### Express app
- Mount `/api/agent/` router
- Mount `/api/preferences` router

### Frontend
- `FileTree.tsx`: ignore filtering + collapsed "N ignored" section + context menu
- `App.tsx`: gear icon + preferences modal
- New `PreferencesModal` component (modal with global/repo sections, add/remove controls)
- New `usePreferences` hook (picomatch-based glob matching)
- Badge agent-sourced comments in `CommentWidget.tsx`

## Tech Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Stack | Node.js, Express, React 18, Vite, TypeScript | Existing |
| Glob matching | `picomatch` | Small, fast, standard glob syntax |
| Schema validation | AJV + ajv-formats | Already in use |
| CLI parsing | `yargs` | Already in use |
| Browser opening | `open` | Already in use |
