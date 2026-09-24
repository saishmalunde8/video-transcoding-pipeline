const INTERVAL_MS = 50;
const start = Date.now();
let expected = start + INTERVAL_MS;

const probe = setInterval(() => {
  const now = Date.now();
  const lag = now - expected;
  console.log(`[+${now - start}ms] probe fired, lag = ${lag}ms`);
  expected = now + INTERVAL_MS;
}, INTERVAL_MS);

function busyWait(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // spin: the thread is working, not waiting
  }
}

setTimeout(() => {
  console.log(`[+${Date.now() - start}ms] blocking for 500ms...`);
  busyWait(500);
  console.log(`[+${Date.now() - start}ms] done blocking`);
}, 300);

setTimeout(() => clearInterval(probe), 1200);
