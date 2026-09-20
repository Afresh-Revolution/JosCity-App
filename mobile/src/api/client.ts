import { env } from "../config/env";
import { getAuthToken } from "../storage/session";

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${env.apiBaseUrl}${suffix}`;
}

type FetchOptions = RequestInit & {
  timeoutMs?: number;
  auth?: boolean;
  token?: string;
  skipUnauthorized?: boolean;
};

let unauthorizedHandler: (() => void | Promise<void>) | null = null;
let unauthorizedBusy = false;
let networkOnline = true;
const networkListeners = new Set<(online: boolean) => void>();

function setNetworkOnline(online: boolean) {
  if (networkOnline === online) return;
  networkOnline = online;
  for (const listener of networkListeners) listener(online);
}

export function getNetworkOnline(): boolean {
  return networkOnline;
}

export function subscribeNetworkOnline(
  listener: (online: boolean) => void
): () => void {
  networkListeners.add(listener);
  listener(networkOnline);
  return () => networkListeners.delete(listener);
}

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

export function isFormDataBody(body: unknown): boolean {
  if (body == null || typeof body !== "object") return false;
  if (typeof FormData !== "undefined") {
    try {
      if (body instanceof FormData) return true;
    } catch {
      /* React Native can expose a different FormData than fetch */
    }
  }
  return typeof (body as { append?: unknown }).append === "function";
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: string }).name || "");
  const message = String((error as { message?: string }).message || "");
  return name === "AbortError" || /timeout|timed out|aborted/i.test(message);
}

async function handleUnauthorized() {
  if (!unauthorizedHandler || unauthorizedBusy) return;
  unauthorizedBusy = true;
  try {
    await unauthorizedHandler();
  } finally {
    setTimeout(() => {
      unauthorizedBusy = false;
    }, 1500);
  }
}

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const {
    timeoutMs = 15000,
    auth = false,
    token: explicitToken,
    skipUnauthorized = false,
    ...init
  } = options;
  const isFormData = isFormDataBody(init.body);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const resolvedToken = auth ? explicitToken || (await getAuthToken()) : undefined;
  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      signal: controller.signal,
      headers,
    });
    setNetworkOnline(true);
    if (auth && response.status === 401 && !skipUnauthorized) {
      void handleUnauthorized();
    }
    return response;
  } catch (error) {
    if (!isAbortError(error)) setNetworkOnline(false);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingApi(): Promise<boolean> {
  try {
    const response = await apiFetch("/ping", { method: "GET", timeoutMs: 4000 });
    return response.ok;
  } catch {
    return false;
  }
}

export async function cachedPublicFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, init);
    setNetworkOnline(true);
    return response;
  } catch (error) {
    setNetworkOnline(false);
    throw error;
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export type UploadFormResult = {
  ok: boolean;
  aborted?: boolean;
  data: { success?: boolean; error?: string; message?: string };
};

export function uploadForm(
  path: string,
  form: FormData,
  options: { timeoutMs?: number; method?: string; onProgress?: (progress: number) => void } = {}
): { promise: Promise<UploadFormResult>; abort: () => void } {
  let xhr: XMLHttpRequest | null = null;
  let aborted = false;
  const abort = () => {
    aborted = true;
    xhr?.abort();
  };

  const promise = new Promise<UploadFormResult>((resolve, reject) => {
    void (async () => {
      xhr = new XMLHttpRequest();
      if (aborted) {
        xhr.abort();
        resolve({ ok: false, aborted: true, data: {} });
        return;
      }

      const token = await getAuthToken();
      if (aborted) {
        xhr.abort();
        resolve({ ok: false, aborted: true, data: {} });
        return;
      }

      let last = 0.04;
      options.onProgress?.(last);
      const pulse = setInterval(() => {
        last = Math.min(0.88, last + 0.03);
        options.onProgress?.(last);
      }, 450);

      const finish = (result: UploadFormResult) => {
        clearInterval(pulse);
        resolve(result);
      };

      xhr.open(options.method || "POST", apiUrl(path));
      xhr.timeout = options.timeoutMs || 60000;
      xhr.setRequestHeader("Accept", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        last = Math.max(last, Math.min(0.92, event.loaded / event.total));
        options.onProgress?.(last);
      };
      xhr.onload = () => {
        setNetworkOnline(true);
        options.onProgress?.(1);
        if (xhr?.status === 401) {
          void handleUnauthorized();
        }
        let data: UploadFormResult["data"] = {};
        try {
          data = JSON.parse(xhr?.responseText || "{}") as typeof data;
        } catch {
          data = {};
        }
        finish({
          ok: Boolean(xhr && xhr.status >= 200 && xhr.status < 300),
          data,
        });
      };
      xhr.onabort = () => finish({ ok: false, aborted: true, data: {} });
      xhr.onerror = () => {
        if (aborted) {
          finish({ ok: false, aborted: true, data: {} });
          return;
        }
        finish({ ok: false, data: { message: "upload" } });
      };
      xhr.ontimeout = () => {
        finish({ ok: false, data: { message: "timeout" } });
      };
      try {
        xhr.send(form);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        finish({
          ok: false,
          data: {
            message: /FormDataPart/i.test(message)
              ? "Could not attach those photos. Try choosing them again."
              : "upload",
          },
        });
      }
    })().catch(reject);
  });

  return { promise, abort };
}
