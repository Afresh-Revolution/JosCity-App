import { apiFetch, readJson } from './client';
import { Platform } from 'react-native';
import type { UploadImage } from './agent';
export async function appendAgentImage(data: FormData, field: string, image: UploadImage) {
  if (Platform.OS === 'web' && 'uri' in image) {
    const response = await fetch(image.uri);
    if (!response.ok) throw new Error('Unable to read selected photo');
    data.append(field, await response.blob(), image.name);
  } else data.append(field, image as Blob);
}
export async function agentRequest<T>(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const response = await apiFetch(path, { ...options, timeoutMs: options.body instanceof FormData ? 60000 : 15000 });
  const payload = await readJson<{ success?: boolean; data?: T; error?: string; message?: string }>(response);
  if (!response.ok || payload.success !== true) throw new Error(typeof payload.error === 'string' ? payload.error : payload.message || `Request failed (${response.status})`);
  return payload.data as T;
}
