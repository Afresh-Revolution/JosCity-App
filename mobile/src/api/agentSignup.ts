export type PendingAgentApplication = {
  bio: string;
  category: string;
  services: string[];
  nin: string;
};

export const HELP_ME_BUY = "Help me buy";
export const HELP_ME_DELIVER = "Help me deliver";
export const DEFAULT_AGENT_SERVICES = [HELP_ME_BUY, HELP_ME_DELIVER];

export function toggleAgentServices(current: string[], service: string): string[] {
  const hasBuy = current.includes(HELP_ME_BUY);
  const hasDeliver = current.includes(HELP_ME_DELIVER);
  if (service === HELP_ME_BUY) {
    return hasBuy ? (hasDeliver ? [HELP_ME_DELIVER] : []) : [HELP_ME_BUY, HELP_ME_DELIVER];
  }
  if (hasBuy) return [HELP_ME_BUY, HELP_ME_DELIVER];
  return hasDeliver ? [] : [HELP_ME_DELIVER];
}

export function agentTypeFromServices(services: string[]): "buy" | "deliver" | "both" {
  const buy = services.some((item) => item.toLowerCase().includes("buy"));
  const deliver = services.some((item) => item.toLowerCase().includes("deliver"));
  if (buy) return "both";
  if (deliver) return "deliver";
  return "buy";
}

export function categoriesFromText(value: string): string[] {
  return String(value || "")
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function becomePayloadFromSignup(pending: PendingAgentApplication) {
  return {
    agentType: agentTypeFromServices(pending.services),
    bio: pending.bio.trim(),
    categories: categoriesFromText(pending.category),
    ninNumber: pending.nin.replace(/\D/g, "") || undefined,
  };
}
