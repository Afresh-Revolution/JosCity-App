import type { ForumThread } from "../api/forum";

let cached: ForumThread | null = null;

export function cacheOpenThread(thread: ForumThread): void {
  cached = thread;
}

export function getCachedOpenThread(id: number): ForumThread | null {
  if (!cached) return null;
  return Number(cached.id || 0) === id ? cached : null;
}
