import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUser } from "./session";

const KEY = "joscity.blockedUserIds";

let ownerId = 0;
let cache = new Set<number>();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeBlockedUsers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isUserBlocked(userId: number): boolean {
  return cache.has(Number(userId));
}

async function persist() {
  if (!ownerId) return;
  await AsyncStorage.setItem(`${KEY}.${ownerId}`, JSON.stringify([...cache]));
}

export async function ensureBlockedUsers(): Promise<Set<number>> {
  const user = await getUser();
  const id = Number(user?.user_id || 0);
  if (loaded && ownerId === id) return cache;
  ownerId = id;
  cache = new Set();
  if (id) {
    try {
      const raw = await AsyncStorage.getItem(`${KEY}.${id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        cache = new Set(parsed.map(Number).filter((value) => Number.isFinite(value) && value > 0));
      }
    } catch {
      cache = new Set();
    }
  }
  loaded = true;
  emit();
  return cache;
}

export async function markUserBlocked(userId: number): Promise<void> {
  await ensureBlockedUsers();
  const id = Number(userId);
  if (!id) return;
  cache.add(id);
  await persist();
  emit();
}

export async function markUserUnblocked(userId: number): Promise<void> {
  await ensureBlockedUsers();
  cache.delete(Number(userId));
  await persist();
  emit();
}

export function filterUnblocked<T>(rows: T[], idOf: (row: T) => number): T[] {
  return rows.filter((row) => {
    const id = Number(idOf(row) || 0);
    return !id || !cache.has(id);
  });
}
