import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPreferences } from "../api/account";
import { getAuthToken } from "../storage/session";
import * as SystemUI from "expo-system-ui";
import {
  darkColors,
  lightColors,
  type AppearancePreference,
  type ColorScheme,
  type Palette,
} from "./colors";

const STORAGE_KEY = "joscity.appearance";
const DEFAULT_MIGRATION_KEY = "joscity.appearanceDefaultV2";

type ThemeContextValue = {
  appearance: AppearancePreference;
  scheme: ColorScheme;
  colors: Palette;
  setAppearance: (value: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  appearance: "light",
  scheme: "light",
  colors: lightColors,
  setAppearance: () => undefined,
});

function resolveScheme(appearance: AppearancePreference, system: ColorScheme | null): ColorScheme {
  if (appearance === "dark") return "dark";
  if (appearance === "system") return system === "dark" ? "dark" : "light";
  return "light";
}

function applyNativeScheme(appearance: AppearancePreference) {
  const setter = (Appearance as { setColorScheme?: (value: ColorScheme | null) => void }).setColorScheme;
  if (!setter) return;
  if (appearance === "system") setter(null);
  else setter(appearance === "dark" ? "dark" : "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreference>("light");
  const [system, setSystem] = useState<ColorScheme | null>(Appearance.getColorScheme() === "dark" ? "dark" : "light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [stored, migrated] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(DEFAULT_MIGRATION_KEY),
        ]);
        let next: AppearancePreference = "light";
        if (!migrated) {
          next = stored === "dark" ? "dark" : "light";
          await AsyncStorage.setItem(STORAGE_KEY, next);
          await AsyncStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
        } else if (stored === "dark" || stored === "system") {
          next = stored;
        } else {
          next = "light";
        }
        if (!cancelled) setAppearanceState(next);

        const token = await getAuthToken();
        if (!token) return;
        const prefs = await getPreferences();
        const remote = prefs.data?.appearance;
        if (cancelled) return;
        if (remote === "dark" || remote === "light") {
          setAppearanceState(remote);
          await AsyncStorage.setItem(STORAGE_KEY, remote);
        } else if (remote === "system" && next === "system") {
          setAppearanceState("system");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const setAppearance = useCallback((value: AppearancePreference) => {
    setAppearanceState(value);
    void AsyncStorage.setItem(STORAGE_KEY, value);
    void AsyncStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
    applyNativeScheme(value);
  }, []);

  const scheme = resolveScheme(appearance, system);
  const palette = scheme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    applyNativeScheme(appearance);
    void SystemUI.setBackgroundColorAsync(palette.background);
  }, [appearance, palette.background]);

  const value = useMemo(
    () => ({
      appearance,
      scheme,
      colors: palette,
      setAppearance,
    }),
    [appearance, palette, scheme, setAppearance]
  );

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: lightColors.background }} />;
  }

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
