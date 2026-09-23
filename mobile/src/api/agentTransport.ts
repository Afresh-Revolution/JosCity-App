import { apiFetch, isFormDataBody, readJson, uploadForm } from "./client";
import { Platform } from "react-native";
import type { UploadImage } from "./agent";

function uploadMessage(payload: { error?: string | boolean; message?: string }, fallback: string) {
  const detail = typeof payload.error === "string" && payload.error !== "true" ? payload.error : payload.message;
  if (detail && /FormDataPart|Content-Range/i.test(detail)) {
    return "Could not attach those photos. Try choosing them again, or send without photos.";
  }
  return detail || fallback;
}

function isAbort(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: string }).name || "");
  return name === "AbortError" || name === "TimeoutError";
}

export async function appendAgentImage(data: FormData, field: string, image: UploadImage) {
  if (Platform.OS === "web") {
    if (typeof File !== "undefined" && image instanceof File) {
      data.append(field, image, image.name);
      return;
    }
    if ("uri" in image && image.uri) {
      const response = await fetch(image.uri);
      if (!response.ok) throw new Error("Unable to read selected photo");
      data.append(field, await response.blob(), image.name || "photo.jpg");
    }
    return;
  }
  if (!("uri" in image) || !image.uri) throw new Error("Choose a photo first");
  const name = image.name || "photo.jpg";
  const type = ("type" in image && image.type) || "image/jpeg";
  data.append(
    field,
    {
      uri: image.uri,
      name,
      type,
    } as unknown as Blob
  );
}

export async function agentRequest<T>(path: string, options: RequestInit & { auth?: boolean; timeoutMs?: number } = {}): Promise<T> {
  if (isFormDataBody(options.body)) {
    const { promise } = uploadForm(path, options.body as FormData, {
      timeoutMs: options.timeoutMs || 60000,
      method: options.method || "POST",
    });
    const result = await promise;
    const payload = result.data as { success?: boolean; data?: T; error?: string; message?: string };
    if (result.aborted) throw new Error("That upload took too long. Try again.");
    if (!result.ok || payload.success !== true) {
      throw new Error(uploadMessage(payload, result.ok ? "Request failed" : "Could not send those photos. Try again."));
    }
    return payload.data as T;
  }

  try {
    const response = await apiFetch(path, {
      ...options,
      timeoutMs: options.timeoutMs || 15000,
    });
    const payload = await readJson<{ success?: boolean; data?: T; error?: string | boolean; message?: string }>(response);
    if (!response.ok || payload.success !== true) {
      if (response.status === 504 || response.status === 503) {
        throw new Error(uploadMessage(payload, "That search took too long. Try again."));
      }
      throw new Error(uploadMessage(payload, `Request failed (${response.status})`));
    }
    return payload.data as T;
  } catch (error) {
    if (isAbort(error)) throw new Error("That search took too long. Try again.");
    throw error;
  }
}
