import { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

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
