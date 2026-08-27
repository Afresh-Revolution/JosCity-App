import { apiFetch, readJson } from "./client";
import { applyCommentReactions, setCommentReaction } from "../state/commentReactions";

export type CommentAuthor = {
  id?: number;
  name?: string;
  picture?: string | null;
  verified?: boolean;
  account_type?: string;
  has_cac?: boolean;
  cac_verified?: boolean;
  badge_color?: string | null;
};

export type PostComment = {
  id?: number;
  comment_id?: number;
  post_id?: number;
  user_id?: number;
  parent_comment_id?: number | null;
  text?: string | null;
  comment?: string | null;
  time_ago?: string | null;
  created_at?: string;
  reactions_count?: number;
  user_reacted?: boolean;
  author?: CommentAuthor;
  user?: {
    user_id?: number;
    display_name?: string;
    profile_image_url?: string | null;
  };
  replies?: PostComment[];
};

function commentId(row: PostComment): number {
  return Number(row.comment_id || row.id || 0);
}

export async function getPostComments(postId: number): Promise<PostComment[]> {
  try {
    const response = await apiFetch(`/posts/${postId}/comments?page=1&limit=100`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{ data?: PostComment[] }>(response);
    const rows = Array.isArray(data.data) ? data.data.filter((row) => commentId(row) > 0) : [];
    return applyCommentReactions(rows);
  } catch {
    return [];
  }
}

export async function commentOnPost(
  postId: number,
  text: string
): Promise<PostComment | null> {
  try {
    const response = await apiFetch(`/posts/${postId}/comment`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ text, comment: text }),
    });
    const data = await readJson<{ data?: PostComment }>(response);
    return response.ok ? data.data || null : null;
  } catch {
    return null;
  }
}

export async function replyToComment(
  commentIdValue: number,
  text: string
): Promise<PostComment | null> {
  try {
    const response = await apiFetch(`/comments/${commentIdValue}/reply`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ text, comment: text }),
    });
    const data = await readJson<{ data?: PostComment }>(response);
    return response.ok ? data.data || null : null;
  } catch {
    return null;
  }
}

export async function reactToComment(
  commentIdValue: number,
  like: boolean
): Promise<{ user_reacted: boolean; reactions_count: number } | null> {
  try {
    const response = await apiFetch(`/comments/${commentIdValue}/react`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ like }),
    });
    const data = await readJson<{
      success?: boolean;
      data?: { user_reacted?: boolean; reactions_count?: number };
      user_reacted?: boolean;
      reactions_count?: number;
    }>(response);
    if (!response.ok) return null;
    const payload = data.data && typeof data.data === "object" ? data.data : data;
    const saved = {
      user_reacted:
        typeof payload.user_reacted === "boolean" ? payload.user_reacted : like,
      reactions_count: Number.isFinite(Number(payload.reactions_count))
        ? Number(payload.reactions_count)
        : like
          ? 1
          : 0,
    };
    setCommentReaction(commentIdValue, saved);
    return saved;
  } catch {
    return null;
  }
}
