#!/usr/bin/env node

import { startServer } from "../dist/server/index.js";
import { InstanceRegistry } from "../dist/server/instance-registry.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import open from "open";
import { homedir } from "os";
import { join } from "path";

const root = join(homedir(), ".diff-review");

yargs(hideBin(process.argv))
  .command(
    "list",
    "Show all running diff-review instances",
    () => {},
    async () => {
      const registry = new InstanceRegistry(root);
      const instances = await registry.listAll();

      const alive = [];
      for (const inst of instances) {
        try {
          process.kill(inst.pid, 0);
          alive.push(inst);
        } catch {
          await registry.unregister(inst.slug);
        }
      }

      if (alive.length === 0) {
        console.log("No running instances.");
        return;
      }

      const repoWidth = Math.max(4, ...alive.map((i) => i.slug.length));
      const header = [
        "REPO".padEnd(repoWidth),
        "PORT",
        "URL",
        "UPTIME",
      ].join("  ");
      console.log(header);

      for (const inst of alive) {
        const uptime = formatUptime(inst.startedAt);
        const url = `http://localhost:${inst.port}`;
        const row = [
          inst.slug.padEnd(repoWidth),
          String(inst.port).padEnd(4),
          url.padEnd(3),
          uptime,
        ].join("  ");
        console.log(row);
      }
    }
  )
  .command(
    "stop [query]",
    "Stop a running instance (or --all)",
    (yargs) => {
      return yargs
        .positional("query", {
          type: "string",
          describe: "Substring to match against repo slug",
        })
        .option("all", {
          type: "boolean",
          default: false,
          describe: "Stop all running instances",
        });
    },
    async (argv) => {
      const registry = new InstanceRegistry(root);
      const instances = await registry.listAll();

      const alive = [];
      for (const inst of instances) {
        try {
          process.kill(inst.pid, 0);
          alive.push(inst);
        } catch {
          await registry.unregister(inst.slug);
        }
      }

      if (alive.length === 0) {
        console.log("No running instances.");
        return;
      }

      let targets;
      if (argv.all) {
        targets = alive;
      } else if (argv.query) {
        const matches = alive.filter((i) => i.slug.includes(argv.query));
        if (matches.length === 0) {
          console.error(`No instance matching "${argv.query}".`);
          console.error("Running instances:");
          for (const inst of alive) console.error(`  ${inst.slug}`);
          process.exit(1);
        }
        if (matches.length > 1) {
          console.error(`Ambiguous match for "${argv.query}". Did you mean:`);
          for (const inst of matches) console.error(`  ${inst.slug}`);
          process.exit(1);
        }
        targets = matches;
      } else {
        console.error("Provide a query or use --all.");
        process.exit(1);
      }

      for (const inst of targets) {
        await stopInstance(registry, inst);
      }
    }
  )
  .command(
    "$0",
    "Start a diff-review server",
    (yargs) => {
      return yargs
        .option("port", {
          alias: "p",
          type: "number",
          describe: "Port to run the server on (default: random available port)",
        })
        .option("repo", {
          alias: "r",
          type: "string",
          default: ".",
          describe: "Path to the git repository",
        })
        .option("open", {
          type: "boolean",
          default: true,
          describe: "Open the browser automatically",
        });
    },
    async (argv) => {
      const { port } = await startServer(argv.repo, argv.port);
      if (argv.open) {
        open(`http://localhost:${port}`);
      }
    }
  )
  .strict()
  .help()
  .parse();

async function stopInstance(registry, inst) {
  const url = `http://localhost:${inst.port}/api/agent/shutdown`;
  try {
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log(`Stopped ${inst.slug} (port ${inst.port})`);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    try {
      process.kill(inst.pid, "SIGTERM");
      console.log(`Stopped ${inst.slug} (port ${inst.port}) via SIGTERM`);
    } catch {
      console.log(`Cleaned up stale entry for ${inst.slug}`);
    }
  }
  await registry.unregister(inst.slug);
}

function formatUptime(startedAt) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  if (hours < 24) return `${hours}h ${remainMin}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
