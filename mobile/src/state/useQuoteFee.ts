import { useEffect, useState } from "react";
import { agentApi, type QuoteFee } from "../api/agent";
import { normalizeQuoteFee, quoteFeeForAmount } from "../utils/agentFee";
import { parseMoneyInput } from "../utils/format";

export function useQuoteFee(priceInput: string) {
  const amount = parseMoneyInput(priceInput);
  const fallback = amount != null && !Number.isNaN(amount) && amount > 0 ? quoteFeeForAmount(amount) : null;
  const [fee, setFee] = useState<QuoteFee | null>(fallback);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      setFee(null);
      setLoading(false);
      return;
    }
    const local = quoteFeeForAmount(amount);
    setFee(local);
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      agentApi
        .feeQuote(amount)
        .then((row) => {
          const next = normalizeQuoteFee(row);
          if (!cancelled) setFee(next || local);
        })
        .catch(() => {
          if (!cancelled) setFee(local);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount]);

  return { fee, loading };
}
