import { apiFetch, readJson } from "./client";

export type AppLanguage = {
  id: string;
  label: string;
};

type Envelope = {
  success?: boolean;
  data?: {
    languages?: AppLanguage[];
    strings?: Record<string, Record<string, string>>;
  };
};

export async function getAppLanguages(): Promise<{
  languages: AppLanguage[];
  strings: Record<string, Record<string, string>>;
}> {
  try {
    const response = await apiFetch("/app-languages", { timeoutMs: 12000 });
    const payload = await readJson<Envelope>(response);
    if (!response.ok || !payload.data) {
      return { languages: [], strings: {} };
    }
    return {
      languages: Array.isArray(payload.data.languages) ? payload.data.languages : [],
      strings: payload.data.strings && typeof payload.data.strings === "object" ? payload.data.strings : {},
    };
  } catch {
    return { languages: [], strings: {} };
  }
}
