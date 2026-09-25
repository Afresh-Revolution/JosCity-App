import { Platform, Share } from "react-native";
import { postShareUrl } from "./format";
import { newsShareUrl } from "./news";

export async function sharePostWithLink(postId: number, caption?: string): Promise<boolean> {
  const url = postShareUrl(postId);
  const message = caption?.trim() ? `${caption.trim()}\n\n${url}` : url;

  try {
    const result = await Share.share(
      Platform.OS === "ios"
        ? { url, message, title: "JOSCITY" }
        : { message, title: "JOSCITY" }
    );
    if (result.action !== Share.sharedAction) return false;
    return true;
  } catch {
    return false;
  }
}

export async function shareNewsArticle(id: number, title?: string, snippet?: string): Promise<boolean> {
  const url = newsShareUrl(id);
  const heading = String(title || "JOSCITY News").trim();
  const body = String(snippet || "").trim();
  const message = body ? `${heading}\n\n${body}\n\n${url}` : `${heading}\n\n${url}`;

  try {
    const result = await Share.share(
      Platform.OS === "ios"
        ? { url, message, title: heading }
        : { message, title: heading }
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
