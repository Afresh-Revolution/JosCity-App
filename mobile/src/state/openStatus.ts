import type { StoryMediaFile, StoryType } from "../api/stories";
import type { StatusGroup } from "../utils/stories";

export type PendingStatusMedia = {
  type: StoryType;
  uri?: string;
  name?: string | null;
  mimeType?: string | null;
  items?: StoryMediaFile[];
};

export function pendingStatusItems(pending: PendingStatusMedia | null): StoryMediaFile[] {
  if (!pending) return [];
  if (pending.items?.length) return pending.items;
  if (pending.uri) {
    return [{ uri: pending.uri, name: pending.name, mimeType: pending.mimeType }];
  }
  return [];
}

let cached: { key: string; group: StatusGroup } | null = null;
let pendingMedia: PendingStatusMedia | null = null;

export function statusGroupKey(group: StatusGroup): string {
  return String(group.userId || group.userName);
}

export function cacheOpenStatus(group: StatusGroup): void {
  cached = { key: statusGroupKey(group), group };
}

export function getCachedOpenStatus(key: string): StatusGroup | null {
  if (!cached) return null;
  if (cached.key === key) return cached.group;
  if (String(cached.group.userId) === key) return cached.group;
  if (cached.group.userName === decodeURIComponent(key)) return cached.group;
  return null;
}

export function setPendingStatusMedia(media: PendingStatusMedia | null): void {
  pendingMedia = media;
}

export function takePendingStatusMedia(): PendingStatusMedia | null {
  const next = pendingMedia;
  pendingMedia = null;
  return next;
}
