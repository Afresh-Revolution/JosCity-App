import { apiFetch, readJson } from "./client";
import { friendlyError } from "../utils/errors";

export type ForumAuthor = {
  id?: number;
  name?: string;
  picture?: string | null;
  account_type?: string;
};

export type ForumCategory = {
  id: number;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  thread_count?: number;
};

export type ForumThread = {
  id: number;
  category_id?: number;
  category_slug?: string;
  category_name?: string;
  title: string;
  body?: string;
  reply_count?: number;
  last_reply_at?: string;
  created_at?: string;
  user_id?: number;
  is_owner?: boolean;
  can_delete?: boolean;
  author?: ForumAuthor;
  replies?: ForumReply[];
};

export type ForumReply = {
  id: number;
  thread_id?: number;
  body?: string;
  created_at?: string;
  author?: ForumAuthor;
};

export const FALLBACK_FORUM_CATEGORIES: ForumCategory[] = [
  {
    id: 1,
    slug: "living-in-jos",
    name: "Living in Jos",
    description: "Housing, power, water and neighbourhood talk",
    icon: "home-outline",
    thread_count: 0,
  },
  {
    id: 2,
    slug: "getting-around",
    name: "Getting around Jos",
    description: "Routes, fares and road conditions",
    icon: "bus-outline",
    thread_count: 0,
  },
  {
    id: 3,
    slug: "business-trade",
    name: "Business & trade",
    description: "Suppliers, pricing and customers",
    icon: "briefcase-outline",
    thread_count: 0,
  },
  {
    id: 4,
    slug: "tech-skills",
    name: "Tech & skills",
    description: "Jobs, training and build-in-public",
    icon: "laptop-outline",
    thread_count: 0,
  },
];

export type ForumOverview = {
  categories: ForumCategory[];
  threads: ForumThread[];
};

async function readData<T>(path: string, fallback: T, init: RequestInit = {}): Promise<T> {
  try {
    const response = await apiFetch(path, { method: "GET", auth: true, timeoutMs: 20000, ...init });
    const payload = await readJson<{ success?: boolean; data?: T; error?: string }>(response);
    if (!response.ok) return fallback;
    return (payload.data as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getForumOverview(limit = 8): Promise<ForumOverview> {
  const data = await readData<ForumOverview>(`/forum/overview?limit=${limit}`, {
    categories: [],
    threads: [],
  });
  return {
    categories: data.categories?.length ? data.categories : FALLBACK_FORUM_CATEGORIES,
    threads: data.threads || [],
  };
}

export async function getForumCategories(): Promise<ForumCategory[]> {
  const data = await readData<ForumCategory[] | ForumOverview>("/forum/categories", []);
  const rows = Array.isArray(data) ? data : data.categories || [];
  return rows.length ? rows : FALLBACK_FORUM_CATEGORIES;
}

export async function getForumCategory(slug: string): Promise<ForumCategory | null> {
  if (!slug) return null;
  const row = await readData<ForumCategory | null>(`/forum/categories/${encodeURIComponent(slug)}`, null);
  return row || FALLBACK_FORUM_CATEGORIES.find((item) => item.slug === slug) || null;
}

export async function getForumThreads(options?: {
  category?: string;
  limit?: number;
}): Promise<ForumThread[]> {
  const query = new URLSearchParams();
  if (options?.category) query.set("category", options.category);
  query.set("limit", String(options?.limit ?? 40));
  const data = await readData<ForumThread[]>(`/forum/threads?${query.toString()}`, []);
  return Array.isArray(data) ? data : [];
}

export async function getForumThread(id: number): Promise<ForumThread | null> {
  if (!id) return null;
  return readData<ForumThread | null>(`/forum/threads/${id}`, null);
}

export async function createForumThread(params: {
  category_slug: string;
  category_name?: string;
  title: string;
  body: string;
}): Promise<{ success: boolean; data?: ForumThread; message?: string }> {
  try {
    const response = await apiFetch("/forum/threads", {
      method: "POST",
      auth: true,
      timeoutMs: 20000,
      body: JSON.stringify(params),
    });
    const payload = await readJson<{ success?: boolean; data?: ForumThread; error?: string }>(response);
    if (!response.ok) {
      return { success: false, message: payload.error || "Could not start this discussion" };
    }
    return { success: true, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export async function deleteForumThread(
  threadId: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiFetch(`/forum/threads/${threadId}`, {
      method: "DELETE",
      auth: true,
      timeoutMs: 20000,
    });
    const payload = await readJson<{ success?: boolean; error?: string }>(response);
    if (!response.ok) {
      return { success: false, message: payload.error || "Could not delete this thread" };
    }
    return { success: true };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export async function replyToForumThread(
  threadId: number,
  body: string
): Promise<{ success: boolean; data?: ForumReply; message?: string }> {
  try {
    const response = await apiFetch(`/forum/threads/${threadId}/replies`, {
      method: "POST",
      auth: true,
      timeoutMs: 20000,
      body: JSON.stringify({ body }),
    });
    const payload = await readJson<{ success?: boolean; data?: ForumReply; error?: string }>(response);
    if (!response.ok) {
      return { success: false, message: payload.error || "Could not post reply" };
    }
    return { success: true, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export function slugifyForumCategory(name: string): string {
  const slug = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "topic";
}

export function matchForumCategory(rows: ForumCategory[], name: string): ForumCategory | undefined {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return undefined;
  const slug = slugifyForumCategory(name);
  return rows.find(
    (item) => item.name.trim().toLowerCase() === trimmed || item.slug === slug
  );
}

export async function createForumCategory(
  name: string
): Promise<{ success: boolean; data?: ForumCategory; message?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { success: false, message: "Enter a category name" };
  }
  try {
    const response = await apiFetch("/forum/categories", {
      method: "POST",
      auth: true,
      timeoutMs: 20000,
      body: JSON.stringify({ name: trimmed }),
    });
    const payload = await readJson<{ success?: boolean; data?: ForumCategory; error?: string }>(
      response
    );
    if (!response.ok) {
      if (response.status !== 404 && response.status !== 405) {
        return { success: false, message: payload.error || "Could not add this category" };
      }
    } else if (payload.data?.slug) {
      return { success: true, data: payload.data };
    }
  } catch {
    // Keep a local chip if the API is not deployed yet.
  }
  return {
    success: true,
    data: {
      id: Date.now(),
      slug: slugifyForumCategory(trimmed),
      name: trimmed,
      description: "",
      icon: "chatbubbles-outline",
      thread_count: 0,
    },
  };
}

export function forumReplyLabel(count = 0): string {
  const n = Math.max(0, Number(count) || 0);
  return n === 1 ? "1 reply" : `${n} replies`;
}
