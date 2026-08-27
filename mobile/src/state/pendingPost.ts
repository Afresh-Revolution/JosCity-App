type Listener = () => void;

export type PendingPost = {
  id: number;
  progress: number;
};

let nextId = 1;
let pending: PendingPost | null = null;
let abortUpload: (() => void) | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getPendingPost(): PendingPost | null {
  return pending;
}

export function startPendingPost(abort: () => void): number {
  abortUpload?.();
  const id = nextId++;
  abortUpload = abort;
  pending = { id, progress: 0.04 };
  notify();
  return id;
}

export function setPendingPostProgress(id: number, progress: number): void {
  if (!pending || pending.id !== id) return;
  pending = { id, progress: Math.max(0, Math.min(1, progress)) };
  notify();
}

export function clearPendingPost(id?: number): void {
  if (id != null && pending?.id !== id) return;
  abortUpload = null;
  if (!pending) return;
  pending = null;
  notify();
}

export function cancelPendingPost(): void {
  abortUpload?.();
  abortUpload = null;
  pending = null;
  notify();
}

export function onPendingPostChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
