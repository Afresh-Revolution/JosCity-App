export function formatDurationNote(
  note?: string | null,
  unit?: string | null
): string {
  const text = String(note || "").trim();
  if (!text) return "";
  if (/(hours?|hrs?|h\b|minutes?|mins?|days?|weeks?|seconds?)/i.test(text)) {
    return text;
  }
  const n = Number(String(text).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return text;
  const unitRaw = String(unit || "").toLowerCase();
  const plural = n === 1 ? "" : "s";
  if (unitRaw.includes("minute") || unitRaw.includes("min")) {
    return `${n} minute${plural}`;
  }
  if (unitRaw.includes("day")) return `${n} day${plural}`;
  if (unitRaw.includes("session")) return `${n} session${plural}`;
  return `${n} hour${plural}`;
}
