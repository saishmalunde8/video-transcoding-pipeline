import { readFile } from "node:fs/promises";

async function readMissing(): Promise<string> {
  return readFile("does-not-exist.txt", "utf8");
}

const cases: Record<string, () => void | Promise<void>> = {
  sync() {
    try {
      JSON.parse("{oops");
    } catch (e) {
      if (e instanceof Error) console.log(`caught ${e.name}: ${e.message}`);
    }
  },

  async awaited() {
    try {
      await readMissing();
    } catch (e) {
      if (e instanceof Error && "code" in e) {
        console.log(`caught: ${e.message} (code ${e.code})`);
      }
    }
  },

  forgotAwait() {
    try {
      readMissing();
    } catch {
      console.log("this line never prints");
    }
  },

  callbackTrap() {
    try {
      setTimeout(() => {
        throw new Error("boom");
      }, 10);
    } catch {
      console.log("this line never prints");
    }
  },

  lastResort() {
    process.on("unhandledRejection", (reason) => {
      const text = reason instanceof Error ? reason.message : String(reason);
      console.error(`last resort: ${text} -- exiting`);
      process.exit(1);
    });
    readMissing();
  },
};

const name = process.argv[2] ?? "";
const run = cases[name];
if (run === undefined) {
  console.error(`usage: node dist/lab/errors.js <${Object.keys(cases).join("|")}>`);
  process.exit(2);
}
await run();
console.log("reached the end normally");
