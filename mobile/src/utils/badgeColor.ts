/** Matches New_Joscity/utils/badgeColor.js display fallbacks. */
export const BADGE_AGENT = "#6B7280";
export const BADGE_AGENT_VERIFIED = "#800000";
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
  signup_intent?: string | null;
  agent_type?: string | null;
  has_cac?: boolean | null;
  cac_verified?: boolean | null;
  cac_number?: string | null;
  nin_number?: string | null;
  nin_verified?: boolean | null;
  verified?: boolean | null;
  user_verified?: boolean | null;
};

function isAgentBadgeAccount(account: BadgeAccount) {
  const type = String(account.account_type || "").toLowerCase();
  if (type === "business") return false;
  if (type === "agent") return true;
  const intent = String(account.signup_intent || "").toLowerCase();
  const agentType = String(account.agent_type || "").toLowerCase();
  return intent === "agent" || intent === "agents" || ["buy", "deliver", "both"].includes(agentType);
}

function hasVerifiedNin(account: BadgeAccount) {
  const digits = String(account.nin_number || "").replace(/\D/g, "");
  return Boolean(digits) && Boolean(account.nin_verified);
}

/**
 * Prefer the color assigned to the account (API `badge_color`).
 * Only fall back to CAC / verified defaults when the API omitted it.
 */
export function resolveAccountBadgeColor(account?: BadgeAccount | null): string | null {
  if (!account) return null;
  const assigned = normalizeBadgeColor(account.badge_color);
  if (isAgentBadgeAccount(account) || assigned === BADGE_AGENT || assigned === BADGE_AGENT_VERIFIED) {
    return hasVerifiedNin(account) || assigned === BADGE_AGENT_VERIFIED
      ? BADGE_AGENT_VERIFIED
      : BADGE_AGENT;
  }
  if (assigned) return assigned;

  const isBusiness = String(account.account_type || "").toLowerCase() === "business";
  if (isBusiness) return account.cac_verified || account.has_cac ? BADGE_CAC : BADGE_NO_CAC;
  if (hasVerifiedNin(account)) return BADGE_VERIFIED;
  return null;
}

/** Search rows use the role badge so an agent or business is distinct from a personal account with the same name. */
export function resolveSearchBadgeColor(account?: BadgeAccount | null): string | null {
  if (!account) return null;
  if (isAgentBadgeAccount(account)) {
    return hasVerifiedNin(account) ? BADGE_AGENT_VERIFIED : BADGE_AGENT;
  }
  if (String(account.account_type || "").toLowerCase() === "business") {
    return account.cac_verified || account.has_cac ? BADGE_CAC : BADGE_NO_CAC;
  }
  return resolveAccountBadgeColor(account);
}
