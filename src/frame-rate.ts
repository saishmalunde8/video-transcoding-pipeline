export function parseFrameRate(rate: string): number {
  const parts = rate.split("/");
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  return numerator / denominator;
}
