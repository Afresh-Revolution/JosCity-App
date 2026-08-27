export function newsSnippet(content?: string | null, max = 118): string {
  const text = newsBody(content);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "").trim()}…`;
}

export function newsBody(content?: string | null): string {
  return String(content || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function newsMetaLabel(ago?: string | null): string {
  const when = String(ago || "").trim().toUpperCase();
  return when ? `JOSCITY NEWS · ${when}` : "JOSCITY NEWS";
}

export function newsShareUrl(id: number): string {
  return `https://joscity.com/news/${id}`;
}
