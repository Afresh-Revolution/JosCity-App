type Focus = {
  screen: string;
  entityId?: string | null;
};

let current: Focus | null = null;

export function setPushFocus(screen: string, entityId?: string | number | null): void {
  current = {
    screen: String(screen || "").trim().toLowerCase(),
    entityId: entityId == null || entityId === "" ? null : String(entityId),
  };
}

export function clearPushFocus(): void {
  current = null;
}

export function getPushFocus(): Focus | null {
  return current;
}

export function isPushFocused(screen?: string, entityId?: string | number | null): boolean {
  if (!current) return false;
  if (screen && current.screen !== String(screen).toLowerCase()) return false;
  if (entityId == null || entityId === "") return true;
  return String(current.entityId) === String(entityId);
}
