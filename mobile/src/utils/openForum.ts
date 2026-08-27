import type { Router } from "expo-router";
import type { ForumThread } from "../api/forum";
import { cacheOpenThread } from "../state/openThread";

export function openForumThread(
  router: Pick<Router, "push" | "replace">,
  thread: ForumThread,
  mode: "push" | "replace" = "push"
): void {
  const id = Number(thread.id || 0);
  if (!id) return;
  cacheOpenThread(thread);
  router[mode]({ pathname: "/forums/thread/[id]", params: { id: String(id) } });
}

export function openForumCategory(router: Pick<Router, "push">, slug: string): void {
  if (!slug) return;
  router.push({ pathname: "/forums/category/[slug]", params: { slug } });
}

export function openForumCreate(router: Pick<Router, "push">, slug?: string): void {
  router.push({
    pathname: "/forums/new",
    params: slug ? { category: slug } : {},
  });
}
