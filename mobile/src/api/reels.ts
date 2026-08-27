import { apiFetch, apiUrl, readJson } from "./client";
import { getAuthToken } from "../storage/session";
import type { FeedAuthor, FeedMedia } from "./feed";
import { friendlyError } from "../utils/errors";

export type ReelItem = {
  id: number;
  post_id: number;
  user_id?: number;
  title?: string;
  text?: string | null;
  caption?: string | null;
  category?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  media?: FeedMedia[];
  author?: FeedAuthor;
  reactions_count?: number;
  comments_count?: number;
  user_reacted?: boolean;
  user_saved?: boolean;
};

type ReelMediaFile = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  kind: "photo" | "video";
};

function asReel(row: Partial<ReelItem> & { id?: number; post_id?: number }): ReelItem | null {
  const id = Number(row.post_id || row.id || 0);
  if (!id) return null;
  return {
    ...row,
    id,
    post_id: id,
    thumbnail_url: row.thumbnail_url || (row as { thumbnailUrl?: string }).thumbnailUrl || null,
    video_url: row.video_url || (row as { videoUrl?: string }).videoUrl || null,
  };
}

export async function getReels(limit = 40): Promise<ReelItem[]> {
  try {
    const response = await apiFetch(`/reels?page=1&limit=${limit}&sort=recent`, {
      method: "GET",
      auth: true,
      timeoutMs: 25000,
    });
    const payload = await readJson<{ data?: Partial<ReelItem>[] }>(response);
    return (Array.isArray(payload.data) ? payload.data : [])
      .map((row) => asReel(row))
      .filter((row): row is ReelItem => Boolean(row));
  } catch {
    return [];
  }
}

export async function createReel(
  caption: string,
  media: ReelMediaFile,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; message?: string }> {
  const form = new FormData();
  const text = caption.trim();
  if (text) {
    form.append("text", text);
    form.append("caption", text);
  }
  const ext = (media.uri.split(".").pop() || (media.kind === "video" ? "mp4" : "jpg"))
    .split("?")[0]
    .toLowerCase();
  const name =
    media.name ||
    (media.kind === "video" ? `reel.${ext || "mp4"}` : `reel.${ext === "png" ? "png" : "jpg"}`);
  const type =
    media.mimeType ||
    (media.kind === "video"
      ? "video/mp4"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg");
  form.append(media.kind === "video" ? "videos" : "photos", {
    uri: media.uri,
    name,
    type,
  } as unknown as Blob);

  try {
    const result = await postForm("/reels", form, {
      timeoutMs: 120000,
      onProgress,
    });
    if (!result.ok) {
      return {
        success: false,
        message:
          (typeof result.data.error === "string" && result.data.error) ||
          result.data.message ||
          "Could not post reel",
      };
    }
    return { success: true, message: result.data.message };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

function postForm(
  path: string,
  form: FormData,
  options: { timeoutMs?: number; onProgress?: (progress: number) => void }
): Promise<{
  ok: boolean;
  data: { success?: boolean; error?: string; message?: string };
}> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const xhr = new XMLHttpRequest();
      const token = await getAuthToken();
      let last = 0.04;
      options.onProgress?.(last);
      const pulse = setInterval(() => {
        last = Math.min(0.88, last + 0.03);
        options.onProgress?.(last);
      }, 450);

      xhr.open("POST", apiUrl(path));
      xhr.timeout = options.timeoutMs || 120000;
      xhr.setRequestHeader("Accept", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        last = Math.max(last, Math.min(0.92, event.loaded / event.total));
        options.onProgress?.(last);
      };
      xhr.onload = () => {
        clearInterval(pulse);
        options.onProgress?.(1);
        let data: { success?: boolean; error?: string; message?: string } = {};
        try {
          data = JSON.parse(xhr.responseText || "{}") as typeof data;
        } catch {
          data = {};
        }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
      };
      xhr.onerror = () => {
        clearInterval(pulse);
        reject(new Error("network"));
      };
      xhr.ontimeout = () => {
        clearInterval(pulse);
        reject(new Error("timeout"));
      };
      xhr.send(form);
    })().catch(reject);
  });
}

export async function recordReelView(postId: number): Promise<void> {
  if (!postId) return;
  try {
    await apiFetch(`/reels/${postId}/view`, { method: "POST", auth: true });
  } catch {
    // Viewing is best-effort.
  }
}

export async function toggleSavedReel(
  postId: number,
  saved?: boolean
): Promise<boolean | null> {
  if (!postId) return null;
  try {
    const response = await apiFetch(`/reels/${postId}/save`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(saved == null ? {} : { saved }),
    });
    const data = await readJson<{ data?: { saved?: boolean } }>(response);
    if (!response.ok) return null;
    return Boolean(data.data?.saved);
  } catch {
    return null;
  }
}
