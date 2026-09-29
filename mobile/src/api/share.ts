import { apiFetch, readJson } from "./client";

export type ShareKind = "post" | "listing" | "profile" | "business";

export type ShareLink = {
  url: string;
  handle: string;
  kind: ShareKind;
  code: string;
};

export async function createShareLink(kind: ShareKind, id: number | string): Promise<ShareLink | null> {
  try {
    const response = await apiFetch("/share", {
      method: "POST",
      body: JSON.stringify({ kind, id: Number(id) }),
      skipUnauthorized: true,
    });
    const data = await readJson<{
      success?: boolean;
      url?: string;
      handle?: string;
      kind?: ShareKind;
      code?: string;
    }>(response);
    if (!data?.success || !data.url) return null;
    return {
      url: data.url,
      handle: data.handle || "",
      kind: data.kind || kind,
      code: data.code || "",
    };
  } catch {
    return null;
  }
}

export async function resolveShareLink(kind: string, code: string): Promise<{ appPath: string; title: string } | null> {
  try {
    const response = await apiFetch(`/share/${encodeURIComponent(kind)}/${encodeURIComponent(code)}`, {
      skipUnauthorized: true,
    });
    const data = await readJson<{ success?: boolean; appPath?: string; title?: string }>(response);
    if (!data?.success || !data.appPath) return null;
    return { appPath: data.appPath, title: data.title || "JosCity" };
  } catch {
    return null;
  }
}
