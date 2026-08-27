/**
 * Deterministic member code derived from numeric user_id.
 * Must match JOSCITY/src/utils/memberDisplayId.ts so website and app IDs agree.
 * Copy/API actions should still use the raw numeric id.
 */
export function formatMemberDisplayId(numericId: number): string {
  if (!Number.isFinite(numericId) || numericId <= 0) return "";
  let x = (numericId >>> 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  let n = x;
  for (let i = 0; i < 12; i++) {
    s += alphabet[n % alphabet.length];
    n = (Math.floor(n / alphabet.length) + numericId * (i + 17)) >>> 0;
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export function readNumericUserId(user: Record<string, unknown> | null | undefined): number {
  if (!user) return 0;
  const raw = user.user_id ?? user.id ?? user.userId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}
