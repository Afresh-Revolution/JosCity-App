import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { playableVideoUrl, videoThumbnailUrl } from "../utils/media";
import type { StatusGroup, StatusStory } from "../utils/stories";

const INDEX_KEY = "joscity.storyMedia.v1";
const DIR_NAME = "story-media";

type Kind = "media" | "thumb";

type CacheEntry = {
  key: string;
  storyId: number;
  remoteUrl: string;
  fileName: string;
  expiresAt: number;
};

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
let index: CacheEntry[] | null = null;
let indexLoad: Promise<void> | null = null;

function entryKey(storyId: number, kind: Kind) {
  return `${storyId}:${kind}`;
}

function isRemote(url: string) {
  return /^https?:\/\//i.test(url);
}

function extensionFor(url: string, kind: Kind, type?: StatusStory["type"]) {
  if (kind === "thumb") return ".jpg";
  if (type === "video") return ".mp4";
  const match = url.split("?")[0]?.match(/\.(jpe?g|png|webp|gif)$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

function mediaDir() {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function fileFor(fileName: string) {
  return new File(Paths.document, DIR_NAME, fileName);
}

async function loadIndex() {
  if (index) return;
  if (indexLoad) {
    await indexLoad;
    return;
  }
  indexLoad = (async () => {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      const parsed = raw ? (JSON.parse(raw) as CacheEntry[]) : [];
      index = Array.isArray(parsed) ? parsed : [];
      const now = Date.now();
      for (const entry of index) {
        if (entry.expiresAt <= now) continue;
        const file = fileFor(entry.fileName);
        if (file.exists && file.size > 0) {
          memory.set(entry.key, file.uri);
        }
      }
    } catch {
      index = [];
    }
  })();
  await indexLoad;
}

async function saveIndex() {
  if (!index) return;
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function removeFileQuietly(fileName: string) {
  try {
    const file = fileFor(fileName);
    if (file.exists) file.delete();
  } catch {
    // Missing files are fine.
  }
}

export function peekCachedStoryUri(storyId: number, kind: Kind): string | null {
  if (!storyId) return null;
  return memory.get(entryKey(storyId, kind)) || null;
}

export function storyRemoteMediaUrl(story: StatusStory): string {
  if (story.type === "text") return "";
  if (story.type === "video") return playableVideoUrl(story.content);
  return story.content;
}

export function storyRemoteThumbUrl(story: StatusStory): string {
  if (story.type === "photo") return story.content;
  if (story.type === "video") return videoThumbnailUrl(story.content);
  return "";
}

export async function rememberStoryMedia(input: {
  storyId: number;
  remoteUrl: string;
  expiresAt: number;
  kind: Kind;
  type?: StatusStory["type"];
}): Promise<string> {
  const { storyId, remoteUrl, expiresAt, kind, type } = input;
  if (!remoteUrl) return remoteUrl;
  if (!isRemote(remoteUrl) || Platform.OS === "web" || storyId <= 0) return remoteUrl;

  const key = entryKey(storyId, kind);
  const cached = memory.get(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    await loadIndex();
    const known = index?.find((entry) => entry.key === key && entry.remoteUrl === remoteUrl);
    if (known) {
      const file = fileFor(known.fileName);
      if (file.exists && file.size > 0) {
        memory.set(key, file.uri);
        return file.uri;
      }
    }

    const fileName = `${storyId}-${kind}${extensionFor(remoteUrl, kind, type)}`;
    try {
      mediaDir();
      const dest = fileFor(fileName);
      if (!(dest.exists && dest.size > 0)) {
        await File.downloadFileAsync(remoteUrl, dest, { idempotent: true });
      }
      if (!dest.exists || dest.size <= 0) return remoteUrl;
      memory.set(key, dest.uri);
      index = [
        ...(index || []).filter((entry) => entry.key !== key),
        { key, storyId, remoteUrl, fileName, expiresAt },
      ];
      await saveIndex();
      return dest.uri;
    } catch {
      return remoteUrl;
    }
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

export async function resolveStoryPlaybackUri(story: StatusStory): Promise<string> {
  const remote = storyRemoteMediaUrl(story);
  if (!remote) return "";
  if (!isRemote(remote) || story.id <= 0 || story.uploading) return remote;
  await loadIndex();
  const cached = peekCachedStoryUri(story.id, "media");
  if (cached) return cached;
  void rememberStoryMedia({
    storyId: story.id,
    remoteUrl: remote,
    expiresAt: story.expiresAt,
    kind: "media",
    type: story.type,
  });
  return remote;
}

export async function forgetStoryMedia(storyId: number) {
  if (!storyId) return;
  await loadIndex();
  const keep: CacheEntry[] = [];
  for (const entry of index || []) {
    if (entry.storyId !== storyId) {
      keep.push(entry);
      continue;
    }
    memory.delete(entry.key);
    removeFileQuietly(entry.fileName);
  }
  index = keep;
  await saveIndex();
}

export async function syncStoryCache(groups: StatusGroup[]) {
  if (Platform.OS === "web") return;
  await loadIndex();
  const now = Date.now();
  const active = new Set<number>();
  const thumbs: StatusStory[] = [];
  for (const group of groups) {
    for (const story of group.stories) {
      if (!story.id || story.uploading || story.expiresAt <= now) continue;
      active.add(story.id);
      if (story.type === "photo" || story.type === "video") thumbs.push(story);
    }
  }

  const keep: CacheEntry[] = [];
  for (const entry of index || []) {
    if (entry.expiresAt <= now || !active.has(entry.storyId)) {
      memory.delete(entry.key);
      removeFileQuietly(entry.fileName);
      continue;
    }
    keep.push(entry);
  }
  index = keep;
  await saveIndex();

  await Promise.allSettled(
    thumbs.map((story) => {
      const remoteUrl = storyRemoteThumbUrl(story);
      if (!remoteUrl || !isRemote(remoteUrl)) return Promise.resolve(remoteUrl);
      return rememberStoryMedia({
        storyId: story.id,
        remoteUrl,
        expiresAt: story.expiresAt,
        kind: "thumb",
        type: story.type,
      });
    })
  );
}
