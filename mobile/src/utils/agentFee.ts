import type { QuoteFee } from "../api/agent";

/** Seed / fallback bands from agent_fee_tiers. Server values win when /fee-quote responds. */
const FEE_TIERS = [
  { minAmount: 0, maxAmount: 10000, maxPercent: 20 },
  { minAmount: 10000, maxAmount: 50000, maxPercent: 10 },
  { minAmount: 50000, maxAmount: 200000, maxPercent: 5 },
  { minAmount: 200000, maxAmount: null as number | null, maxPercent: 2 },
];

export function quoteFeeForAmount(amount: number): QuoteFee {
  const productPrice = Number(amount) || 0;
  const match = [...FEE_TIERS]
    .filter((tier) => tier.minAmount <= productPrice && (tier.maxAmount == null || productPrice < tier.maxAmount))
    .sort((a, b) => b.minAmount - a.minAmount)[0];
  const feePercent = match ? match.maxPercent : 20;
  const feeAmount = Math.round(((productPrice * feePercent) / 100) * 100) / 100;
  const totalPrice = Math.round((productPrice + feeAmount) * 100) / 100;
  return { productPrice, feePercent, feeAmount, totalPrice };
}

export function normalizeQuoteFee(row: unknown): QuoteFee | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const productPrice = Number(data.productPrice ?? data.product_price);
  const feePercent = Number(data.feePercent ?? data.fee_percent);
  const feeAmount = Number(data.feeAmount ?? data.fee_amount);
  const totalPrice = Number(data.totalPrice ?? data.total_price);
  if (![productPrice, feePercent, feeAmount, totalPrice].every(Number.isFinite)) return null;
  return { productPrice, feePercent, feeAmount, totalPrice };
}

export function formatFeePercent(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
