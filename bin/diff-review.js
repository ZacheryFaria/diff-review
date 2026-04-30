#!/usr/bin/env node

import { startServer } from "../dist/server/index.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import open from "open";

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    default: 3142,
    describe: "Port to run the server on",
  })
  .option("repo", {
    alias: "r",
    type: "string",
    default: ".",
    describe: "Path to the git repository",
  })
  .option("no-open", {
    type: "boolean",
    default: false,
    describe: "Don't open the browser automatically",
  })
  .parseSync();

const port = argv.port;
const repo = argv.repo;

startServer(repo, port).then(() => {
  if (!argv["no-open"]) {
    open(`http://localhost:${port}`);
  }
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
