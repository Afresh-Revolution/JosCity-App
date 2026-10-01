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
  // Explicit session mode wins over eligibility and historical signup metadata.
  const selected = String(accountType || user?.account_type || "").trim().toLowerCase();
  if (["personal", "business", "agent"].includes(selected)) return selected === "agent";
  if (isBusinessAccountType(String(accountType || user?.account_type || ""))) return false;
  const intent = String(user?.signup_intent || "").trim().toLowerCase();
  const agentType = String(user?.agent_type || "").trim().toLowerCase();
  return (
    isAgentAccountType(String(accountType || user?.account_type || "")) ||
    intent === "agent" ||
    intent === "agents" ||
    agentType === "buy" ||
    agentType === "deliver" ||
    agentType === "both"
  );
}

export function loginKindForUser(user?: AccountUser | null, accountType?: string | null): AccountType {
  if (isBusinessAccountType(String(accountType || user?.account_type || ""))) return "business";
  if (isDedicatedAgentAccount(user, accountType)) return "agent";
  return "personal";
}

export function loginMatchesAccount(
  intended: AccountType,
  user?: AccountUser | null,
  accountType?: string | null
): boolean {
  const business = isBusinessAccountType(String(accountType || user?.account_type || ""));
  return intended === "business" ? business : !business;
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
