const NDEF_PREFIX = "RGC1:";

export type NfcByteRecord = {
  payload?: ArrayLike<number> | null;
};

export function normalizeUid(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase();
}

function bytesToLatin1(payload: ArrayLike<number> | null | undefined): string {
  if (!payload || !payload.length) return "";
  let text = "";
  for (let i = 0; i < payload.length; i += 1) text += String.fromCharCode(payload[i] & 0xff);
  return text;
}

/** NDEF Well Known Text: status byte, language code, then the text. */
function decodeNdefText(payload: ArrayLike<number>): string {
  if (!payload.length) return "";
  const status = payload[0] & 0xff;
  const langLength = status & 0x3f;
  const start = 1 + langLength;
  if (start >= payload.length) return bytesToLatin1(payload);
  const body: number[] = [];
  for (let i = start; i < payload.length; i += 1) body.push(payload[i] & 0xff);
  if ((status & 0x80) === 0) return bytesToLatin1(body);
  let text = "";
  for (let i = 0; i + 1 < body.length; i += 2) {
    text += String.fromCharCode((body[i + 1] << 8) | body[i]);
  }
  return text;
}

function hexAfterPrefix(text: string): string {
  const at = text.indexOf(NDEF_PREFIX);
  if (at < 0) return "";
  return text
    .slice(at + NDEF_PREFIX.length)
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase();
}

/** Finds the "RGC1:" record and returns its hex ciphertext, or "". */
export function extractCardPayload(records: NfcByteRecord[] | null | undefined): string {
  for (const record of records || []) {
    const payload = record?.payload;
    if (!payload) continue;
    const decoded = decodeNdefText(payload);
    if (decoded.includes(NDEF_PREFIX)) return hexAfterPrefix(decoded);
    const latin = bytesToLatin1(payload);
    if (latin.includes(NDEF_PREFIX)) return hexAfterPrefix(latin);
  }
  return "";
}

export function formatTapCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
