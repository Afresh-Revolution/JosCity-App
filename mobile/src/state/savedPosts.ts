const overrides = new Map<number, boolean>();

export function parseSavedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes";
}

export function getSavedOverride(postId: number): boolean | undefined {
  return overrides.get(postId);
}

export function setSavedOverride(postId: number, saved: boolean): void {
  if (!postId) return;
  overrides.set(postId, saved);
}

export function resolveSaved(postId: number, fallback: unknown): boolean {
  const override = getSavedOverride(postId);
  if (typeof override === "boolean") return override;
  return parseSavedFlag(fallback);
}
