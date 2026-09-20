export function normalizeUsername(value: string): string {
  return String(value || "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
}

export function usernameError(value: string, required = false): string | null {
  const handle = normalizeUsername(value);
  if (!handle) return required ? "Enter a username." : null;
  if (handle.length < 3 || handle.length > 40) return "Username must be 3–40 characters.";
  if (!/^[a-z0-9][a-z0-9._]{1,38}[a-z0-9]$/.test(handle)) {
    return "Use letters, numbers, underscores or periods.";
  }
  return null;
}
