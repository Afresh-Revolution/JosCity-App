import { apiFetch, readJson, uploadForm } from "./client";
import { friendlyError } from "../utils/errors";

export type StoryType = "text" | "photo" | "video";

export type StoryApiUser = {
  id?: number;
  user_id?: number;
  name?: string;
  display_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  account_type?: string;
  business_name?: string;
  picture?: string | null;
  profile_image_url?: string | null;
  verified?: boolean;
};

export type StoryApiItem = {
  id?: number;
  story_id?: number;
  type?: StoryType;
  src?: string;
  content?: string;
  image_url?: string;
  video_url?: string;
  caption?: string;
  created_at?: string;
  expires_at?: string;
  user_id?: number;
  background_color?: string;
  text_color?: string;
  views?: Array<{ userId?: number; userName?: string; viewedAt?: number }>;
  reactions?: Array<{ userId?: number; userName?: string; reactedAt?: number }>;
};

export type StoryApiGroup = {
  user?: StoryApiUser;
  stories?: StoryApiItem[];
  has_unseen?: boolean;
};

export type StoriesPage = {
  success: boolean;
  data: StoryApiGroup[];
  message?: string;
};

export type StoryMediaFile = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
};

export async function getStories(): Promise<StoriesPage> {
  const response = await apiFetch("/stories", {
    method: "GET",
    auth: true,
    timeoutMs: 25000,
  });
  const data = await readJson<StoriesPage>(response);
  if (!response.ok) {
    throw new Error(data.message || "Could not load status");
  }
  return {
    success: true,
    data: Array.isArray(data.data) ? data.data : [],
  };
}

function createdStoryId(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const row = payload as Record<string, unknown>;
  const nested =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : row;
  return Number(nested.story_id || nested.id || row.story_id || row.id || 0) || 0;
}

export async function createStory(input: {
  type: StoryType;
  src?: string;
  caption?: string;
  duration?: number;
  backgroundColor?: string;
  textColor?: string;
  media?: StoryMediaFile;
}): Promise<{ success: boolean; message?: string; storyId?: number }> {
  try {
    const isMedia = input.type === "photo" || input.type === "video";
    if (isMedia && input.media?.uri) {
      const uri = input.media.uri;
      const ext = (uri.split(".").pop() || (input.type === "video" ? "mp4" : "jpg"))
        .split("?")[0]
        .toLowerCase();
      const name =
        input.media.name ||
        (input.type === "video" ? `status.${ext || "mp4"}` : `status.${ext === "png" ? "png" : "jpg"}`);
      const type =
        input.media.mimeType ||
        (input.type === "video"
          ? ext === "mov"
            ? "video/quicktime"
            : "video/mp4"
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg");
      const form = new FormData();
      form.append("type", input.type);
      form.append("duration", String(input.duration ?? 24));
      if (input.caption?.trim()) form.append("caption", input.caption.trim());
      if (input.backgroundColor) form.append("background_color", input.backgroundColor);
      if (input.textColor) form.append("text_color", input.textColor);
      form.append(
        "media",
        {
          uri,
          name,
          type,
        } as unknown as Blob
      );
      const upload = uploadForm("/stories", form, {
        timeoutMs: input.type === "video" ? 180000 : 90000,
      });
      const result = await upload.promise;
      if (result.aborted) {
        return { success: false, message: friendlyError("timeout") };
      }
      if (!result.ok) {
        return {
          success: false,
          message: friendlyError(
            (typeof result.data.error === "string" && result.data.error) ||
              result.data.message ||
              "upload"
          ),
        };
      }
      return {
        success: true,
        message: result.data.message,
        storyId: createdStoryId(result.data),
      };
    }

    const response = await apiFetch("/stories", {
      method: "POST",
      auth: true,
      timeoutMs: 25000,
      body: JSON.stringify({
        type: input.type,
        src: input.src || "",
        duration: input.duration ?? 24,
        background_color: input.backgroundColor,
        text_color: input.textColor,
      }),
    });
    const data = await readJson<{
      success?: boolean;
      message?: string;
      error?: string;
      data?: { story_id?: number; id?: number };
      story_id?: number;
      id?: number;
    }>(response);
    if (!response.ok) {
      return {
        success: false,
        message: friendlyError(data.message || data.error || "Failed to create status"),
      };
    }
    return { success: true, message: data.message, storyId: createdStoryId(data) };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export async function viewStory(storyId: number): Promise<void> {
  if (!storyId) return;
  try {
    await apiFetch(`/stories/${storyId}/view`, {
      method: "GET",
      auth: true,
      timeoutMs: 15000,
    });
  } catch {
    // Viewing is best-effort; don't block the viewer.
  }
}

export async function deleteStory(storyId: number): Promise<boolean> {
  if (!storyId) return false;
  try {
    const response = await apiFetch(`/stories/${storyId}`, {
      method: "DELETE",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type StoryViewer = {
  id: number;
  userId: number;
  name: string;
  picture: string | null;
  accountType?: string | null;
  viewedAt?: string;
  timeAgo?: string;
  liked?: boolean;
};

function asStoryViewer(row: unknown, index: number): StoryViewer | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const user =
    item.user && typeof item.user === "object"
      ? (item.user as Record<string, unknown>)
      : item;
  const name = String(
    user.name ||
      user.display_name ||
      item.userName ||
      item.user_name ||
      [user.user_firstname, user.user_lastname].filter(Boolean).join(" ")
  ).trim();
  const userId = Number(user.id || user.user_id || item.userId || item.user_id || 0);
  if (!name && !userId) return null;
  const viewedAt = String(item.viewed_at || item.viewedAt || "");
  const timeAgo = String(item.time_ago || item.timeAgo || "");
  return {
    id: Number(item.id || item.view_id || userId || index + 1),
    userId,
    name: name || "JosCity member",
    picture: (user.picture || user.user_picture || item.picture || null) as string | null,
    accountType: String(user.account_type || item.account_type || "") || null,
    viewedAt: viewedAt || undefined,
    timeAgo: timeAgo || undefined,
    liked: item.liked === true || item.liked === 1 || item.liked === "1" || item.has_liked === true,
  };
}

export async function getStoryPreview(storyId: number): Promise<{
  type: StoryType;
  src: string;
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
} | null> {
  if (!storyId) return null;
  try {
    const response = await apiFetch(`/stories/${storyId}`, {
      method: "GET",
      auth: true,
      timeoutMs: 12000,
    });
    if (!response.ok) return null;
    const data = await readJson<{
      data?: {
        type?: StoryType;
        src?: string;
        caption?: string | null;
        background_color?: string | null;
        text_color?: string | null;
      };
    }>(response);
    const row = data.data;
    const type = row?.type === "video" || row?.type === "text" || row?.type === "photo" ? row.type : null;
    if (!row || !type) return null;
    return {
      type,
      src: String(row.src || ""),
      caption: row.caption || undefined,
      backgroundColor: row.background_color || undefined,
      textColor: row.text_color || undefined,
    };
  } catch {
    return null;
  }
}

export async function getStoryViews(storyId: number): Promise<{
  count: number;
  viewers: StoryViewer[];
}> {
  if (!storyId) return { count: 0, viewers: [] };
  try {
    const response = await apiFetch(`/stories/${storyId}/views`, {
      method: "GET",
      auth: true,
    });
    const data = await readJson<{
      data?: { views_count?: number; views?: unknown[] } | unknown[];
      views_count?: number;
    }>(response);
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray((data.data as { views?: unknown[] } | undefined)?.views)
        ? (data.data as { views: unknown[] }).views
        : [];
    const viewers = rows
      .map((row, index) => asStoryViewer(row, index))
      .filter((row): row is StoryViewer => Boolean(row));
    const nestedCount =
      data.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? Number((data.data as { views_count?: number }).views_count || 0)
        : 0;
    return {
      count: viewers.length || nestedCount || Number(data.views_count || 0),
      viewers,
    };
  } catch {
    return { count: 0, viewers: [] };
  }
}

export async function getStoryViewsCount(storyId: number): Promise<number> {
  const result = await getStoryViews(storyId);
  return result.count;
}

export async function reactToStory(storyId: number): Promise<void> {
  const response = await apiFetch(`/stories/${storyId}/react`, { method: "POST", auth: true });
  const data = await readJson<{ success?: boolean; message?: string; error?: string }>(response);
  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
        (data as { error?: string }).error ||
        "Could not react to status."
    );
  }
}
