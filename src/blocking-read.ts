import { readFileSync, readFile } from "node:fs";

const BIG_FILE = "media/big-test-file.bin";
const start = Date.now();

function log(label: string): void {
  console.log(`[+${Date.now() - start}ms] ${label}`);
}

let ticks = 0;
const heartbeat = setInterval(() => {
  ticks++;
  log(`heartbeat tick #${ticks}`);
}, 20);

log("starting SYNCHRONOUS read...");
const data = readFileSync(BIG_FILE);
log(`synchronous read finished, got ${data.length} bytes`);

setTimeout(() => {
  clearInterval(heartbeat);
  log("--- switching to the non-blocking version ---");
  ticks = 0;

  const heartbeat2 = setInterval(() => {
    ticks++;
    log(`heartbeat tick #${ticks}`);
  }, 20);

  log("starting ASYNCHRONOUS read...");
  readFile(BIG_FILE, (err, data2) => {
    if (err) throw err;
    log(`asynchronous read finished, got ${data2.length} bytes`);
    clearInterval(heartbeat2);
  });
}, 100);
