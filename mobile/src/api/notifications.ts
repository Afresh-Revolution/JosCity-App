import { apiFetch, readJson } from "./client";

export type ApiNotification = {
  id: number;
  from_user_id?: number | null;
  action?: string | null;
  title?: string | null;
  message?: string | null;
  notification_type?: string | null;
  node_type?: string | null;
  node_id?: number | null;
  time?: string | null;
  is_read?: boolean;
  is_global?: boolean;
  created_by_admin?: boolean;
  expires_at?: string | null;
  from_user?: {
    display_name?: string | null;
    profile_image_url?: string | null;
  } | null;
};

async function asOk(
  path: string,
  init: RequestInit & { skipUnauthorized?: boolean } = {}
): Promise<boolean> {
  try {
    const response = await apiFetch(path, { ...init, auth: true });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getNotifications(): Promise<ApiNotification[]> {
  const response = await apiFetch("/notifications", {
    method: "GET",
    auth: true,
    timeoutMs: 20000,
  });
  const data = await readJson<{ success?: boolean; data?: ApiNotification[] }>(response);
  if (!response.ok || !Array.isArray(data.data)) {
    throw new Error("Could not load notifications");
  }
  return data.data
    .map((row) => ({
      ...row,
      id: Number(row.id || 0),
      is_read: Boolean(row.is_read),
    }))
    .filter((row) => row.id > 0);
}

export async function markNotificationRead(id: number): Promise<boolean> {
  return asOk(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<boolean> {
  return asOk("/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: number): Promise<boolean> {
  return asOk(`/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllNotifications(): Promise<boolean> {
  return asOk("/notifications/all", { method: "DELETE" });
}

export async function deleteNotifications(ids: number[]): Promise<boolean> {
  if (!ids.length) return true;
  return asOk("/notifications/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export type NotificationPreferenceKey =
  | "payments"
  | "membership"
  | "system"
  | "orders"
  | "listings"
  | "rewards"
  | "referrals"
  | "business";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

const DEFAULT_PREFERENCES: NotificationPreferences = {
  payments: true,
  membership: true,
  system: true,
  orders: true,
  listings: true,
  rewards: true,
  referrals: true,
  business: true,
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const response = await apiFetch("/notifications/preferences", {
      method: "GET",
      auth: true,
    });
    const data = await readJson<{ data?: Partial<NotificationPreferences> }>(response);
    if (!response.ok) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(data.data || {}) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  value: boolean
): Promise<NotificationPreferences | null> {
  try {
    const response = await apiFetch("/notifications/preferences", {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ [key]: value }),
    });
    const data = await readJson<{ data?: NotificationPreferences }>(response);
    if (!response.ok) return null;
    return { ...DEFAULT_PREFERENCES, ...(data.data || { [key]: value }) };
  } catch {
    return null;
  }
}

export async function registerPushToken(
  token: string,
  platform: "ios" | "android" | "unknown"
): Promise<boolean> {
  return asOk("/notifications/push-token", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(token?: string | null): Promise<boolean> {
  return asOk("/notifications/push-token", {
    method: "DELETE",
    body: JSON.stringify(token ? { token } : {}),
    skipUnauthorized: true,
  });
}
