/** Picks once per app launch so Home does not reshuffle on refresh. */
let launchSlot: number | null = null;
let launchSeed: number | null = null;

export function peopleInsertIndex(postCount: number): number | null {
  if (postCount <= 0) return null;
  if (launchSlot == null) {
    launchSlot = Math.floor(Math.random() * 10);
  }
  return Math.min(launchSlot, postCount - 1);
}

export function shuffleForLaunch<T>(items: T[]): T[] {
  if (launchSeed == null) {
    launchSeed = Math.floor(Math.random() * 1_000_000_000) + 1;
  }
  const copy = [...items];
  let seed = launchSeed;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}
