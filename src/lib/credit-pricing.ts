export const CREDIT_MIN = 10;
export const CREDIT_MAX = 1000;
export const CREDIT_STEP = 5;

export const CREDIT_PRICE_TIERS = [
  { min: 10, max: 49, unitPrice: 0.45 },
  { min: 50, max: 99, unitPrice: 0.4 },
  { min: 100, max: 199, unitPrice: 0.35 },
  { min: 200, max: 299, unitPrice: 0.3 },
  { min: 300, max: 499, unitPrice: 0.25 },
  { min: 500, max: 749, unitPrice: 0.22 },
  { min: 750, max: 1000, unitPrice: 0.2 },
] as const;

export function normalizeCreditQuantity(value: number) {
  const bounded = Math.max(CREDIT_MIN, Math.min(CREDIT_MAX, Math.round(value || CREDIT_MIN)));
  return Math.round(bounded / CREDIT_STEP) * CREDIT_STEP;
}

export function calculateCreditPrice(value: number) {
  const quantity = normalizeCreditQuantity(value);
  const tier = CREDIT_PRICE_TIERS.find((item) => quantity >= item.min && quantity <= item.max);
  if (!tier) throw new Error("Quantidade de créditos inválida.");
  return {
    quantity,
    unitPrice: tier.unitPrice,
    total: Math.round(quantity * tier.unitPrice * 100) / 100,
  };
}