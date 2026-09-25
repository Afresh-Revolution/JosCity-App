import { apiFetch, readJson } from "./client";
import { getFeed } from "./feed";
import { handleFromName } from "../utils/format";
import { publicUsername } from "../utils/accountNames";
import { isVideoUrl } from "../utils/media";
import { getUser } from "../storage/session";
import { markUserBlocked, markUserUnblocked } from "../storage/blockedUsers";

export type DirectoryUser = {
  user_id: number;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string | null;
  account_type?: string;
  user_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  business_location?: string | null;
  address?: string | null;
  cac_number?: string | null;
  has_cac?: boolean;
  cac_verified?: boolean;
  is_verified?: boolean;
  user_verified?: boolean;
  badge_color?: string | null;
  mutual_count?: number;
  agent_type?: string | null;
  signup_intent?: string | null;
};

function isMatchingAccount(
  user: DirectoryUser,
  accountType: "personal" | "business" | "all"
): boolean {
  if (accountType === "all") return true;
  const type = String(user.account_type || "personal").trim().toLowerCase();
  return type === accountType;
}

export async function getApprovedUsers(options?: {
  limit?: number;
  page?: number;
  accountType?: "personal" | "business" | "all";
  q?: string;
  allPages?: boolean;
}): Promise<DirectoryUser[]> {
  const accountType = options?.accountType ?? "personal";
  const pageSize = Math.min(Math.max(options?.limit ?? 12, 1), 100);
  const mapRows = (rows: DirectoryUser[]) =>
    rows
      .filter((row) => isMatchingAccount(row, accountType))
      .map((row) => ({
        ...row,
        address: row.address || row.business_location || null,
        has_cac: Boolean(row.has_cac),
        cac_verified: Boolean(row.cac_verified),
        mutual_count: Math.max(0, Number(row.mutual_count || 0)),
      }));

  const fetchPage = async (page: number, limit: number) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (accountType !== "all") query.set("account_type", accountType);
    if (options?.q?.trim()) query.set("q", options.q.trim());
    const response = await apiFetch(`/users/approved?${query.toString()}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    const data = await readJson<{
      success?: boolean;
      data?: DirectoryUser[];
      pagination?: { hasMore?: boolean };
    }>(response);
    const rows = Array.isArray(data.data) ? mapRows(data.data) : [];
    return { rows, hasMore: Boolean(data.pagination?.hasMore) };
  };

  try {
    if (options?.allPages) {
      const collected: DirectoryUser[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const { rows, hasMore } = await fetchPage(page, 100);
        collected.push(...rows);
        if (!hasMore || rows.length === 0) break;
      }
      return collected;
    }
    const { rows } = await fetchPage(options?.page ?? 1, pageSize);
    return rows.slice(0, pageSize);
  } catch {
    return [];
  }
}

export async function searchUsers(query: string): Promise<DirectoryUser[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const response = await apiFetch(
      `/users/search?q=${encodeURIComponent(q)}`,
      {
        method: "GET",
        auth: true,
        timeoutMs: 15000,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      }
    );
    const data = await readJson<{ data?: DirectoryUser[] }>(response);
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

export async function sendFriendRequest(userId: number): Promise<boolean> {
  const result = await createFriendRequest(userId);
  return result.success;
}

export async function createFriendRequest(
  userId: number
): Promise<{ success: boolean; requestId?: number; message?: string }> {
  try {
    const response = await apiFetch("/friends/request", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await readJson<{
      success?: boolean;
      message?: string;
      data?: { request_id?: number };
    }>(response);
    if (!response.ok) {
      return { success: false, message: data.message || "Could not send request" };
    }
    return {
      success: true,
      requestId: Number(data.data?.request_id || 0) || undefined,
      message: data.message,
    };
  } catch {
    return { success: false, message: "Could not send request" };
  }
}

export async function cancelFriendRequest(requestId: number): Promise<boolean> {
  if (!requestId) return false;
  try {
    const response = await apiFetch(`/friends/request/${requestId}`, {
      method: "DELETE",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function acceptFriendRequest(requestId: number): Promise<boolean> {
  if (!requestId) return false;
  try {
    const response = await apiFetch(`/friends/request/${requestId}/accept`, {
      method: "POST",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function rejectFriendRequest(requestId: number): Promise<boolean> {
  if (!requestId) return false;
  try {
    const response = await apiFetch(`/friends/request/${requestId}/reject`, {
      method: "POST",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function unfriendUser(userId: number): Promise<boolean> {
  try {
    const response = await apiFetch(`/friends/${userId}`, {
      method: "DELETE",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function blockUser(userId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiFetch("/friends/block", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await readJson<{ success?: boolean; error?: string; message?: string }>(response);
    if (!response.ok || data.success === false) {
      return {
        success: false,
        message: data.message || data.error || "Could not block this account.",
      };
    }
    await markUserBlocked(userId);
    return { success: true };
  } catch {
    return { success: false, message: "Could not block this account." };
  }
}

export async function unblockUser(userId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiFetch(`/friends/block/${userId}`, {
      method: "DELETE",
      auth: true,
    });
    const data = await readJson<{ success?: boolean; error?: string; message?: string }>(response);
    if (!response.ok || data.success === false) {
      return {
        success: false,
        message: data.message || data.error || "Could not unblock this account.",
      };
    }
    await markUserUnblocked(userId);
    return { success: true };
  } catch {
    return { success: false, message: "Could not unblock this account." };
  }
}

export async function checkFriendship(userId: number): Promise<{
  areFriends: boolean;
  requestStatus: string;
}> {
  try {
    const response = await apiFetch(`/friends/check/${userId}`, {
      method: "GET",
      auth: true,
    });
    const data = await readJson<{
      data?: { are_friends?: boolean; request_status?: string };
    }>(response);
    if (!response.ok) {
      return { areFriends: false, requestStatus: "none" };
    }
    return {
      areFriends: Boolean(data.data?.are_friends),
      requestStatus: String(data.data?.request_status || "none"),
    };
  } catch {
    return { areFriends: false, requestStatus: "none" };
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const response = await apiFetch("/notifications", {
      method: "GET",
      auth: true,
      timeoutMs: 15000,
    });
    const data = await readJson<{ data?: Array<{ is_read?: boolean }> }>(response);
    if (!Array.isArray(data.data)) return 0;
    return data.data.filter((item) => !item.is_read).length;
  } catch {
    return 0;
  }
}

export type FriendRow = {
  user_id: number;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string | null;
  profile_image_url?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  account_type?: string | null;
  user_name?: string | null;
  username?: string | null;
  address?: string | null;
  verified?: boolean;
};

export function friendDisplayName(row: FriendRow): string {
  const type = String(row.account_type || "").trim().toLowerCase();
  const business = row.business_name?.trim();
  if (type === "business" && business) return business;
  const combined = [row.user_firstname, row.user_lastname].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return (
    row.display_name?.trim() ||
    business ||
    row.user_name?.trim() ||
    row.username?.trim() ||
    `User ${row.user_id}`
  );
}

export async function getMyFriends(): Promise<FriendRow[]> {
  try {
    const response = await apiFetch("/friends/my", {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{
      success?: boolean;
      data?: FriendRow[];
      friends?: FriendRow[];
    }>(response);
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.friends)
        ? data.friends
        : [];
    if (!response.ok) return [];
    return rows
      .map((row) => ({ ...row, user_id: Number(row.user_id) }))
      .filter((row) => row.user_id > 0);
  } catch {
    return [];
  }
}

export type FriendRequest = {
  request_id: number;
  sender_id: number;
  receiver_id: number;
  status?: string;
  sender?: FriendRow;
  receiver?: FriendRow;
};

export async function getPendingRequests(): Promise<{
  sent: FriendRequest[];
  received: FriendRequest[];
}> {
  try {
    const response = await apiFetch("/friends/requests", {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{
      data?: { sent?: FriendRequest[]; received?: FriendRequest[] };
    }>(response);
    if (!response.ok) return { sent: [], received: [] };
    return {
      sent: Array.isArray(data.data?.sent) ? data.data.sent : [],
      received: Array.isArray(data.data?.received) ? data.data.received : [],
    };
  } catch {
    return { sent: [], received: [] };
  }
}

export async function getFriendsOfUser(userId: number): Promise<number[]> {
  const rows = await getFriendsForUser(userId);
  return [...new Set(rows.map((row) => Number(row.user_id || 0)).filter((id) => id > 0 && id !== userId))];
}

export async function getFriendsForUser(userId: number): Promise<DirectoryUser[]> {
  if (!userId) return [];
  try {
    const response = await apiFetch(`/friends/user/${userId}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{ success?: boolean; data?: FriendRow[] }>(response);
    if (!response.ok || !Array.isArray(data.data)) return [];
    const seen = new Set<number>();
    return data.data
      .map((row): DirectoryUser => ({
        user_id: Number(row.user_id || 0),
        user_firstname: row.user_firstname,
        user_lastname: row.user_lastname,
        user_picture: row.user_picture || row.profile_image_url || null,
        display_name: row.display_name || null,
        business_name: row.business_name || null,
        account_type: row.account_type || undefined,
        user_name: row.user_name || row.username || null,
        address: row.address || null,
        user_verified: Boolean(row.verified),
      }))
      .filter((row) => row.user_id > 0 && row.user_id !== userId && !seen.has(row.user_id) && Boolean(seen.add(row.user_id)));
  } catch {
    return [];
  }
}

export type FriendStatus = "none" | "sent" | "pending" | "friends";

export type FriendGraph = {
  statusByUser: Record<number, FriendStatus>;
  sentRequestIdByUser: Record<number, number>;
  receivedRequestIdByUser: Record<number, number>;
  myFriendIds: number[];
};

export async function getFriendGraph(): Promise<FriendGraph> {
  const [friends, requests] = await Promise.all([
    getMyFriends(),
    getPendingRequests(),
  ]);
  const statusByUser: Record<number, FriendStatus> = {};
  const sentRequestIdByUser: Record<number, number> = {};
  const receivedRequestIdByUser: Record<number, number> = {};
  const myFriendIds = friends.map((row) => row.user_id).filter((id) => id > 0);

  for (const friend of friends) {
    statusByUser[friend.user_id] = "friends";
  }
  for (const request of requests.sent) {
    if (request.status && request.status !== "pending") continue;
    const userId = Number(request.receiver_id || request.receiver?.user_id || 0);
    const requestId = Number(request.request_id || 0);
    if (!userId || statusByUser[userId] === "friends") continue;
    statusByUser[userId] = "sent";
    if (requestId) sentRequestIdByUser[userId] = requestId;
  }
  for (const request of requests.received) {
    if (request.status && request.status !== "pending") continue;
    const userId = Number(request.sender_id || request.sender?.user_id || 0);
    const requestId = Number(request.request_id || 0);
    if (!userId || statusByUser[userId] === "friends") continue;
    statusByUser[userId] = "pending";
    if (requestId) receivedRequestIdByUser[userId] = requestId;
  }

  return { statusByUser, sentRequestIdByUser, receivedRequestIdByUser, myFriendIds };
}

export type PersonalPageProfile = {
  user_id: number;
  name: string;
  handle: string;
  picture: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
  account_type: string;
  badge_color?: string | null;
  membership_label: string | null;
  friend_count: number;
  post_count: number;
  mutual_count: number;
  joined_at: string | null;
  are_friends: boolean;
  is_owner: boolean;
  account_status?: string;
  deactivated?: boolean;
};

export type PersonalPage = {
  profile: PersonalPageProfile;
  posts: Array<Record<string, unknown> & { post_id: number }>;
  reels: Array<Record<string, unknown> & { post_id: number }>;
  photos: Array<{ url: string; source: string; id: string }>;
};

export async function getPersonalPage(userId: number): Promise<PersonalPage | null> {
  if (!userId) return null;
  try {
    const response = await apiFetch(`/users/${userId}/page`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
      skipUnauthorized: true,
    });
    const data = await readJson<{ success?: boolean; data?: PersonalPage }>(response);
    if (response.ok && data.data?.profile?.user_id) {
      return {
        profile: data.data.profile,
        posts: Array.isArray(data.data.posts) ? data.data.posts : [],
        reels: Array.isArray(data.data.reels) ? data.data.reels : [],
        photos: Array.isArray(data.data.photos) ? data.data.photos : [],
      };
    }
  } catch {
    // Production may not have /users/:id/page yet.
  }
  try {
    return await getPersonalPageFallback(userId);
  } catch {
    return null;
  }
}

type LegacyProfile = {
  user_id?: number;
  user_firstname?: string;
  user_lastname?: string;
  display_name?: string;
  full_name?: string;
  business_name?: string;
  user_picture?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  business_email?: string | null;
  address?: string | null;
  user_bio?: string | null;
  account_type?: string;
  user_verified?: boolean;
  is_verified?: boolean;
  badge_color?: string | null;
  user_registered?: string | null;
};

async function fetchLegacyProfile(userId: number): Promise<LegacyProfile | null> {
  try {
    const response = await apiFetch(`/profile?userId=${userId}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
      skipUnauthorized: true,
    });
    const data = await readJson<{
      success?: boolean;
      data?: LegacyProfile;
      user?: LegacyProfile;
    }>(response);
    const row = data.data || data.user;
    if (!response.ok || !row) return null;
    return row;
  } catch {
    return null;
  }
}

function photosFromPosts(posts: PersonalPage["posts"]): PersonalPage["photos"] {
  const photos: PersonalPage["photos"] = [];
  for (const post of posts) {
    const media = Array.isArray(post.media)
      ? (post.media as Array<{ url?: string; type?: string }>)
      : [];
    const urls = Array.isArray(post.media_urls) ? (post.media_urls as string[]) : [];
    const items = media.length
      ? media
      : urls.map((url) => ({ url, type: isVideoUrl(url) ? "video" : "image" }));
    for (const item of items) {
      const type = String(item.type || "").toLowerCase();
      if (item.url && !type.includes("video") && !isVideoUrl(item.url, item.type)) {
        photos.push({
          url: String(item.url),
          source: "post",
          id: `post-${post.post_id}-${photos.length}`,
        });
      }
    }
  }
  return photos.slice(0, 36);
}

async function getPersonalPageFallback(userId: number): Promise<PersonalPage | null> {
  const [legacy, friends, feed] = await Promise.all([
    fetchLegacyProfile(userId),
    getFriendsOfUser(userId),
    getFeed(1, 40)
      .then((page) => page.data)
      .catch(() => []),
  ]);

  let row = legacy;
  if (!row?.user_id) {
    const directory = await getApprovedUsers({ accountType: "all", allPages: true }).catch(() => []);
    const hit = directory.find((person) => Number(person.user_id) === userId);
    if (hit) {
      row = {
        user_id: hit.user_id,
        user_firstname: hit.user_firstname,
        user_lastname: hit.user_lastname,
        display_name: hit.display_name || undefined,
        business_name: hit.business_name || undefined,
        user_picture: hit.user_picture,
        user_name: hit.user_name,
        address: hit.address,
        user_bio: (hit as { user_bio?: string | null }).user_bio,
        account_type: hit.account_type,
        user_verified: hit.user_verified,
        is_verified: hit.is_verified,
        badge_color: hit.badge_color,
      };
    }
  }

  if (!row?.user_id && !userId) return null;
  const id = Number(row?.user_id || userId);
  const me = await getUser();
  const isBiz = String(row?.account_type || "").toLowerCase() === "business";
  const name =
    (isBiz && String(row?.business_name || "").trim()) ||
    String(row?.display_name || row?.full_name || "").trim() ||
    [row?.user_firstname, row?.user_lastname].filter(Boolean).join(" ").trim() ||
    "JosCity member";
  const posts = feed.filter(
    (post) => Number(post.author?.id || post.user_id || 0) === id
  );
  const reels = posts.filter((post) =>
    String((post as { post_type?: string }).post_type || "").toLowerCase() === "reel"
  );
  const feedPosts = posts.filter(
    (post) => String((post as { post_type?: string }).post_type || "").toLowerCase() !== "reel"
  );

  return {
    profile: {
      user_id: id,
      name,
      handle: publicUsername(row?.user_name)
        ? `@${publicUsername(row?.user_name)}`
        : isBiz
          ? String(row?.user_email || row?.business_email || "").trim() || handleFromName(name)
          : handleFromName(name),
      picture: row?.user_picture || null,
      bio: String(row?.user_bio || "").trim() || null,
      location: String(row?.address || "").trim() || null,
      verified: Boolean(row?.is_verified || row?.user_verified),
      account_type: isBiz ? "business" : "personal",
      badge_color: row?.badge_color || null,
      membership_label: null,
      friend_count: friends.length,
      post_count: feedPosts.length,
      mutual_count: 0,
      joined_at: row?.user_registered || null,
      are_friends: friends.includes(Number(me?.user_id || 0)),
      is_owner: Number(me?.user_id || 0) === id,
    },
    posts: feedPosts,
    reels,
    photos: photosFromPosts(feedPosts),
  };
}
