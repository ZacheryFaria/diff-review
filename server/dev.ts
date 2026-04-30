import { createApp } from "./index.js";
import { getRepoRoot } from "./git.js";

async function main() {
  const repoDir = await getRepoRoot(".");
  const app = await createApp(repoDir);
  app.listen(3142, () => {
    console.log(`diff-review API running at http://localhost:3142`);
    console.log(`Open http://localhost:5173 in your browser`);
    console.log(`Reviewing repo: ${repoDir}`);
  });
}

main();
