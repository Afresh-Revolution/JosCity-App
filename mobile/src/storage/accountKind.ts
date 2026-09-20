export type AccountType = "personal" | "business" | "agent";

export type AccountUser = {
  account_type?: AccountType | string;
  signup_intent?: unknown;
  agent_type?: unknown;
  [key: string]: unknown;
};

export function isPersonalAccountType(value?: string | null): boolean {
  return String(value || "").trim().toLowerCase() === "personal";
}

export function isBusinessAccountType(value?: string | null): boolean {
  return String(value || "").trim().toLowerCase() === "business";
}

export function isAgentAccountType(value?: string | null): boolean {
  return String(value || "").trim().toLowerCase() === "agent";
}

export function isDedicatedAgentAccount(user?: AccountUser | null, accountType?: string | null): boolean {
  if (isBusinessAccountType(String(user?.account_type || accountType || ""))) return false;
  const intent = String(user?.signup_intent || "").trim().toLowerCase();
  const agentType = String(user?.agent_type || "").trim().toLowerCase();
  return (
    isAgentAccountType(String(user?.account_type || accountType || "")) ||
    intent === "agent" ||
    intent === "agents" ||
    agentType === "buy" ||
    agentType === "deliver" ||
    agentType === "both"
  );
}

export function loginKindForUser(user?: AccountUser | null, accountType?: string | null): AccountType {
  if (isBusinessAccountType(String(user?.account_type || accountType || ""))) return "business";
  if (isDedicatedAgentAccount(user, accountType)) return "agent";
  return "personal";
}

export function loginMatchesAccount(
  intended: AccountType,
  user?: AccountUser | null,
  accountType?: string | null
): boolean {
  return loginKindForUser(user, accountType) === intended;
}

export function friendshipAllowed(
  viewer?: AccountUser | null,
  viewerType?: string | null,
  target?: AccountUser | null,
  targetType?: string | null
): boolean {
  if (isDedicatedAgentAccount(viewer, viewerType)) return false;
  if (isDedicatedAgentAccount(target, targetType || String(target?.account_type || ""))) return false;
  return true;
}
