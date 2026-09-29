import type { RefObject } from "react";
import { findNodeHandle, ScrollView, UIManager, View } from "react-native";

export type FieldCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export function missingFields(checks: FieldCheck[]): FieldCheck[] {
  return checks.filter((check) => !check.ok);
}

/** Per-field helper under the input, e.g. "Required — add your delivery address". */
export function fieldRequiredHint(label: string): string {
  const trimmed = String(label || "").trim();
  if (!trimmed) return "Required — please fill this in";
  return `Required — add your ${trimmed.toLowerCase()}`;
}

export function fieldErrorMap(missing: FieldCheck[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of missing) {
    out[item.key] = fieldRequiredHint(item.label);
  }
  return out;
}

/** Short guide line shown above the required list. */
export function requiredGuideMessage(count: number): string {
  if (count <= 1) {
    return "Fill in the required info below, then try again.";
  }
  return `Fill in these ${count} required fields, then try again.`;
}

/**
 * Scroll the form so the error banner is visible.
 * Falls back to the top of the scroll view when measure fails.
 */
export function scrollToFormError(
  scrollRef: RefObject<ScrollView | null>,
  errorRef?: RefObject<View | null>
) {
  const run = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const errorNode = errorRef?.current ? findNodeHandle(errorRef.current) : null;
    const scrollNode = findNodeHandle(scroll);

    if (!errorNode || !scrollNode) {
      scroll.scrollTo({ y: 0, animated: true });
      return;
    }

    UIManager.measureLayout(
      errorNode,
      scrollNode,
      () => {
        scroll.scrollTo({ y: 0, animated: true });
      },
      (_x, y) => {
        scroll.scrollTo({ y: Math.max(0, y - 16), animated: true });
      }
    );
  };

  requestAnimationFrame(() => {
    setTimeout(run, 48);
  });
}
