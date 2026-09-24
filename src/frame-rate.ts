export function parseFrameRate(rate: string): number {
  const parts = rate.split("/");
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  const valid =
    parts.length === 2 &&
    Number.isFinite(numerator) &&
    Number.isFinite(denominator) &&
    numerator > 0 &&
    denominator > 0;
  if (!valid) {
    throw new Error(`invalid frame rate "${rate}", expected "numerator/denominator"`);
  }
  return numerator / denominator;
}
