import { apiFetch, readJson, uploadForm } from "./client";
import { resolveSaved } from "../state/savedPosts";
import { friendlyError } from "../utils/errors";

export type FeedAuthor = {
  id?: number | null;
  name?: string;
  picture?: string | null;
  verified?: boolean;
  has_cac?: boolean;
  cac_verified?: boolean;
  badge_color?: string | null;
  account_type?: string;
  username?: string | null;
  email?: string | null;
};

export type FeedMedia = {
  url: string;
  type?: string;
};

export type FeedPost = {
  post_id: number;
  id?: number;
  user_id?: number;
  text?: string | null;
  caption?: string | null;
  created_at?: string;
  time_ago?: string | null;
  media?: FeedMedia[];
  media_urls?: string[];
  media_types?: string[];
  post_type?: string;
  original_post?: (FeedPost & { unavailable?: boolean }) | null;
  user_shared?: boolean;
  author?: FeedAuthor;
  reactions_count?: number;
  comments_count?: number;
  shares_count?: number;
  user_reacted?: boolean;
  user_saved?: boolean;
  is_pinned?: boolean;
  pinned?: boolean;
};

export type FeedPage = {
  success: boolean;
  data: FeedPost[];
  pagination?: { page: number; limit: number; hasMore: boolean };
  message?: string;
  feedSessionId?: string;
  feedSessionExpiresAt?: string;
  sessionReset?: boolean;
};

export type FeedSessionRequest = { feedSessionId?: string; cursor?: string; refresh?: boolean };
export type SessionFeedPage = Omit<FeedPage, "pagination"> & {
  pagination?: { page?: number; limit: number; hasMore: boolean; nextCursor?: string | null };
};

export async function getFeed(page = 1, limit = 10, session?: FeedSessionRequest): Promise<SessionFeedPage> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    type: "all",
    feedChannel: "main",
  });
  if (session) {
    query.set("sessionMode", "1");
    if (session.feedSessionId) query.set("feedSessionId", session.feedSessionId);
    if (session.cursor) query.set("cursor", session.cursor);
    if (session.refresh) query.set("refresh", "1");
  }
  const response = await apiFetch(`/feed/feeds?${query.toString()}`, {
    method: "GET",
    auth: true,
    timeoutMs: 30000,
  });
  const data = await readJson<SessionFeedPage & { code?: string }>(response);
  if (!response.ok || data.success === false) {
    if (session?.feedSessionId && data.code === "INVALID_FEED_SESSION") {
      return getFeed(1, limit, {});
    }
    throw new Error(data.message || "Could not load feed");
  }
  if (session && !data.feedSessionId) {
    throw new Error("Feed ranking is not available. Please update the server and try again.");
  }
  const posts = (Array.isArray(data.data) ? data.data : []).map((post) => {
    const postId = Number(post.post_id || post.id || 0);
    return {
      ...post,
      post_id: postId,
      user_saved: resolveSaved(postId, post.user_saved),
    };
  });

  return {
    success: true,
    data: posts.filter((post) => post.post_id > 0),
    pagination: data.pagination,
    feedSessionId: data.feedSessionId,
    feedSessionExpiresAt: data.feedSessionExpiresAt,
    sessionReset: data.sessionReset,
  };
}

export async function getPost(postId: number): Promise<FeedPost | null> {
  if (!postId) return null;
  try {
    const response = await apiFetch(`/feed/posts/${postId}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const payload = await readJson<{ data?: FeedPost }>(response);
    const post = payload.data;
    if (response.ok && post) {
      const id = Number(post.post_id || post.id || 0);
      if (id > 0) {
        return {
          ...post,
          post_id: id,
          user_saved: resolveSaved(id, post.user_saved),
        };
      }
    }
    const fallback = await apiFetch(`/posts/${postId}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const fallbackPayload = await readJson<{ data?: FeedPost }>(fallback);
    const fallbackPost = fallbackPayload.data;
    if (!fallback.ok || !fallbackPost) return null;
    const id = Number(fallbackPost.post_id || fallbackPost.id || 0);
    if (id <= 0) return null;
    return {
      ...fallbackPost,
      post_id: id,
      user_saved: resolveSaved(id, fallbackPost.user_saved),
    };
  } catch {
    return null;
  }
}

export type PostReactionState = { liked: boolean; reactionsCount: number };

async function readReactionState(response: Response): Promise<PostReactionState> {
  const data = await readJson<{
    success?: boolean;
    message?: string;
    data?: { user_reaction?: { reaction_id?: number } | null; reactions?: Array<{ count?: number | string }> };
  }>(response);
  if (!response.ok || data.success === false) throw new Error(data.message || "Could not update reaction");
  return {
    liked: Number(data.data?.user_reaction?.reaction_id || 0) === 1,
    reactionsCount: (data.data?.reactions || []).reduce((total, item) => total + Math.max(0, Number(item.count) || 0), 0),
  };
}

export async function reactToPost(postId: number): Promise<PostReactionState> {
  const response = await apiFetch(`/posts/${postId}/react`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reaction_id: 1, reaction: "like" }),
  });
  return readReactionState(response);
}

export async function removeReaction(postId: number): Promise<PostReactionState> {
  const response = await apiFetch(`/posts/${postId}/react`, {
    method: "DELETE",
    auth: true,
  });
  return readReactionState(response);
}

type FeedActionResult = {
  success: boolean;
  aborted?: boolean;
  message?: string;
  already_reported?: boolean;
};

async function feedAction(
  path: string,
  init: RequestInit & { timeoutMs?: number }
): Promise<FeedActionResult> {
  try {
    const response = await apiFetch(path, { ...init, auth: true });
    const data = await readJson<{
      success?: boolean;
      error?: string | boolean;
      message?: string;
      already_reported?: boolean;
    }>(response);
    if (!response.ok) {
      return {
        success: false,
        message: friendlyError(
          (typeof data.error === "string" && data.error) ||
            data.message ||
            "Request failed"
        ),
      };
    }
    return {
      success: true,
      message: data.message,
      already_reported: data.already_reported,
    };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export async function savePost(postId: number): Promise<boolean> {
  const result = await feedAction(`/feed/posts/${postId}/save`, { method: "POST" });
  return result.success;
}

export async function unsavePost(postId: number): Promise<boolean> {
  const result = await feedAction(`/feed/posts/${postId}/save`, { method: "DELETE" });
  return result.success;
}

export async function reportPost(
  postId: number,
  reason?: string
): Promise<FeedActionResult> {
  return feedAction(`/feed/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Reported from the app" }),
  });
}

export type ReshareResult = {
  post: FeedPost;
  unshared: boolean;
  removedPostIds: number[];
};

export async function resharePost(postId: number): Promise<ReshareResult> {
  const response = await apiFetch(`/posts/${postId}/share`, {
    method: "POST",
    auth: true,
  });
  const result = await readJson<{
    success: boolean;
    data?: FeedPost;
    error?: string;
    message?: string;
    unshared?: boolean;
    removed_post_ids?: number[];
  }>(response);
  if (!response.ok || !result.success) {
    throw new Error(result.error || result.message || "Could not reshare this post.");
  }
  if (!result.unshared && !result.data) {
    throw new Error(result.error || result.message || "Could not reshare this post.");
  }
  return {
    post: result.data
      ? { ...result.data, post_id: Number(result.data.post_id || result.data.id) }
      : { post_id: postId },
    unshared: Boolean(result.unshared),
    removedPostIds: Array.isArray(result.removed_post_ids)
      ? result.removed_post_ids.map((id) => Number(id)).filter((id) => id > 0)
      : [],
  };
}

export async function deletePost(postId: number): Promise<boolean> {
  const result = await feedAction(`/feed/posts/${postId}`, { method: "DELETE" });
  return result.success;
}

export async function updatePost(postId: number, text: string): Promise<boolean> {
  const result = await feedAction(`/feed/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
  return result.success;
}

export async function pinPost(postId: number, pinned: boolean): Promise<boolean> {
  const result = await feedAction(`/feed/posts/${postId}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
  return result.success;
}

export type PostMediaFile = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  kind: "photo" | "video";
};

export function createPost(
  text: string,
  media: PostMediaFile[] = [],
  options: { onProgress?: (progress: number) => void } = {}
): { promise: Promise<FeedActionResult>; abort: () => void } {
  const caption = text.trim();
  if (!caption && media.length === 0) {
    return {
      abort: () => undefined,
      promise: Promise.resolve({ success: false, message: "Post cannot be empty" }),
    };
  }

  const form = new FormData();
  form.append("text", caption);
  for (const item of media) {
    const ext = (item.uri.split(".").pop() || (item.kind === "video" ? "mp4" : "jpg"))
      .split("?")[0]
      .toLowerCase();
    const name =
      item.name ||
      (item.kind === "video" ? `post.${ext || "mp4"}` : `post.${ext === "png" ? "png" : "jpg"}`);
    const type =
      item.mimeType ||
      (item.kind === "video"
        ? "video/mp4"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg");
    form.append(item.kind === "video" ? "videos" : "photos", {
      uri: item.uri,
      name,
      type,
    } as unknown as Blob);
  }

  const upload = uploadForm("/feed/posts", form, {
    timeoutMs: media.some((item) => item.kind === "video") ? 180000 : media.length ? 90000 : 25000,
    onProgress: options.onProgress,
  });

  return {
    abort: upload.abort,
    promise: upload.promise
      .then((result) => {
        if (result.aborted) {
          return { success: false, aborted: true, message: "Cancelled" };
        }
        if (!result.ok) {
          return {
            success: false,
            message: friendlyError(
              (typeof result.data.error === "string" && result.data.error) ||
                result.data.message ||
                "Request failed"
            ),
          };
        }
        return { success: true, message: result.data.message };
      })
      .catch(() => ({ success: false, message: friendlyError("offline") })),
  };
}

export type ScheduledPost = {
  id: number;
  user_id?: number;
  text?: string | null;
  media_urls?: string[] | null;
  media_types?: string[] | null;
  scheduled_at: string;
  status?: string | null;
  published_post_id?: number | null;
};

function mapScheduledPost(row: ScheduledPost): ScheduledPost | null {
  const id = Number(row.id || 0);
  if (id <= 0) return null;
  return {
    ...row,
    id,
    published_post_id: row.published_post_id ? Number(row.published_post_id) : null,
  };
}

export async function listScheduledPosts(
  status: "pending" | "published" | "failed" | "cancelled" | "all" = "pending"
): Promise<ScheduledPost[]> {
  const query = new URLSearchParams({ status });
  const response = await apiFetch(`/feed/scheduled-posts?${query.toString()}`, {
    method: "GET",
    auth: true,
    timeoutMs: 20000,
  });
  const payload = await readJson<{ success?: boolean; data?: ScheduledPost[]; message?: string }>(response);
  if (!response.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.message || "Could not load scheduled posts");
  }
  return payload.data.map(mapScheduledPost).filter((row): row is ScheduledPost => Boolean(row));
}

export function createScheduledPost(
  text: string,
  scheduledAt: Date,
  media: PostMediaFile[] = [],
  options: { onProgress?: (progress: number) => void } = {}
): { promise: Promise<FeedActionResult>; abort: () => void } {
  const caption = text.trim();
  if (!caption && media.length === 0) {
    return {
      abort: () => undefined,
      promise: Promise.resolve({ success: false, message: "Post cannot be empty" }),
    };
  }

  const form = new FormData();
  form.append("text", caption);
  form.append("scheduled_at", scheduledAt.toISOString());
  for (const item of media) {
    const ext = (item.uri.split(".").pop() || (item.kind === "video" ? "mp4" : "jpg"))
      .split("?")[0]
      .toLowerCase();
    const name =
      item.name ||
      (item.kind === "video" ? `post.${ext || "mp4"}` : `post.${ext === "png" ? "png" : "jpg"}`);
    const type =
      item.mimeType ||
      (item.kind === "video"
        ? "video/mp4"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg");
    form.append(item.kind === "video" ? "videos" : "photos", {
      uri: item.uri,
      name,
      type,
    } as unknown as Blob);
  }

  const upload = uploadForm("/feed/scheduled-posts", form, {
    timeoutMs: media.some((item) => item.kind === "video") ? 180000 : media.length ? 90000 : 25000,
    onProgress: options.onProgress,
  });

  return {
    abort: upload.abort,
    promise: upload.promise
      .then((result) => {
        if (result.aborted) {
          return { success: false, aborted: true, message: "Cancelled" };
        }
        if (!result.ok) {
          return {
            success: false,
            message: friendlyError(
              (typeof result.data.error === "string" && result.data.error) ||
                result.data.message ||
                "Request failed"
            ),
          };
        }
        return { success: true, message: result.data.message };
      })
      .catch(() => ({ success: false, message: friendlyError("offline") })),
  };
}

export async function cancelScheduledPost(id: number): Promise<FeedActionResult> {
  return feedAction(`/feed/scheduled-posts/${id}`, { method: "DELETE" });
}

export async function getSavedPosts(page = 1, limit = 20): Promise<FeedPage> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await apiFetch(`/feed/saved-posts?${query.toString()}`, {
    method: "GET",
    auth: true,
  });
  const data = await readJson<FeedPage>(response);
  const posts = (Array.isArray(data.data) ? data.data : []).map((post) => {
    const postId = Number(post.post_id || post.id || 0);
    return {
      ...post,
      post_id: postId,
      user_saved: resolveSaved(postId, post.user_saved ?? true),
    };
  });
  return {
    success: response.ok,
    data: posts.filter((post) => post.post_id > 0),
    pagination: data.pagination,
    message: data.message,
  };
}

export function normalizeHashtagName(value?: string | null): string {
  return String(value || "")
    .replace(/^#+/, "")
    .trim()
    .toLowerCase();
}

function postUsesHashtag(post: FeedPost, tag: string): boolean {
  const needle = normalizeHashtagName(tag);
  if (!needle) return false;
  const text = `${post.text || ""} ${post.caption || ""}`;
  return new RegExp(`(^|[^A-Za-z0-9_])#${needle}\\b`, "i").test(text);
}

export async function getPostsByHashtag(tag: string, page = 1, limit = 20): Promise<FeedPage> {
  const clean = normalizeHashtagName(tag);
  if (!clean) {
    return { success: true, data: [], pagination: { page: 1, limit, hasMore: false } };
  }

  try {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await apiFetch(
      `/feed/by-hashtag/${encodeURIComponent(clean)}?${query.toString()}`,
      { method: "GET", auth: true, timeoutMs: 25000 }
    );
    const data = await readJson<FeedPage>(response);
    const posts = (Array.isArray(data.data) ? data.data : []).map((post) => {
      const postId = Number(post.post_id || post.id || 0);
      return {
        ...post,
        post_id: postId,
        user_saved: resolveSaved(postId, post.user_saved),
      };
    });
    const rows = posts.filter((post) => post.post_id > 0);
    if (rows.length) {
      return {
        success: true,
        data: rows,
        pagination: data.pagination,
      };
    }
  } catch {
    // Fall through to feed scan.
  }

  try {
    const feed = await getFeed(1, 50);
    const matched = feed.data.filter((post) => postUsesHashtag(post, clean));
    return {
      success: true,
      data: matched,
      pagination: { page: 1, limit, hasMore: false },
    };
  } catch {
    return { success: false, data: [], message: "Could not load posts." };
  }
}

export async function getSavedPostsCount(): Promise<number> {
  try {
    const result = await getSavedPosts(1, 50);
    return result.data.length;
  } catch {
    return 0;
  }
}
