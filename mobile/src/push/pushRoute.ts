export type PushPayload = {
  type?: string;
  entityId?: string | number;
  screen?: string;
  app?: string;
  eventId?: string;
  version?: number;
  url?: string;
  postId?: string | number;
  rateOrderId?: string | number;
  kind?: string;
};

export type PushHref =
  | { pathname: string; params?: Record<string, string> }
  | string
  | null;

const ALLOWED_SCREENS = new Set([
  "messages",
  "notifications",
  "post",
  "wallet",
  "membership",
  "orders",
  "reviews",
  "people",
  "forums",
  "home",
  "business",
]);

function asId(value: unknown): string {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) && Number(id) > 0 ? id : "";
}

function safePath(url: string): string | null {
  if (!url.startsWith("/")) return null;
  if (url.startsWith("//")) return null;
  if (url.includes("://")) return null;
  return url;
}

export function resolvePushRoute(data?: PushPayload | null): PushHref {
  if (!data || typeof data !== "object") return "/notifications";
  if (data.app && data.app !== "joscity") return null;

  const rateOrderId = asId(data.rateOrderId);
  const postId = asId(data.postId) || (data.screen === "post" ? asId(data.entityId) : "");
  const entityId = asId(data.entityId);
  const screen = String(data.screen || "").trim().toLowerCase();

  if (data.url) {
    const url = safePath(String(data.url));
    if (url) return url;
  }

  if (ALLOWED_SCREENS.has(screen)) {
    switch (screen) {
      case "messages":
        return entityId
          ? { pathname: "/messages/[id]", params: { id: entityId } }
          : "/messages";
      case "post":
        return postId || entityId
          ? { pathname: "/post/[id]", params: { id: postId || entityId } }
          : "/notifications";
      case "wallet":
        return "/profile/wallet";
      case "membership":
        return "/profile/membership";
      case "orders":
        return "/business/orders";
      case "reviews":
        return "/business/reviews";
      case "people":
        return entityId
          ? { pathname: "/people/[id]", params: { id: entityId } }
          : "/people";
      case "forums":
        return entityId
          ? { pathname: "/forums/thread/[id]", params: { id: entityId } }
          : "/forums";
      case "home":
        return "/home";
      case "business":
        return "/business";
      default:
        return "/notifications";
    }
  }

  if (postId) {
    return { pathname: "/post/[id]", params: { id: postId } };
  }
  return "/notifications";
}

export function pushRateOrderId(data?: PushPayload | null): number {
  const id = asId(data?.rateOrderId);
  return id ? Number(id) : 0;
}

export { ALLOWED_SCREENS };
