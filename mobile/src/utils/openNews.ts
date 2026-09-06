import { useRouter } from "expo-router";
import type { NewsItem } from "../api/explore";
import { cacheOpenNews } from "../state/openNews";

type Router = ReturnType<typeof useRouter>;

export function openNewsArticle(router: Pick<Router, "push">, item: NewsItem): void {
  const id = Number(item.id || 0);
  if (!id) return;
  cacheOpenNews(item);
  router.push({ pathname: "/news/[id]", params: { id: String(id) } });
}
