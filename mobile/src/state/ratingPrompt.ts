type Listener = () => void;

let requestedOrderId: number | null = null;
let generation = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getRequestedRatingOrderId(): number | null {
  return requestedOrderId;
}

export function ratingPromptGeneration(): number {
  return generation;
}

/** Open the personal rating popup. Pass an order id from a notification tap. */
export function openRatingPrompt(orderId?: number) {
  requestedOrderId = Number(orderId) > 0 ? Number(orderId) : null;
  generation += 1;
  notify();
}

/** Recheck pending ratings without clearing a notification-selected order. */
export function nudgeRatingPrompt() {
  generation += 1;
  notify();
}

export function clearRequestedRatingOrder() {
  requestedOrderId = null;
}

export function onRatingPromptRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
