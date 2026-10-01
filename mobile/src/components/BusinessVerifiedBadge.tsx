import Ionicons from "@expo/vector-icons/Ionicons";
import { resolveAccountBadgeColor, resolveSearchBadgeColor } from "../utils/badgeColor";

export function cacBadgeColor(hasCac: boolean | undefined, success: string, warning: string) {
  return hasCac ? success : warning;
}

export default function BusinessVerifiedBadge({
  color,
  hasCac,
  verified,
  accountType,
  signupIntent,
  agentType,
  ninVerified,
  ninNumber,
  roleBadge = false,
  size = 16,
}: {
  color?: string | null;
  hasCac?: boolean | null;
  verified?: boolean | null;
  accountType?: string | null;
  signupIntent?: string | null;
  agentType?: string | null;
  ninVerified?: boolean | null;
  ninNumber?: string | null;
  roleBadge?: boolean;
  size?: number;
}) {
  const account = {
    badge_color: color,
    has_cac: hasCac,
    cac_verified: hasCac,
    verified,
    account_type: accountType,
    signup_intent: signupIntent,
    agent_type: agentType,
    nin_verified: ninVerified,
    nin_number: ninNumber,
  };
  const resolved = roleBadge ? resolveSearchBadgeColor(account) : resolveAccountBadgeColor(account);
  if (!resolved) return null;
  return <Ionicons name="checkmark-circle" size={size} color={resolved} />;
}
