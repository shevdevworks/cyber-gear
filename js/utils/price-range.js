export const PRICE_LIMIT = 500;

// Preserve the handle being moved until it reaches the other one. A $5 gap
// keeps overlapping range handles usable, including at the ends of the track.
export function normalizePriceRange(min, max, changed = 'max') {
  const finite = (value, fallback) => Number.isFinite(Number(value)) && value !== '' ? Math.round(Number(value)) : fallback;
  let low = Math.max(0, Math.min(PRICE_LIMIT - 5, finite(min, 0)));
  let high = Math.max(5, Math.min(PRICE_LIMIT, finite(max, PRICE_LIMIT)));
  if (high - low < 5) {
    if (changed === 'min') low = high - 5;
    else high = low + 5;
  }
  return { min: low, max: high };
}
