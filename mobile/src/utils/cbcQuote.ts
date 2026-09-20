export type CbcQuote = {
  symbol?: string;
  name?: string;
  cbc_usd?: number | null;
  cbc_ngn?: number | null;
};

export function nairaToCbc(naira: number, quote: CbcQuote | null | undefined): number {
  const perCbc = Number(quote?.cbc_ngn || 0);
  const amount = Number(naira);
  if (!(perCbc > 0) || !Number.isFinite(amount)) return 0;
  return amount / perCbc;
}

export function formatCbcAmount(naira: number, quote: CbcQuote | null | undefined): string {
  const cbc = nairaToCbc(naira, quote);
  if (!(cbc > 0)) return "";
  return `${cbc.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} CBC`;
}

export function isCbcCardEnabled(funding?: { cbc_card?: { enabled?: boolean } } | null) {
  return funding?.cbc_card?.enabled !== false;
}
