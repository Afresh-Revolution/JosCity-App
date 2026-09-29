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
import { getPreferences, updatePreferences } from "../api/account";
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
/** V3: default is Device (system), not Light. */
const DEFAULT_MIGRATION_KEY = "joscity.appearanceDefaultV3";

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

function asAppearance(value: unknown): AppearancePreference | null {
  if (value === "light" || value === "dark" || value === "system") return value;
  return null;
}

function readSystemScheme(): ColorScheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function resolveScheme(appearance: AppearancePreference, system: ColorScheme): ColorScheme {
  if (appearance === "dark") return "dark";
  if (appearance === "system") return system;
  return "light";
}

/**
 * Force light/dark only when the user picks those.
 * For Device, clear any forced scheme so the OS controls Appearance.getColorScheme().
 */
function applyNativeScheme(appearance: AppearancePreference) {
  const setter = (
    Appearance as {
      setColorScheme?: (value: ColorScheme | "unspecified" | null | undefined) => void;
    }
  ).setColorScheme;
  if (!setter) return;

  if (appearance === "system") {
    try {
      setter("unspecified");
    } catch {
      try {
        setter(null);
      } catch {
        try {
          setter(undefined);
        } catch {
          // Still force-mirror OS so getColorScheme is not stuck on a prior light/dark.
          setter(readSystemScheme());
        }
      }
    }
    return;
  }

  setter(appearance === "dark" ? "dark" : "light");
}

function clearForcedSchemeThenRead(): ColorScheme {
  applyNativeScheme("system");
  return readSystemScheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreference>("system");
  const [system, setSystem] = useState<ColorScheme>(readSystemScheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [stored, migratedV3] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(DEFAULT_MIGRATION_KEY),
        ]);
        let next = asAppearance(stored) || "system";

        if (!migratedV3) {
          // One-time: Device is the default. Keep explicit dark; move prior light default → system.
          if (stored === "dark") {
            next = "dark";
          } else if (stored === "system") {
            next = "system";
          } else {
            // null, "light", or anything else from older defaults → Device
            next = "system";
          }
          await AsyncStorage.setItem(STORAGE_KEY, next);
          await AsyncStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
          // Drop the old V2 marker so we don't re-apply light later from stale code paths.
          await AsyncStorage.removeItem("joscity.appearanceDefaultV2").catch(() => undefined);
        }

        if (!cancelled) {
          if (next === "system") {
            const scheme = clearForcedSchemeThenRead();
            setSystem(scheme);
          } else {
            applyNativeScheme(next);
          }
          setAppearanceState(next);
        }

        const token = await getAuthToken();
        if (!token || cancelled) return;
        const prefs = await getPreferences();
        if (cancelled) return;
        const remote = asAppearance(prefs.data?.appearance);
        if (remote !== next) {
          void updatePreferences({ appearance: next }).catch(() => undefined);
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
    // Keep native Appearance aligned with the preference, and re-sample OS
    // scheme when Device is selected (important after setColorScheme overrides).
    if (appearance === "system") {
      applyNativeScheme("system");
      const sync = () => setSystem(readSystemScheme());
      sync();
      const t1 = setTimeout(sync, 0);
      const t2 = setTimeout(sync, 100);
      const sub = Appearance.addChangeListener((event) => {
        const fromEvent =
          event?.colorScheme === "dark" || event?.colorScheme === "light"
            ? event.colorScheme
            : null;
        setSystem(fromEvent || readSystemScheme());
      });
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        sub.remove();
      };
    }
    applyNativeScheme(appearance);
    const sub = Appearance.addChangeListener(() => undefined);
    return () => sub.remove();
  }, [appearance]);

  const setAppearance = useCallback((value: AppearancePreference) => {
    if (value === "system") {
      const scheme = clearForcedSchemeThenRead();
      setSystem(scheme);
      // Re-read after native clears (some Android builds update asynchronously).
      requestAnimationFrame(() => setSystem(readSystemScheme()));
      setTimeout(() => setSystem(readSystemScheme()), 50);
    } else {
      applyNativeScheme(value);
      setSystem(readSystemScheme());
    }
    setAppearanceState(value);
    void AsyncStorage.setItem(STORAGE_KEY, value);
    void AsyncStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
    void (async () => {
      if (!(await getAuthToken())) return;
      await updatePreferences({ appearance: value }).catch(() => undefined);
    })();
  }, []);

  const scheme = resolveScheme(appearance, system);
  const palette = scheme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    if (appearance !== "system") applyNativeScheme(appearance);
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
    const boot = readSystemScheme() === "dark" ? darkColors : lightColors;
    return <View style={{ flex: 1, backgroundColor: boot.background }} />;
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
