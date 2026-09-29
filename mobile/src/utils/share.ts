import { Share } from "react-native";
import { createShareLink, type ShareKind } from "../api/share";
import { postShareUrl } from "./format";
import { newsShareUrl } from "./news";

function singleMessage(caption: string | undefined, url: string): string {
  const clean = String(caption || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return clean ? `${clean}\n\n${url}` : url;
}

async function shareOnce(title: string, caption: string | undefined, url: string): Promise<boolean> {
  try {
    const result = await Share.share({
      message: singleMessage(caption, url),
      title,
    });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

export async function shareEntity(
  kind: ShareKind,
  id: number | string,
  caption?: string,
  fallbackUrl?: string
): Promise<boolean> {
  const created = await createShareLink(kind, id);
  const url = created?.url || fallbackUrl;
  if (!url) return false;
  return shareOnce("JOSCITY", caption, url);
}

export async function sharePostWithLink(postId: number, caption?: string): Promise<boolean> {
  return shareEntity("post", postId, caption, postShareUrl(postId));
}

export async function shareNewsArticle(id: number, title?: string, snippet?: string): Promise<boolean> {
  const url = newsShareUrl(id);
  const heading = String(title || "JOSCITY News").trim();
  const body = String(snippet || "").trim();
  return shareOnce(heading, body ? `${heading}\n\n${body}` : heading, url);
}
