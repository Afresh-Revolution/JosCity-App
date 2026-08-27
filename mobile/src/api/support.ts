import { apiFetch, readJson } from "./client";
import { friendlyError } from "../utils/errors";

export type SupportContact = {
  id: number;
  kind: "email" | "phone";
  label: string;
  value: string;
};

export type SupportFaq = {
  id: number;
  question: string;
  answer: string;
};

export type SupportCategory = {
  id: number;
  label: string;
};

export type SupportContent = {
  kicker: string;
  title: string;
  chat_hours: string;
  chat_url: string;
  member_guide: {
    title: string;
    url: string;
    body: string;
  };
  emails: SupportContact[];
  phones: SupportContact[];
  faqs: SupportFaq[];
  categories: SupportCategory[];
};

type Envelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

async function readSupport<T>(
  path: string,
  init: RequestInit & { auth?: boolean; timeoutMs?: number } = {}
): Promise<{ success: boolean; message?: string; data?: T }> {
  try {
    const response = await apiFetch(path, { timeoutMs: 20000, ...init });
    const payload = await readJson<Envelope<T>>(response);
    if (!response.ok) {
      return {
        success: false,
        message: friendlyError(payload.message || "Request failed"),
      };
    }
    return { success: true, message: payload.message, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

export const getSupportContent = () => readSupport<SupportContent>("/support");

export const sendAppFeedback = (rating: number, comment: string) =>
  readSupport("/support/feedback", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ rating, comment }),
  });

export const sendProblemReport = (category: string, message: string) =>
  readSupport("/support/problems", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ category, message }),
  });
