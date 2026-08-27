/** Matches New_Joscity/utils/badgeColor.js display fallbacks. */
export const BADGE_CAC = "#16A34A";
export const BADGE_NO_CAC = "#F97316";
export const BADGE_VERIFIED = "#1D9BF0";

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeBadgeColor(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX.test(hex)) return null;
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return hex.toUpperCase();
}

export type BadgeAccount = {
  badge_color?: string | null;
  account_type?: string | null;
  has_cac?: boolean | null;
  cac_verified?: boolean | null;
  cac_number?: string | null;
  verified?: boolean | null;
  user_verified?: boolean | null;
};

/**
 * Prefer the color assigned to the account (API `badge_color`).
 * Only fall back to CAC / verified defaults when the API omitted it.
 */
export function resolveAccountBadgeColor(account?: BadgeAccount | null): string | null {
  if (!account) return null;
  const assigned = normalizeBadgeColor(account.badge_color);
  if (assigned) return assigned;

  const isBusiness = String(account.account_type || "").toLowerCase() === "business";
  if (isBusiness) return account.cac_verified ? BADGE_CAC : BADGE_NO_CAC;
  if (account.verified || account.user_verified) return BADGE_VERIFIED;
  return null;
}
