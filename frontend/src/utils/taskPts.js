/** Соответствует начислению на backend для solo/medium/hard. */
export function ptsForDifficulty(difficulty) {
  const d = Number(difficulty);
  if (d <= 2) return 10;
  if (d === 3) return 25;
  return 50;
}
