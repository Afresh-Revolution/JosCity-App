export type StatusReply = {
  storyId: number;
  label: string;
  preview?: string;
  kind: "photo" | "video" | "text";
  reply: string;
};

function prettyLabel(raw: string): { label: string; kind: StatusReply["kind"] } {
  const value = raw.trim();
  if (/^photo(?: status)?$/i.test(value)) return { label: "Photo", kind: "photo" };
  if (/^video(?: status)?$/i.test(value)) return { label: "Video", kind: "video" };
  return { label: value || "Status", kind: "text" };
}

export function parseStatusReply(text: string): StatusReply | null {
  const match = text.match(
    /^Reply to your status #(\d+):\s*([^\n]*?)(?:\npreview:(\S+))?(?:\n\n|\n)([\s\S]+)$/
  );
  if (!match) return null;
  const storyId = Number(match[1]);
  const reply = match[4].trim();
  if (!storyId || !reply) return null;
  const preview = match[3]?.trim();
  const pretty = prettyLabel(match[2] || "");
  const kind =
    preview && pretty.kind === "text"
      ? /\.(mp4|mov|m4v|webm)(\?|$)/i.test(preview)
        ? "video"
        : "photo"
      : pretty.kind;
  return {
    storyId,
    label: pretty.label,
    preview: preview || undefined,
    kind,
    reply,
  };
}

export function statusReplyBody(input: {
  storyId: number;
  type: "text" | "photo" | "video";
  content?: string;
  caption?: string;
  reply: string;
}): string {
  const label =
    input.type === "text"
      ? (input.content || "Status").slice(0, 240)
      : (input.caption || (input.type === "video" ? "Video" : "Photo")).slice(0, 240);
  const preview =
    input.type !== "text" && /^https?:\/\//i.test(input.content || "")
      ? `\npreview:${input.content}`
      : "";
  return `Reply to your status #${input.storyId}: ${label}${preview}\n\n${input.reply.trim()}`;
}
