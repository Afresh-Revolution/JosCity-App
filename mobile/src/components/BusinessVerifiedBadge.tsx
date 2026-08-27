import Ionicons from "@expo/vector-icons/Ionicons";
import { resolveAccountBadgeColor } from "../utils/badgeColor";

export function cacBadgeColor(hasCac: boolean | undefined, success: string, warning: string) {
  return hasCac ? success : warning;
}

export default function BusinessVerifiedBadge({
  color,
  hasCac,
  verified,
  accountType,
  size = 16,
}: {
  color?: string | null;
  hasCac?: boolean | null;
  verified?: boolean | null;
  accountType?: string | null;
  size?: number;
}) {
  const resolved = resolveAccountBadgeColor({
    badge_color: color,
    has_cac: hasCac,
    cac_verified: hasCac,
    verified,
    account_type: accountType,
  });
  if (!resolved) return null;
  return <Ionicons name="checkmark-circle" size={size} color={resolved} />;
}
