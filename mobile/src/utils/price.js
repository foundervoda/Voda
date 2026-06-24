// DB stores prices in a base unit (e.g. 89.99).
// All UI must convert via toRupees() before display.
// Cart items already store the converted rupee price.

export function toRupees(dbPrice) {
  const p = Number(dbPrice) || 0;
  if (p === 0) return 0;
  if (p > 1000) return Math.round(p); // already in rupees
  return Math.round(p * 80);
}

export function formatRupees(amount) {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
