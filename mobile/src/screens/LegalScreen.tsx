import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage from "../components/SettingsPage";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { useI18n } from "../i18n/I18nProvider";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

export default function LegalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useI18n();
  const allowed = useRequirePersonalAccount();

  if (!allowed) return null;

  const rows = [
    {
      title: t("legal.terms"),
      subtitle: t("legal.termsSub"),
      url: LEGAL.terms,
    },
    {
      title: t("legal.privacy"),
      subtitle: t("legal.privacySub"),
      url: LEGAL.privacy,
    },
    {
      title: t("legal.guidelines"),
      subtitle: t("legal.guidelinesSub"),
      url: LEGAL.guidelines,
    },
    {
      title: t("legal.childSafety"),
      subtitle: t("legal.childSafetySub"),
      url: LEGAL.childSafety,
    },
    {
      title: t("legal.cookies"),
      subtitle: t("legal.cookiesSub"),
      url: LEGAL.cookies,
    },
    {
      title: t("legal.contact"),
      subtitle: t("legal.contactSub"),
      url: LEGAL.support,
    },
    {
      title: t("legal.delete"),
      subtitle: t("legal.deleteSub"),
      url: LEGAL.deleteAccount,
    },
  ];

  return (
    <SettingsPage kicker={t("legal.kicker")} title={t("legal.title")}>
      <FadeIn>
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable
              key={row.url}
              onPress={() => void openExternalUrl(row.url)}
              accessibilityRole="link"
              accessibilityLabel={row.title}
              accessibilityHint={row.subtitle}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.textMuted} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => void openExternalUrl(LEGAL.site)}
          accessibilityRole="link"
          accessibilityLabel={t("legal.fullPolicies")}
          style={({ pressed }) => [styles.siteLink, pressed && styles.siteLinkPressed]}
        >
          <Text style={styles.siteLinkText}>{t("legal.fullPolicies")}</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>
      </FadeIn>
    </SettingsPage>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    list: {
      gap: 12,
    },
    row: {
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowPressed: {
      backgroundColor: colors.sheet,
    },
    copy: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    rowSub: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    siteLink: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    siteLinkPressed: {
      opacity: 0.7,
    },
    siteLinkText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
