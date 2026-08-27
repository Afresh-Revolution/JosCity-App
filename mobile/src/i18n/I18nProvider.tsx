import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPreferences } from "../api/account";
import { getAppLanguages, type AppLanguage } from "../api/languages";
import { getAuthToken } from "../storage/session";
import { EN_STRINGS } from "./en";
import i18n, { DEVICE_LANGUAGE, resolveLanguage } from "./i18n";

const STORAGE_KEY = "joscity.language";

const FALLBACK_LANGUAGES: AppLanguage[] = [
  { id: "en", label: "English" },
  { id: "ha", label: "Hausa" },
  { id: "bem", label: "Berom" },
  { id: "ig", label: "Igbo" },
  { id: "yo", label: "Yoruba" },
];

type Translate = (key: string, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  language: string;
  resolvedLanguage: string;
  languages: AppLanguage[];
  t: Translate;
  setLanguage: (code: string) => void;
  reload: () => Promise<void>;
};

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  resolvedLanguage: "en",
  languages: FALLBACK_LANGUAGES,
  t: (key) => EN_STRINGS[key] || key,
  setLanguage: () => undefined,
  reload: async () => undefined,
});

function compactCatalog(catalog: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(catalog).filter(([, value]) => typeof value === "string" && value.trim())
  );
}

function applyCatalogs(strings: Record<string, Record<string, string>>) {
  const mergedEn = { ...EN_STRINGS, ...compactCatalog(strings.en || {}) };
  i18n.addResourceBundle("en", "translation", mergedEn, true, true);
  for (const [code, catalog] of Object.entries(strings)) {
    if (code === "en" || !catalog || typeof catalog !== "object") continue;
    i18n.addResourceBundle(code, "translation", { ...mergedEn, ...compactCatalog(catalog) }, true, true);
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState("en");
  const [languages, setLanguages] = useState<AppLanguage[]>(FALLBACK_LANGUAGES);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((value) => value + 1);
    i18n.on("languageChanged", onChange);
    i18n.on("added", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
      i18n.off("added", onChange);
    };
  }, []);

  const availableIds = useMemo(() => languages.map((item) => item.id), [languages]);
  const resolvedLanguage = resolveLanguage(language, availableIds);

  useEffect(() => {
    if (i18n.language !== resolvedLanguage) {
      void i18n.changeLanguage(resolvedLanguage);
    }
  }, [resolvedLanguage]);

  const applyLanguage = useCallback((code: string, available: AppLanguage[]) => {
    const ids = available.map((item) => item.id);
    const next = code === DEVICE_LANGUAGE || ids.includes(code) ? code : "en";
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
    void i18n.changeLanguage(resolveLanguage(next, ids));
  }, []);

  const reload = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const remote = await getAppLanguages();
    const nextLanguages = remote.languages.length ? remote.languages : FALLBACK_LANGUAGES;
    setLanguages(nextLanguages);
    applyCatalogs(remote.strings);

    const ids = nextLanguages.map((item) => item.id);
    let preferred =
      stored === DEVICE_LANGUAGE || (stored && ids.includes(stored)) ? stored : "en";

    const token = await getAuthToken();
    if (token && stored !== DEVICE_LANGUAGE) {
      const prefs = await getPreferences();
      if (prefs.data?.language && ids.includes(prefs.data.language)) {
        preferred = prefs.data.language;
      }
    }

    setLanguageState(preferred);
    await AsyncStorage.setItem(STORAGE_KEY, preferred);
    await i18n.changeLanguage(resolveLanguage(preferred, ids));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setLanguage = useCallback(
    (code: string) => {
      applyLanguage(code, languages);
    },
    [applyLanguage, languages]
  );

  const t = useCallback<Translate>(
    (key, vars) =>
      i18n.t(key, {
        defaultValue: EN_STRINGS[key] || key,
        ...(vars || {}),
      }) as string,
    [tick, resolvedLanguage]
  );

  const value = useMemo(
    () => ({ language, resolvedLanguage, languages, t, setLanguage, reload }),
    [language, languages, reload, resolvedLanguage, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
