import { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

function isBusinessType(accountType?: string | null): boolean {
  return String(accountType || "").toLowerCase() === "business";
}

export function openMemberProfile(
  router: Pick<Router, "push" | "replace">,
  userId: number | string | null | undefined,
  accountType?: string | null,
  mode: "push" | "replace" = "push",
  preview?: { name?: string; picture?: string | null; source?: string }
): void {
  const id = Number(userId || 0);
  if (!Number.isFinite(id) || id <= 0) return;
  const params = {
    id: String(id),
    ...(preview?.name ? { name: preview.name } : {}),
    ...(preview?.picture ? { picture: String(preview.picture) } : {}),
    ...(preview?.source ? { source: preview.source } : {}),
  };
  if (isBusinessType(accountType)) {
    router[mode]({
      pathname: "/business/[id]",
      params: {
        id: String(id),
        ...(preview?.name ? { name: preview.name } : {}),
        ...(preview?.picture ? { picture: String(preview.picture) } : {}),
        ...(preview?.source ? { source: preview.source } : {}),
      },
    });
    return;
  }
  router[mode]({ pathname: "/people/[id]", params } as never);
}
