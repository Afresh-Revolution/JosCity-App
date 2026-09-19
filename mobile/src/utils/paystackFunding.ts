import type { WalletFundingOptions } from "../api/account";

export function clientPaystackKey() {
  return String(process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "").trim();
}

export function isPaystackFundingEnabled(funding?: WalletFundingOptions | null) {
  if (funding?.paystack?.enabled) return true;
  if (String(funding?.paystack?.public_key || "").trim()) return true;
  if (clientPaystackKey()) return true;
  return funding == null;
}

export function isWithdrawMethodEnabled(
  funding: WalletFundingOptions | null | undefined,
  method: "paystack" | "manual"
) {
  const withdraw = funding?.withdraw;
  if (withdraw?.[method]?.enabled === false) return false;
  if (method === "paystack") return isPaystackFundingEnabled(funding);
  if (withdraw?.manual?.enabled) return true;
  return withdraw == null || withdraw.manual?.enabled !== false;
}
