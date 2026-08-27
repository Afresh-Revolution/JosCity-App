import { type ComponentProps, type ReactElement, type ReactNode, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedShell, { TAB_BAR_SPACE } from "./feed/FeedShell";
import { useI18n } from "../i18n/I18nProvider";
import { getAccountType, isBusinessAccountType } from "../storage/session";
import { colors as fallbackColors, type Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

type IconName = ComponentProps<typeof Ionicons>["name"];

type SettingsNavRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  kicker: string;
  title: string;
  loading?: boolean;
  keyboard?: boolean;
  refreshControl?: ReactElement;
  children: ReactNode;
};

export default function SettingsPage({
  kicker,
  title,
  loading = false,
  keyboard = false,
  refreshControl,
  children,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makePageStyles(colors), [colors]);
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    void (async () => {
      const type = await getAccountType();
      router.replace((isBusinessAccountType(type) ? "/business/profile" : "/profile") as never);
    })();
  };

  const body = loading ? (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  ) : keyboard ? (
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={8}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.content}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );

  return (
    <FeedShell
      tab="profile"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
      }
    >
      {body}
    </FeedShell>
  );
}

export function SettingsNavRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
  danger = false,
  disabled = false,
}: SettingsNavRowProps) {
  const { colors } = useTheme();
  const s = useSettingsStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={({ pressed }) => [
        s.navRow,
        last && s.rowLast,
        pressed && s.navRowPressed,
        disabled && s.navRowDisabled,
      ]}
    >
      <View style={[s.navIconWrap, danger && s.navIconWrapDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={s.navCopy}>
        <Text style={[s.rowTitle, danger && s.dangerTitle]}>{title}</Text>
        {subtitle ? (
          <Text style={s.rowMeta} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? colors.error : colors.textMuted}
      />
    </Pressable>
  );
}

export function makeSettingsStyles(colors: Palette) {
  return StyleSheet.create({
    section: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8,
      marginTop: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      marginBottom: 18,
      overflow: "hidden",
    },
    identityCard: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      marginBottom: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    identityCopy: {
      flex: 1,
    },
    identityEmail: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    identityType: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    statusBadge: {
      borderRadius: 999,
      backgroundColor: colors.navActive,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusBadgeMuted: {
      backgroundColor: colors.toggleTrack,
    },
    statusBadgeBanned: {
      backgroundColor: "rgba(180, 35, 24, 0.12)",
    },
    statusBadgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.primary,
    },
    statusBadgeTextMuted: {
      color: colors.textMuted,
    },
    statusBadgeTextBanned: {
      color: colors.error,
    },
    navRow: {
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    navRowPressed: {
      backgroundColor: colors.sheet,
    },
    navRowDisabled: {
      opacity: 0.55,
    },
    navIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.iconSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    navIconWrapDanger: {
      backgroundColor: "rgba(180, 35, 24, 0.12)",
    },
    navCopy: {
      flex: 1,
    },
    dangerTitle: {
      color: colors.error,
    },
    row: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    rowMeta: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: colors.navActive,
      borderColor: colors.navActive,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    chipTextOn: {
      color: colors.primary,
    },
    error: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.error,
      marginBottom: 12,
    },
    empty: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      paddingVertical: 24,
    },
    badge: {
      alignSelf: "flex-start",
      marginTop: 8,
      borderRadius: 999,
      backgroundColor: colors.brand,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.white,
    },
  });
}

export const settingsStyles = makeSettingsStyles(fallbackColors);

export function useSettingsStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeSettingsStyles(colors), [colors]);
}

function makePageStyles(colors: Palette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingBottom: 10,
      gap: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
    },
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
      marginTop: -2,
    },
    body: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
  });
}
