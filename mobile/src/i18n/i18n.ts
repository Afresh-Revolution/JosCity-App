import i18n from "i18next";
import * as Localization from "expo-localization";
import { EN_STRINGS } from "./en";

export const DEVICE_LANGUAGE = "system";

void i18n.init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: EN_STRINGS },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
});

export function deviceLanguageCode(): string {
  return Localization.getLocales()[0]?.languageCode?.toLowerCase() || "en";
}

export function resolveLanguage(code: string, availableIds: string[]): string {
  const ids = availableIds.length ? availableIds : ["en"];
  if (code === DEVICE_LANGUAGE) {
    const device = deviceLanguageCode();
    return ids.includes(device) ? device : "en";
  }
  return ids.includes(code) ? code : "en";
}

export default i18n;
