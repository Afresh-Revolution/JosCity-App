import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { friendlyError } from "../utils/errors";

export type NoticeTone = "error" | "info" | "success";

export type AppNotice = {
  title: string;
  message?: string;
  tone?: NoticeTone;
};

type Listener = (notice: AppNotice) => void;

let emit: Listener | null = null;

export function showNotice(notice: AppNotice) {
  emit?.({
    title: friendlyError(notice.title),
    message: notice.message ? friendlyError(notice.message) : undefined,
    tone: notice.tone || "error",
  });
}

export function showError(title: string, message?: string) {
  showNotice({ title, message, tone: "error" });
}

export function ErrorBanner({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeBannerStyles(colors), [colors]);
  const copy = friendlyError(message);
  if (!copy) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle" size={18} color={colors.error} />
      <Text style={styles.text}>{copy}</Text>
    </View>
  );
}

export function NoticeHost() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeSheetStyles(colors), [colors]);
  const [notice, setNotice] = useState<AppNotice | null>(null);

  useEffect(() => {
    emit = setNotice;
    return () => {
      if (emit === setNotice) emit = null;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setNotice(null);
      return true;
    });
    return () => sub.remove();
  }, [notice]);

  useEffect(() => {
    if (!notice) return;
    const tone = notice.tone || "error";
    if (notice.message) return;
    if (tone !== "success" && tone !== "info") return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  const tone = notice.tone || "error";
  const icon =
    tone === "success" ? "checkmark-circle" : tone === "info" ? "information-circle" : "alert-circle";
  const iconColor =
    tone === "success" ? colors.success : tone === "info" ? colors.primary : colors.error;

  return (
    <View
      style={[styles.overlay, { width, height }]}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      <Pressable style={styles.dim} onPress={() => setNotice(null)} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 18), maxHeight: Math.min(440, Math.round(height * 0.48)) },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>
        <Text style={styles.title}>{notice.title}</Text>
        {notice.message ? <Text style={styles.message}>{notice.message}</Text> : null}
        <Pressable
          onPress={() => setNotice(null)}
          style={styles.ok}
          accessibilityRole="button"
          accessibilityLabel={t("common.ok")}
        >
          <Text style={styles.okText}>{t("common.ok")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeBannerStyles(colors: Palette) {
  return StyleSheet.create({
    banner: {
      marginBottom: 12,
      borderRadius: 14,
      backgroundColor: "rgba(180, 35, 24, 0.08)",
      borderWidth: 1,
      borderColor: colors.error,
      paddingVertical: 12,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    text: {
      flex: 1,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      lineHeight: 19,
      color: colors.error,
    },
  });
}

function makeSheetStyles(colors: Palette) {
  return StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 9999,
      elevation: 9999,
      justifyContent: "flex-end",
    },
    dim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.42)",
    },
    sheet: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.iconSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
      marginBottom: 8,
    },
    message: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      marginBottom: 8,
    },
    ok: {
      marginTop: 16,
      minHeight: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    okText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
  });
}
