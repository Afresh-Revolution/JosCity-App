type Listener = () => void;

const listeners = new Set<Listener>();

export function onHomeRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestHomeRefresh(): void {
  listeners.forEach((listener) => listener());
}
