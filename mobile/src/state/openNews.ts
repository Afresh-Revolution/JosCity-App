import type { NewsItem } from "../api/explore";

let cached: NewsItem | null = null;

export function cacheOpenNews(item: NewsItem): void {
  cached = item;
}

export function getCachedOpenNews(id: number): NewsItem | null {
  if (!cached) return null;
  return Number(cached.id || 0) === id ? cached : null;
}
