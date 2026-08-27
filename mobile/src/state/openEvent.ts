import type { ExploreEvent } from "../api/explore";

let cached: ExploreEvent | null = null;

export function cacheOpenEvent(event: ExploreEvent): void {
  cached = event;
}

export function getCachedOpenEvent(id: number): ExploreEvent | null {
  if (!cached) return null;
  const eventId = Number(cached.event_id || cached.id || 0);
  return eventId === id ? cached : null;
}
