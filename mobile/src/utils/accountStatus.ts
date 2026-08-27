export type AccountStatusKind =
  | "banned"
  | "deactivated"
  | "rejected"
  | "not_activated"
  | "pending"
  | "active";

export type AccountStatusTone = "ok" | "warn" | "danger" | "muted";

export type AccountStatusSource = {
  banned?: unknown;
  user_banned?: unknown;
  account_status?: unknown;
  user_approved?: unknown;
  user_activated?: unknown;
};

function flagText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = flagText(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function isFalseyFlag(value: unknown): boolean {
  if (value === false || value === 0) return true;
  const normalized = flagText(value);
  return normalized === "false" || normalized === "0" || normalized === "no";
}

function hasExplicitValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== "";
}

/**
 * Same rules as the website admin/user account_status badges, plus pending/rejected
 * so members see the real state instead of everything looking "active".
 */
export function accountStatusKind(source: AccountStatusSource | null | undefined): AccountStatusKind {
  if (!source) return "active";
  if (isTruthyFlag(source.banned) || isTruthyFlag(source.user_banned)) return "banned";

  const status = flagText(source.account_status);
  if (status === "banned") return "banned";
  if (status === "deactivated") return "deactivated";
  if (status === "rejected") return "rejected";
  if (status === "pending") return "pending";
  if (status === "not_activated") return "not_activated";

  if (hasExplicitValue(source.user_activated) && isFalseyFlag(source.user_activated)) {
    return "not_activated";
  }
  if (hasExplicitValue(source.user_approved) && isFalseyFlag(source.user_approved)) {
    return "pending";
  }
  if (status && status !== "approved" && status !== "active") {
    return "pending";
  }
  return "active";
}

export function accountStatusTone(kind: AccountStatusKind): AccountStatusTone {
  if (kind === "active") return "ok";
  if (kind === "banned" || kind === "rejected") return "danger";
  if (kind === "pending" || kind === "not_activated") return "warn";
  return "muted";
}

export function accountStatusLabel(
  kind: AccountStatusKind,
  t: (key: string) => string
): string {
  if (kind === "banned") return t("account.statusBanned");
  if (kind === "deactivated") return t("account.statusDeactivated");
  if (kind === "rejected") return t("account.statusRejected");
  if (kind === "not_activated") return t("account.statusNotActivated");
  if (kind === "pending") return t("account.statusPending");
  return t("account.active");
}

export function accountStatusCopy(
  kind: AccountStatusKind,
  t: (key: string) => string
): string {
  if (kind === "banned") return t("profile.statusBannedSub");
  if (kind === "deactivated") return t("profile.statusDeactivatedSub");
  if (kind === "rejected") return t("profile.statusRejectedSub");
  if (kind === "not_activated") return t("profile.statusNotActivatedSub");
  if (kind === "pending") return t("profile.statusPendingSub");
  return t("profile.statusActiveSub");
}
