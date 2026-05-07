# Orchestrator CLI Design

## Scope

Add `list` and `stop` subcommands to `bin/diff-review.js`. Default (no subcommand) remains "start server."

## Commands

### `diff-review list`

- Reads all files in `~/.diff-review/instances/`
- Checks if PID is alive for each; removes stale entries automatically
- Prints a table with columns: REPO, PORT, URL, UPTIME
- If no instances running, prints "No running instances."

### `diff-review stop <query | --all>`

- **Partial match:** substring match on slug. Error if ambiguous (multiple matches) with a "did you mean?" listing.
- **`--all`:** stops all running instances.
- **Method:** POST to `http://localhost:<port>/api/agent/shutdown`. If HTTP fails, fall back to SIGTERM. Clean up the registry file either way.
- Prints confirmation per stopped instance.

## Implementation

- Yargs commands in `bin/diff-review.js` — `.command()` calls for `list` and `stop`, default handler is server start logic.
- `server/instance-registry.ts`: add `listAll()` method to enumerate all instance files.
- No new dependencies (yargs handles subcommands, `fetch` is built-in for shutdown HTTP call).

## Changes

| File | Change |
|------|--------|
| `bin/diff-review.js` | Restructure to yargs command pattern (default + list + stop) |
| `server/instance-registry.ts` | Add `listAll()` returning all registered instances |
