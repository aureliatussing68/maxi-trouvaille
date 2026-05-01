export function formatPrice(amountInCents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100);
}

export function clampQuantity(quantity: number, max = 99) {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(quantity), 1), max);
}
