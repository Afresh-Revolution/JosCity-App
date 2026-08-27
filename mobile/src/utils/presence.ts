const ONLINE_MS = 5 * 60 * 1000;

export function isRecentlyActive(iso?: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ONLINE_MS;
}

export function peerIsOnline(options: {
  peerId: number;
  onlineIds: Set<number>;
  lastMessageAt?: string | null;
  lastMessageSenderId?: number | null;
}): boolean {
  if (options.peerId > 0 && options.onlineIds.has(options.peerId)) return true;
  if (!options.lastMessageSenderId || options.lastMessageSenderId !== options.peerId) {
    return false;
  }
  return isRecentlyActive(options.lastMessageAt);
}
