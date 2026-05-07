# Future: Orchestrator CLI (Approach C)

This is a future enhancement to implement after the ephemeral server + centralized storage work is complete.

## Concept

A lightweight CLI layer on top of the instance registry that helps manage multiple running diff-review instances.

## Commands

```
diff-review list              # show all running instances (repo, port, uptime)
diff-review connect <repo>    # open browser to existing instance, or start one
diff-review stop <repo>       # graceful shutdown of a running instance
diff-review stop --all        # shut down all instances
```

## Why Later

- The instance registry file gives agents everything they need for discovery today
- Human ergonomics (listing, connecting) can be added once the core model proves out
- Keeps the initial implementation focused on the storage + API changes
