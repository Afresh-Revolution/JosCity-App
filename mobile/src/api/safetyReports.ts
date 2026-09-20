import { apiFetch, readJson } from "./client";

export const REPORT_REASONS = [
  { id: "child_safety", label: "Child safety or sexual exploitation" },
  { id: "nudity", label: "Nudity or sexual content" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "violence", label: "Violence or dangerous content" },
  { id: "hate", label: "Hate speech" },
  { id: "scam", label: "Scam or fraud" },
  { id: "spam", label: "Spam" },
  { id: "impersonation", label: "Impersonation" },
  { id: "illegal", label: "Illegal goods or activity" },
  { id: "other", label: "Other" },
] as const;

export type SafetyContentType =
  | "profile"
  | "post"
  | "comment"
  | "story"
  | "reel"
  | "message"
  | "conversation"
  | "listing"
  | "general"
  | "agent";

export async function submitSafetyReport(input: {
  contentType: SafetyContentType;
  contentId?: string | number | null;
  reportedUserId?: number | null;
  reason: string;
  description?: string;
}): Promise<{ success: boolean; already_reported?: boolean; message?: string }> {
  try {
    const response = await apiFetch("/safety-reports", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        content_type: input.contentType,
        content_id: input.contentId ?? null,
        reported_user_id: input.reportedUserId ?? null,
        reason: input.reason,
        description: input.description || "",
      }),
    });
    const data = await readJson<{
      success?: boolean;
      already_reported?: boolean;
      message?: string;
      error?: string;
    }>(response);
    if (!response.ok) {
      return {
        success: false,
        message: data.message || data.error || "Could not submit this report.",
      };
    }
    return {
      success: true,
      already_reported: data.already_reported,
      message: data.message,
    };
  } catch {
    return { success: false, message: "Could not submit this report." };
  }
}
