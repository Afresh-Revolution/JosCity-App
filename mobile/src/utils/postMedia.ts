import type { FeedPost } from "../api/feed";
import { absoluteUrl } from "./format";
import { isVideoUrl } from "./media";

export type PostMediaItem = {
  url: string;
  kind: "image" | "video";
};

export function collectPostMedia(post?: FeedPost | null): PostMediaItem[] {
  if (!post) return [];
  const seen = new Set<string>();
  const items: PostMediaItem[] = [];

  const add = (raw?: string | null, type?: string | null, forceVideo = false) => {
    const url = absoluteUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      kind: forceVideo || isVideoUrl(url, type) ? "video" : "image",
    });
  };

  if (post.media?.length) {
    for (const item of post.media) add(item.url, item.type);
  } else if (post.media_urls?.length) {
    post.media_urls.forEach((url, index) => add(url, post.media_types?.[index]));
  }

  if (!items.length && String(post.post_type || "").toLowerCase() === "reel") {
    add(post.media?.[0]?.url || post.media_urls?.[0], "video", true);
  }

  return items;
}

export function splitPostMedia(post?: FeedPost | null) {
  const items = collectPostMedia(post);
  return {
    images: items.filter((item) => item.kind === "image").map((item) => item.url),
    videos: items.filter((item) => item.kind === "video").map((item) => item.url),
  };
}
