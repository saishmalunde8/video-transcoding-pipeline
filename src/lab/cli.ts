import { parseFrameRate } from "../frame-rate.js";

const input = process.argv[2];
if (input === undefined) {
  console.error("usage: npm start -- <numerator/denominator>   e.g. 30000/1001");
  process.exit(2);
}

try {
  const fps = parseFrameRate(input);
  console.log(`${input} = ${fps.toFixed(3)} fps`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
