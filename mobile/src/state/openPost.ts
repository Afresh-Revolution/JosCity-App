import type { FeedPost } from "../api/feed";

let cached: FeedPost | null = null;

export function cacheOpenPost(post: FeedPost): void {
  cached = post;
}

export function getCachedOpenPost(postId: number): FeedPost | null {
  if (!cached) return null;
  const id = Number(cached.post_id || cached.id || 0);
  return id === postId ? cached : null;
}
