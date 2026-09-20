import { apiFetch, readJson, uploadForm } from "./client";
import { friendlyError } from "../utils/errors";
import type { WalletCheckout, WalletFundingOptions } from "./account";

export type CacEditPending = {
  id: string;
  amount: number;
  method?: string | null;
  status: "awaiting_payment" | "pending_review" | string;
  proof_url?: string | null;
  reference?: string | null;
};

export type CacEditState = {
  can_edit: boolean;
  has_cac: boolean;
  free_used: boolean;
  credits: number;
  next_price: number;
  paid_purchases: number;
  pending_request: CacEditPending | null;
  funding?: WalletFundingOptions;
};

async function readCac<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  try {
    const response = await apiFetch(path, { auth: true, timeoutMs: 20000, ...init });
    const payload = await readJson<{ success?: boolean; message?: string; data?: T }>(response);
    if (!response.ok) {
      return {
        success: false as const,
        message: friendlyError(payload.message || "Request failed"),
        data: payload.data,
      };
    }
    return { success: true as const, message: payload.message, data: payload.data };
  } catch {
    return { success: false as const, message: friendlyError("offline") };
  }
}

export const getCacEditState = () => readCac<CacEditState>("/users/cac-edit");

export const startCacEditPaystack = (callback_url?: string) =>
  readCac<WalletCheckout>("/users/cac-edit/paystack", {
    method: "POST",
    body: JSON.stringify({ callback_url }),
  });

export const verifyCacEditPaystack = (reference: string) =>
  readCac("/users/cac-edit/paystack/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });

export const startCacEditSafehaven = (callback_url?: string) =>
  readCac<WalletCheckout>("/users/cac-edit/safehaven", {
    method: "POST",
    body: JSON.stringify({ callback_url }),
  });

export const verifyCacEditSafehaven = (reference: string) =>
  readCac("/users/cac-edit/safehaven/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });

export async function submitCacEditManual(proof: { uri: string; name?: string; type?: string }) {
  const uri = proof.uri;
  const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const form = new FormData();
  form.append("proof", {
    uri,
    name: proof.name || `transfer.${ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg"}`,
    type: proof.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"),
  } as unknown as Blob);
  try {
    const { promise } = uploadForm("/users/cac-edit/manual", form, { timeoutMs: 60000 });
    const result = await promise;
    const payload = result.data as { success?: boolean; message?: string; error?: string; data?: CacEditState };
    if (result.aborted) {
      return { success: false, message: friendlyError("timeout") };
    }
    if (!result.ok || payload.success === false) {
      return { success: false, message: friendlyError(payload.message || payload.error || "upload") };
    }
    return { success: true, message: payload.message, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("upload") };
  }
}
