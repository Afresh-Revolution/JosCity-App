import { EN_STRINGS } from "../i18n/en";

export function friendlyError(raw?: string | null): string {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();
  if (!text) return EN_STRINGS["error.generic"];
  if (
    /could not reach|network error|offline|failed to fetch|econn|connection|socket|dns/.test(
      lower
    )
  ) {
    return EN_STRINGS["error.offline"];
  }
  if (/timeout|timed out|aborted|abort/.test(lower)) {
    return EN_STRINGS["error.slow"];
  }
  if (
    /request failed|internal server|status code|http\b|xhr|json|sql|unauthorized|500|502|503|504|401|403|404|server error/.test(
      lower
    )
  ) {
    return EN_STRINGS["error.generic"];
  }
  if (/media file required|invalid story type|failed to create|failed to upload|^upload$/.test(lower)) {
    return EN_STRINGS["error.upload"];
  }
  return text;
}
