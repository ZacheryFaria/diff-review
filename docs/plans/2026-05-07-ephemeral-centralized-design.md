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

## Changes to Existing Code

### Storage class
- Read/write from `~/.diff-review/reviews/<repo-slug>/`
- Remove `.gitignore` auto-append logic
- Add repo slug resolution

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
- `FileTree.tsx`: ignore filtering + collapsed "N ignored" section
- `App.tsx`: gear icon + preferences modal
- New `PreferencesModal` component
- Context menu on file entries
- Badge agent-sourced comments in `CommentWidget.tsx`
