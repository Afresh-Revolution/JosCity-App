import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@joscity:api-response:v1:";
const INDEX_KEY = `${CACHE_PREFIX}index`;
const MAX_ENTRIES = 80;
const MAX_BODY_LENGTH = 750_000;

type CachedApiResponse = {
  body: string;
  status: number;
  contentType: string;
  savedAt: number;
};

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function apiResponseCacheKey(path: string, authScope: string): string {
  return `${CACHE_PREFIX}${hash(`${authScope}:${path}`)}`;
}

async function updateIndex(key: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(INDEX_KEY);
    const current = stored ? (JSON.parse(stored) as string[]) : [];
    const next = [key, ...current.filter((item) => item !== key)];
    const expired = next.slice(MAX_ENTRIES);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)));
    if (expired.length) await AsyncStorage.multiRemove(expired);
  } catch {
    // Caching is best-effort and must never block normal API behavior.
  }
}

export async function storeApiResponse(
  key: string,
  response: Response
): Promise<void> {
  try {
    const body = await response.text();
    if (!body || body.length > MAX_BODY_LENGTH) return;
    const record: CachedApiResponse = {
      body,
      status: response.status,
      contentType: response.headers.get("content-type") || "application/json",
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(record));
    await updateIndex(key);
  } catch {
    // Caching is best-effort.
  }
}

export async function readApiResponse(key: string): Promise<Response | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    const record = JSON.parse(stored) as CachedApiResponse;
    if (!record.body || !Number.isFinite(record.savedAt)) return null;
    void updateIndex(key);
    return new Response(record.body, {
      status: record.status || 200,
      headers: {
        "content-type": record.contentType || "application/json",
        "x-joscity-cache": "stale",
        "x-joscity-cache-date": new Date(record.savedAt).toISOString(),
      },
    });
  } catch {
    return null;
  }
}
