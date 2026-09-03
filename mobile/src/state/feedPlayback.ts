type Listener = (playingId: string | null) => void;

let playingId: string | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener(playingId));
}

export function createFeedPlaybackId(): string {
  const id = nextId;
  nextId += 1;
  return `feed-video-${id}`;
}

export function claimFeedPlayback(id: string): void {
  if (playingId === id) return;
  playingId = id;
  notify();
}

export function releaseFeedPlayback(id: string): void {
  if (playingId !== id) return;
  playingId = null;
  notify();
}

export function subscribeFeedPlayback(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
