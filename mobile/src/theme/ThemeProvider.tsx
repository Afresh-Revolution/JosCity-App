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

type ThemeContextValue = {
  appearance: AppearancePreference;
  scheme: ColorScheme;
  colors: Palette;
  setAppearance: (value: AppearancePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  appearance: "system",
  scheme: "light",
  colors: lightColors,
  setAppearance: () => undefined,
});

function resolveScheme(appearance: AppearancePreference, system: ColorScheme | null): ColorScheme {
  if (appearance === "light" || appearance === "dark") return appearance;
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreference>("system");
  const [system, setSystem] = useState<ColorScheme | null>(Appearance.getColorScheme() === "dark" ? "dark" : "light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === "light" || stored === "dark" || stored === "system")) {
          setAppearanceState(stored);
        }
        const token = await getAuthToken();
        if (token) {
          const prefs = await getPreferences();
          const appearance = prefs.data?.appearance;
          if (
            !cancelled &&
            (appearance === "light" || appearance === "dark" || appearance === "system")
          ) {
            setAppearanceState(appearance);
            await AsyncStorage.setItem(STORAGE_KEY, appearance);
          }
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
  }, []);

  const scheme = resolveScheme(appearance, system);
  const palette = scheme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.background);
  }, [palette.background]);

  const value = useMemo(
    () => ({
      appearance,
      scheme,
      colors: palette,
      setAppearance,
    }),
    [appearance, palette, scheme, setAppearance]
  );

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
