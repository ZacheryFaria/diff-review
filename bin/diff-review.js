#!/usr/bin/env node

import { startServer } from "../dist/server/index.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import open from "open";

const argv = yargs(hideBin(process.argv))
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
  .option("no-open", {
    type: "boolean",
    default: false,
    describe: "Don't open the browser automatically",
  })
  .parseSync();

startServer(argv.repo, argv.port).then(({ port }) => {
  if (!argv["no-open"]) {
    open(`http://localhost:${port}`);
  }
});
