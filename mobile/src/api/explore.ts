import { apiFetch, cachedPublicFetch, readJson } from "./client";
import { getFeed } from "./feed";
import { friendlyError } from "../utils/errors";

export type TrendingHashtag = {
  id?: number;
  name?: string;
  hashtag?: string;
  label?: string;
  posts_count?: number;
  count?: number;
};

export type NewsItem = {
  id: number;
  title?: string;
  content?: string;
  image_urls?: unknown;
  video_urls?: unknown;
  source_links?: unknown;
  is_featured?: boolean;
  created_at?: string;
};

export type ExploreEvent = {
  id?: number;
  event_id?: number;
  event_id_string?: string | null;
  title?: string;
  event_title?: string;
  description?: string;
  event_description?: string;
  location?: string;
  event_location?: string;
  date?: string;
  event_date?: string;
  image?: string | null;
  event_cover?: string | null;
  tickets_sold?: number;
  event_tickets_sold?: number;
  capacity?: number | null;
  event_capacity?: number | null;
  source?: string | null;
  ticket_url?: string | null;
  organizer_type?: "admin" | "business" | string | null;
  event_admin?: number | null;
  event_price_naira?: number;
  payment_contact_email?: string | null;
  payment_bank_name?: string | null;
  payment_account_name?: string | null;
  payment_account_number?: string | null;
};

export type ExploreGroup = {
  id?: number;
  group_id?: number;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
};

export type EventPaymentRequest = {
  request_id: number;
  status: string;
  ticket_number?: string | null;
  created_at?: string;
  resolved_at?: string | null;
};

async function readList<T>(path: string, auth = true, timeoutMs = 20000): Promise<T[]> {
  try {
    const response = await apiFetch(path, { method: "GET", auth, timeoutMs });
    const data = await readJson<{ data?: T[] }>(response);
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

function normalizeHashtag(value: unknown): TrendingHashtag | null {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const name = String(record.hashtag || record.label || record.name || "")
    .replace(/^#+/, "")
    .trim();
  if (!name || name === "#") return null;
  const count = Number(record.posts_count || record.posts || record.count || 0);
  return {
    id: Number(record.id || 0) || undefined,
    name,
    hashtag: `#${name}`,
    label: `#${name}`,
    posts_count: Number.isFinite(count) ? count : 0,
    count: Number.isFinite(count) ? count : 0,
  };
}

async function readHashtags(path: string): Promise<TrendingHashtag[]> {
  try {
    const response = await apiFetch(path, { method: "GET", auth: true, timeoutMs: 20000 });
    const payload = await readJson<{ data?: unknown; hashtags?: unknown }>(response);
    const raw = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.hashtags)
        ? payload.hashtags
        : [];
    return raw.map(normalizeHashtag).filter((row): row is TrendingHashtag => row !== null);
  } catch {
    return [];
  }
}

function hashtagsFromPosts(posts: Array<{ text?: string | null; caption?: string | null }>, limit: number) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const text = `${post.text || ""} ${post.caption || ""}`;
    const matches = text.match(/#[A-Za-z0-9_]{1,50}/g) || [];
    const unique = new Set(matches.map((tag) => tag.slice(1).toLowerCase()));
    for (const name of unique) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count], index) => ({
      id: index + 1,
      name,
      hashtag: `#${name}`,
      label: `#${name}`,
      posts_count: count,
      count,
    }));
}

export async function getTrendingHashtags(limit = 5): Promise<TrendingHashtag[]> {
  const query = `limit=${limit}&days=365`;
  const primary = await readHashtags(`/feed/trending-hashtags?${query}`);
  if (primary.length) return primary.slice(0, limit);
  const fallback = await readHashtags(`/users/trending-hashtags?${query}`);
  if (fallback.length) return fallback.slice(0, limit);
  try {
    const page = await getFeed(1, 40);
    return hashtagsFromPosts(page.data, limit);
  } catch {
    return [];
  }
}

const GATEWAV_FEED_URL =
  "https://ticketing-back.onrender.com/api/events/feed/joscity";
const GATEWAV_SITE = "https://gatewav.com";

function asEventList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.events)) return record.events;
  }
  return [];
}

function gatewavUuid(event: {
  event_id_string?: string | null;
  ticket_url?: string | null;
  id?: number | string | null;
}): string {
  const fromField = String(event.event_id_string || "").trim();
  if (fromField && !/^\d+$/.test(fromField)) return fromField;
  const fromUrl = String(event.ticket_url || "").match(/\/event\/([0-9a-f-]{8,})/i);
  if (fromUrl?.[1]) return fromUrl[1];
  if (typeof event.id === "string" && event.id.trim() && !/^\d+$/.test(event.id.trim())) {
    return event.id.trim();
  }
  return fromField;
}

function eventCalendarDay(event: ExploreEvent): string {
  const raw = event.date || event.event_date;
  if (!raw) return "";
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return String(raw).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

function eventTitleKey(event: ExploreEvent): string {
  return eventTitle(event)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isJosCityEvent(event: ExploreEvent): boolean {
  const source = String(event.source || "").toLowerCase();
  if (source === "gatewav" || source === "ticketing") return false;
  return eventId(event) > 0 && !gatewavUuid(event);
}

function eventDedupeKeys(event: ExploreEvent): string[] {
  const keys: string[] = [];
  const uuid = gatewavUuid(event);
  if (uuid) keys.push(`gw:${uuid.toLowerCase()}`);
  const id = eventId(event);
  if (id > 0 && isJosCityEvent(event)) keys.push(`jc:${id}`);
  const title = eventTitleKey(event);
  const day = eventCalendarDay(event);
  if (title && day) keys.push(`t:${title}|${day}`);
  else if (title) keys.push(`t:${title}`);
  return keys;
}

export function eventListKey(event: ExploreEvent, index = 0): string {
  return eventDedupeKeys(event)[0] || `i:${index}`;
}

function preferEvent(current: ExploreEvent, incoming: ExploreEvent): ExploreEvent {
  const currentJos = isJosCityEvent(current);
  const incomingJos = isJosCityEvent(incoming);
  if (currentJos !== incomingJos) return currentJos ? current : incoming;
  const base = gatewavUuid(incoming) && !gatewavUuid(current) ? incoming : current;
  const other = base === current ? incoming : current;
  return {
    ...other,
    ...base,
    ticket_url: base.ticket_url || other.ticket_url || null,
    event_id_string: gatewavUuid(base) || gatewavUuid(other) || null,
    image: base.image || base.event_cover || other.image || other.event_cover || null,
    event_cover: base.event_cover || base.image || other.event_cover || other.image || null,
  };
}

export function uniqueExploreEvents(events: ExploreEvent[]): ExploreEvent[] {
  return mergeExploreEvents([events]);
}

function mergeExploreEvents(groups: ExploreEvent[][]): ExploreEvent[] {
  const byKey = new Map<string, ExploreEvent>();

  for (const group of groups) {
    for (const event of group) {
      const keys = eventDedupeKeys(event);
      if (!keys.length) continue;
      const hits = new Set<ExploreEvent>();
      for (const key of keys) {
        const found = byKey.get(key);
        if (found) hits.add(found);
      }
      let merged = event;
      const allKeys = new Set(keys);
      for (const hit of hits) {
        merged = preferEvent(hit, merged);
        for (const key of eventDedupeKeys(hit)) allKeys.add(key);
      }
      for (const key of eventDedupeKeys(merged)) allKeys.add(key);
      for (const key of allKeys) byKey.set(key, merged);
    }
  }

  return [...new Set(byKey.values())].sort((a, b) => {
    const aTime = new Date(a.date || a.event_date || 0).getTime();
    const bTime = new Date(b.date || b.event_date || 0).getTime();
    const aSafe = Number.isFinite(aTime) ? aTime : Number.MAX_SAFE_INTEGER;
    const bSafe = Number.isFinite(bTime) ? bTime : Number.MAX_SAFE_INTEGER;
    return aSafe - bSafe;
  });
}

function mapGatewavEvent(raw: unknown, index: number): ExploreEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = String(row.event_title || row.title || "").trim();
  const when = String(row.event_date || row.date || "").trim();
  const uuid = gatewavUuid({
    event_id_string: (row.event_id_string as string) || null,
    ticket_url: (row.ticket_url as string) || null,
    id: row.id as string | number | null,
  });
  const parsedId = Number(row.event_id);
  const id = Number.isFinite(parsedId) && parsedId !== 0 ? parsedId : -(index + 1);
  const cover = (row.event_cover || row.image || null) as string | null;
  return {
    id,
    event_id: id,
    event_id_string: uuid || null,
    title: title || "Event",
    event_title: title || "Event",
    description: String(row.event_description || row.description || ""),
    event_description: String(row.event_description || row.description || ""),
    date: when || undefined,
    event_date: when || undefined,
    location: String(row.event_location || row.location || "Jos"),
    event_location: String(row.event_location || row.location || "Jos"),
    image: cover,
    event_cover: cover,
    capacity: row.event_capacity != null ? Number(row.event_capacity) : null,
    event_capacity: row.event_capacity != null ? Number(row.event_capacity) : null,
    tickets_sold: Number(row.tickets_sold || 0),
    source: String(row.source || "gatewav"),
    ticket_url: uuid ? `${GATEWAV_SITE}/event/${uuid}` : null,
  };
}

async function getGatewavEvents(timeoutMs = 12000): Promise<ExploreEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await cachedPublicFetch(GATEWAV_FEED_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return asEventList(await response.json())
      .map(mapGatewavEvent)
      .filter((row): row is ExploreEvent => row !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function getPublishedNews(limit = 6): Promise<NewsItem[]> {
  return readList<NewsItem>(`/news?limit=${limit}`, false);
}

export async function getNews(id: number): Promise<NewsItem | null> {
  if (!id) return null;
  try {
    const response = await apiFetch(`/news/${id}`, { method: "GET", auth: false, timeoutMs: 15000 });
    const payload = await readJson<{ data?: NewsItem }>(response);
    return payload.data || null;
  } catch {
    return null;
  }
}

export type ExploreReel = {
  id?: number;
  post_id?: number;
  title?: string;
  text?: string;
  caption?: string;
  category?: string;
  thumbnail_url?: string | null;
  thumbnailUrl?: string | null;
  video_url?: string | null;
  author?: { name?: string };
};

export async function getExploreReels(limit = 40): Promise<ExploreReel[]> {
  try {
    const response = await apiFetch(`/reels?page=1&limit=${limit}`, {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const payload = await readJson<{ data?: ExploreReel[] }>(response);
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

let cachedExploreEvents: ExploreEvent[] = [];

export function getCachedExploreEvents(): ExploreEvent[] {
  return cachedExploreEvents;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getExploreEvents(
  limit = 6,
  onUpdate?: (events: ExploreEvent[]) => void
): Promise<ExploreEvent[]> {
  const groups: ExploreEvent[][] = cachedExploreEvents.length
    ? [cachedExploreEvents]
    : [];

  const publish = () => {
    const merged = mergeExploreEvents(groups).filter(isUpcomingEvent);
    if (merged.length) cachedExploreEvents = merged;
    const slice = (merged.length ? merged : cachedExploreEvents).slice(0, limit);
    onUpdate?.(slice);
    return slice;
  };

  if (cachedExploreEvents.length) publish();

  const collect = async (rows: ExploreEvent[]) => {
    if (!rows.length) return;
    groups.push(rows);
    publish();
  };

  const fromJosCity = Promise.all([
    readList<ExploreEvent>(`/events/public/landing?limit=${Math.min(Math.max(limit * 4, 24), 80)}`, false, 8000),
    readList<ExploreEvent>(`/events?page=1&limit=${Math.min(Math.max(limit * 4, 24), 80)}&upcoming=1`, false, 8000),
  ]).then(async ([landing, upcoming]) => {
    await collect(landing);
    await collect(upcoming);
  });

  const fromGatewav = (async () => {
    const first = await getGatewavEvents(10000);
    await collect(first);
    if (first.length) return;
    for (const [delay, timeout] of [
      [1500, 20000],
      [4000, 35000],
    ] as const) {
      await sleep(delay);
      const next = await getGatewavEvents(timeout);
      await collect(next);
      if (next.length) return;
    }
  })();

  await Promise.all([fromJosCity, fromGatewav]);
  return publish();
}

export async function getExploreGroups(limit = 8): Promise<ExploreGroup[]> {
  const discover = await readList<ExploreGroup>(
    `/groups?page=1&limit=${limit}&type=discover`
  );
  if (discover.length) return discover;
  return readList<ExploreGroup>(`/groups?page=1&limit=${limit}&type=joined`);
}

export async function getEvent(id: number): Promise<ExploreEvent | null> {
  try {
    const response = await apiFetch(`/events/${id}`, { method: "GET", auth: false, timeoutMs: 15000 });
    const payload = await readJson<{ data?: ExploreEvent }>(response);
    return payload.data || null;
  } catch {
    return null;
  }
}

export async function getMyEventPaymentRequest(eventId: number): Promise<EventPaymentRequest | null> {
  try {
    const response = await apiFetch(`/events/${eventId}/my-payment-request`, {
      method: "GET",
      auth: true,
      timeoutMs: 15000,
    });
    const payload = await readJson<{ data?: EventPaymentRequest | null }>(response);
    return payload.data || null;
  } catch {
    return null;
  }
}

export async function submitEventPaymentRequest(
  eventId: number,
  attendeeAccountName: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiFetch(`/events/${eventId}/payment-requests`, {
      method: "POST",
      auth: true,
      timeoutMs: 20000,
      body: JSON.stringify({ attendee_account_name: attendeeAccountName }),
    });
    const payload = await readJson<{ success?: boolean; error?: string; message?: string }>(response);
    if (!response.ok) {
      return { success: false, message: payload.error || payload.message || "Could not submit payment." };
    }
    return { success: true, message: payload.message };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export function eventId(event: ExploreEvent): number {
  return Number(event.event_id || event.id || 0);
}

export function eventTitle(event: ExploreEvent): string {
  return event.title || event.event_title || "Event";
}

export function eventLocation(event: ExploreEvent): string {
  return event.location || event.event_location || "Jos";
}

export function eventDescription(event: ExploreEvent): string {
  return String(event.description || event.event_description || "").trim();
}

export function isGatewavEvent(event: ExploreEvent): boolean {
  const source = String(event.source || "").toLowerCase();
  return (
    source === "gatewav" ||
    source === "ticketing" ||
    Boolean(event.ticket_url) ||
    Boolean(event.event_id_string) ||
    eventId(event) < 0
  );
}

export function gatewavUrl(event: ExploreEvent): string {
  const url = String(event.ticket_url || "").trim();
  if (url) return url;
  const uuid = String(event.event_id_string || "").trim();
  if (uuid) return `${GATEWAV_SITE}/event/${uuid}`;
  return GATEWAV_SITE;
}

export function isPaidJosCityEvent(event: ExploreEvent): boolean {
  return !isGatewavEvent(event) && Number(event.event_price_naira || 0) > 0;
}

export function isUpcomingEvent(event: ExploreEvent): boolean {
  const raw = event.date || event.event_date;
  if (!raw) return true;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return true;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return day >= today;
}
