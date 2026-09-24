import { readFile as readFileCb } from "node:fs";
import { readFile } from "node:fs/promises";

type Done = (err: Error | null, result?: string) => void;

function loadWithCallbacks(done: Done): void {
  readFileCb("package.json", "utf8", (err, pkgText) => {
    if (err) {
      done(err);
      return;
    }
    readFileCb(".nvmrc", "utf8", (err2, nvmText) => {
      if (err2) {
        done(err2);
        return;
      }
      const pkg = JSON.parse(pkgText) as { name: string };
      done(null, `${pkg.name} on node ${nvmText.trim()}`);
    });
  });
}

function loadWithPromises(): Promise<string> {
  return readFile("package.json", "utf8").then((pkgText) =>
    readFile(".nvmrc", "utf8").then((nvmText) => {
      const pkg = JSON.parse(pkgText) as { name: string };
      return `${pkg.name} on node ${nvmText.trim()}`;
    }),
  );
}

async function loadWithAwait(): Promise<string> {
  const pkgText = await readFile("package.json", "utf8");
  const nvmText = await readFile(".nvmrc", "utf8");
  const pkg = JSON.parse(pkgText) as { name: string };
  return `${pkg.name} on node ${nvmText.trim()}`;
}

loadWithCallbacks(async (err, result) => {
  if (err) throw err;
  console.log("1. callbacks:", result);
  console.log("2. promises: ", await loadWithPromises());
  console.log("3. await:    ", await loadWithAwait());
});
