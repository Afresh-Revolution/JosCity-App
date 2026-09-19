import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import SettingsPage, { makeSettingsStyles } from "../components/SettingsPage";
import { getPreferences, updatePreferences, type PreferenceInfo } from "../api/account";
import { useI18n } from "../i18n/I18nProvider";
import { DEVICE_LANGUAGE, resolveLanguage } from "../i18n/i18n";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useTheme } from "../theme/ThemeProvider";
import type { AppearancePreference } from "../theme/colors";

const APPEARANCES: AppearancePreference[] = ["light", "dark", "system"];

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeSettingsStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function PreferencesScreen() {
  const allowed = useRequirePersonalAccount();
  const { colors, appearance, setAppearance } = useTheme();
  const { t, language, languages, setLanguage } = useI18n();
  const styles = useMemo(() => makeSettingsStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<PreferenceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getPreferences();
    if (result.data) {
      setPrefs(result.data);
    }
  }, [setAppearance]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const save = async (patch: Partial<Pick<PreferenceInfo, "language" | "area" | "appearance">>) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setError(null);
    if (patch.appearance === "light" || patch.appearance === "dark" || patch.appearance === "system") {
      setAppearance(patch.appearance);
    }
    if (patch.language) setLanguage(patch.language);
    const payload =
      patch.language === DEVICE_LANGUAGE
        ? {
            ...patch,
            language: resolveLanguage(
              DEVICE_LANGUAGE,
              (languages.length ? languages : prefs.languages || []).map((item) => item.id)
            ),
          }
        : patch;
    const result = await updatePreferences(payload);
    if (!result.success || !result.data) {
      if (patch.appearance) {
        setPrefs({ ...previous, ...patch });
        return;
      }
      setPrefs(previous);
      setError(result.message || t("preferences.saveError"));
      return;
    }
    setPrefs(result.data);
  };

  if (!allowed) return null;

  const languageOptions = languages.length ? languages : prefs?.languages || [];
  const selectedLanguage = language || prefs?.language;
  const selectedAppearance = appearance || prefs?.appearance || "light";

  return (
    <SettingsPage kicker={t("preferences.kicker")} title={t("preferences.title")} loading={loading}>
      <FadeIn>
        {error ? <ErrorBanner message={error} /> : null}
        <Text style={styles.section}>{t("preferences.language")}</Text>
        <View style={styles.chipRow}>
          <Chip
            styles={styles}
            label={t("preferences.deviceLanguage")}
            selected={selectedLanguage === DEVICE_LANGUAGE}
            onPress={() => void save({ language: DEVICE_LANGUAGE })}
          />
          {languageOptions.map((item) => (
            <Chip
              key={item.id}
              styles={styles}
              label={item.label}
              selected={selectedLanguage === item.id}
              onPress={() => void save({ language: item.id })}
            />
          ))}
        </View>

        <Text style={styles.section}>{t("preferences.area")}</Text>
        <View style={styles.chipRow}>
          {(prefs?.areas || []).map((area) => (
            <Chip
              key={area}
              styles={styles}
              label={area}
              selected={prefs?.area === area}
              onPress={() => void save({ area })}
            />
          ))}
        </View>

        <Text style={styles.section}>{t("preferences.appearance")}</Text>
        <View style={styles.chipRow}>
          {APPEARANCES.map((item) => (
            <Chip
              key={item}
              styles={styles}
              label={
                item === "dark"
                  ? t("preferences.dark")
                  : item === "system"
                    ? t("preferences.system")
                    : t("preferences.light")
              }
              selected={selectedAppearance === item}
              onPress={() => void save({ appearance: item })}
            />
          ))}
        </View>
        <Text style={styles.rowMeta}>{t("preferences.hint")}</Text>
      </FadeIn>
    </SettingsPage>
  );
}
