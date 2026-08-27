import type { Router } from "expo-router";

export function openListing(
  router: Pick<Router, "push">,
  listingId: string | number | null | undefined,
  source?: string
): void {
  const id = String(listingId || "").trim();
  if (!id || id === "0") return;
  router.push({
    pathname: "/listing/[id]",
    params: {
      id,
      ...(source ? { source } : {}),
    },
  });
}
