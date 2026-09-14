export const CREDIT_MIN = 40;
export const CREDIT_MAX = 1000;
export const CREDIT_STEP = 5;

export const CREDIT_PRICE_TIERS = [
  { min: 40, max: 49, unitPrice: 0.45 },
  { min: 50, max: 74, unitPrice: 0.44 },
  { min: 75, max: 99, unitPrice: 0.42 },
  { min: 100, max: 149, unitPrice: 0.4 },
  { min: 150, max: 199, unitPrice: 0.38 },
  { min: 200, max: 299, unitPrice: 0.36 },
  { min: 300, max: 399, unitPrice: 0.34 },
  { min: 400, max: 499, unitPrice: 0.33 },
  { min: 500, max: 599, unitPrice: 0.32 },
  { min: 600, max: 699, unitPrice: 0.31 },
  { min: 700, max: 799, unitPrice: 0.3 },
  { min: 800, max: 899, unitPrice: 0.29 },
  { min: 900, max: 999, unitPrice: 0.285 },
  { min: 1000, max: 1000, unitPrice: 0.28 },
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