import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ApiNotification } from "../api/notifications";
import type { Palette } from "../theme/colors";

export type NotificationFilter =
  | "all"
  | "unread"
  | "payments"
  | "orders"
  | "membership"
  | "rewards"
  | "referrals"
  | "system";

export type NotificationKind =
  | "payments"
  | "orders"
  | "membership"
  | "rewards"
  | "referrals"
  | "system"
  | "like"
  | "comment"
  | "share"
  | "friend"
  | "message";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const NOTIFICATION_FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "payments", label: "Payments" },
  { key: "orders", label: "Orders" },
  { key: "membership", label: "Membership" },
  { key: "rewards", label: "Rewards" },
  { key: "referrals", label: "Referrals" },
  { key: "system", label: "System" },
];

function haystack(row: ApiNotification): string {
  return [
    row.title,
    row.message,
    row.action,
    row.node_type,
    row.notification_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function notificationKind(row: ApiNotification): NotificationKind {
  const text = haystack(row);
  const node = String(row.node_type || "").toLowerCase();
  const action = String(row.action || "").toLowerCase();

  if (
    text.includes("wallet") ||
    text.includes("funding") ||
    text.includes("payment") ||
    text.includes("transfer") ||
    text.includes("₦")
  ) {
    return "payments";
  }
  if (
    node === "order_review" ||
    action === "rate_order" ||
    text.includes("rate your") ||
    text.includes("tap to rate") ||
    text.includes("left a") ||
    node === "agent_job" ||
    action === "agent_request_accepted" ||
    action === "agent_job_stage"
  ) {
    return "orders";
  }
  if (text.includes("order") || text.includes("marketplace") || node === "order" || text.includes("review on")) {
    return "orders";
  }
  if (text.includes("membership") || text.includes("member package") || text.includes("renews")) {
    return "membership";
  }
  if (text.includes("point") || text.includes("cbc") || text.includes("reward")) {
    return "rewards";
  }
  if (text.includes("referral") || text.includes("referred")) {
    return "referrals";
  }
  if (action.includes("like") || action.includes("react")) return "like";
  if (action.includes("comment") || action.includes("replied")) return "comment";
  if (action.includes("share")) return "share";
  if (node === "friend_request" || action.includes("friend")) return "friend";
  if (node === "message" || action.includes("message")) return "message";
  return "system";
}

export function matchesNotificationFilter(
  row: ApiNotification,
  filter: NotificationFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !row.is_read;
  const kind = notificationKind(row);
  if (filter === "membership") return kind === "membership";
  return kind === filter;
}

export function isIncomingFriendRequest(row: ApiNotification): boolean {
  const node = String(row.node_type || "").toLowerCase();
  const action = String(row.action || "").toLowerCase();
  if (action.includes("accepted") || action === "friend_request_accepted") return false;
  return node === "friend_request" || action === "friend_request";
}

export function notificationPostId(row: ApiNotification): number {
  const node = String(row.node_type || "").toLowerCase();
  const action = String(row.action || row.message || row.title || "").toLowerCase();
  const id = Number(row.node_id || 0);
  if (id <= 0) return 0;
  if (node === "forum_thread") return 0;
  if (
    node === "friend_request" ||
    node === "message" ||
    node === "admin_notification" ||
    node === "order_review" ||
    node === "business_review" ||
    node === "marketplace_order" ||
    node === "agent_job"
  ) {
    return 0;
  }
  if (node === "post" || node === "share" || node === "comment") return id;
  if (
    action.includes("post") ||
    action.includes("comment") ||
    action.includes("react") ||
    action.includes("like") ||
    action.includes("share")
  ) {
    return id;
  }
  return 0;
}

export function notificationActorName(row: ApiNotification): string {
  return String(row.from_user?.display_name || "").trim();
}

function socialTitle(action: string, name: string): string | null {
  const actor = name || "Someone";
  const raw = action.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === "friend_request") return `${actor} sent a friend request`;
  if (key === "friend_request_accepted") {
    return `${actor} accepted your friend request`;
  }
  if (key === "follow") return `${actor} followed your shop`;
  if (key === "message_request") return `${actor} wants to message you`;
  if (key === "message_request_accepted") {
    return `${actor} accepted your message request`;
  }
  if (key === "new_message") return `${actor} sent you a message`;
  if (raw.toLowerCase().startsWith(`${actor.toLowerCase()} `)) return raw;
  if (/^(commented|replied|mentioned|reacted|liked|shared|viewed)\b/i.test(raw)) {
    return `${actor} ${raw}`;
  }
  return null;
}

export function notificationTitle(row: ApiNotification): string {
  const title = String(row.title || "").trim();
  if (title) return title;
  const action = String(row.action || "").trim();
  const composed = socialTitle(action, notificationActorName(row));
  if (composed) return composed;
  if (action && action !== "friend_request") return action;
  return "JOSCITY update";
}

export function notificationBody(row: ApiNotification): string {
  const message = String(row.message || "").trim();
  const action = String(row.action || "").trim();
  const title = notificationTitle(row);
  if (!message) return "";
  if (message === action || message === title) return "";
  return message;
}

export function notificationWhen(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86400000);

  if (dayDiff <= 0) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `Today, ${hours}:${minutes}`;
  }
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  const weeks = Math.round(dayDiff / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function notificationSection(value?: string | null): "TODAY" | "EARLIER" | "OLDER" {
  if (!value) return "EARLIER";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "EARLIER";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86400000);
  if (dayDiff <= 0) return "TODAY";
  if (dayDiff < 7) return "EARLIER";
  return "OLDER";
}

export function notificationIcon(
  kind: NotificationKind,
  colors: Palette
): {
  name: IoniconName;
  color: string;
  background: string;
} {
  switch (kind) {
    case "payments":
      return { name: "wallet-outline", color: colors.success, background: colors.iconSoft };
    case "orders":
      return { name: "cube-outline", color: colors.primary, background: colors.cream };
    case "membership":
      return { name: "star-outline", color: colors.primary, background: colors.cream };
    case "rewards":
      return { name: "link-outline", color: colors.primary, background: colors.cream };
    case "referrals":
      return { name: "person-add-outline", color: colors.primary, background: colors.cream };
    case "like":
      return { name: "heart-outline", color: colors.badge, background: colors.iconSoft };
    case "comment":
      return { name: "chatbubble-outline", color: colors.verified, background: colors.iconSoft };
    case "share":
      return { name: "arrow-redo-outline", color: colors.verified, background: colors.iconSoft };
    case "friend":
      return { name: "person-outline", color: colors.success, background: colors.iconSoft };
    case "message":
      return { name: "chatbubble-ellipses-outline", color: colors.primary, background: colors.iconSoft };
    default:
      return { name: "shield-checkmark-outline", color: colors.primary, background: colors.cream };
  }
}

export function uniqueNotifications(rows: ApiNotification[]): ApiNotification[] {
  const byId = new Map<number, ApiNotification>();
  for (const row of rows) {
    if (row.id > 0 && !byId.has(row.id)) byId.set(row.id, row);
  }
  const seen = new Set<string>();
  const out: ApiNotification[] = [];
  for (const row of byId.values()) {
    const fingerprint = [
      row.from_user_id || 0,
      String(row.action || "").toLowerCase(),
      String(row.node_type || "").toLowerCase(),
      row.node_id || 0,
      String(row.title || "").trim().toLowerCase(),
      String(row.message || "").trim().toLowerCase(),
    ].join("|");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(row);
  }
  return out;
}
