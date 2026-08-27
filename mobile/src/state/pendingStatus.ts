import type { StatusStory } from "../utils/stories";

type Listener = () => void;

let pending: StatusStory[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getPendingStatusStories(): StatusStory[] {
  return pending;
}

export function setPendingStatusStories(stories: StatusStory[]): void {
  pending = stories;
  notify();
}

export function removePendingStatusStory(id: number): void {
  pending = pending.filter((story) => story.id !== id);
  notify();
}

export function clearPendingStatusStories(): void {
  if (!pending.length) return;
  pending = [];
  notify();
}

export function onPendingStatusChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
