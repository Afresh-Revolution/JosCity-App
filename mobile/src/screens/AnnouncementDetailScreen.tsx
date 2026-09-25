import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import JosCityLoader from "../components/JosCityLoader";
import { getNotification, markNotificationRead, type ApiNotification } from "../api/notifications";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import { hasSession } from "../storage/session";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brandJoscityText, notificationWhen } from "../utils/notifications";

const TYPE_LABEL: Record<string, string> = {
  normal: "Announcement",
  info: "Information",
  success: "Update",
  warning: "Warning",
  danger: "Danger alert",
};

export default function AnnouncementDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id || 0);
  const [item, setItem] = useState<ApiNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const signedIn = await hasSession();
    if (!signedIn) {
      router.replace("/login");
      return;
    }
    if (!id) {
      setMissing(true);
      setLoading(false);
      return;
    }
    const row = await getNotification(id);
    if (!row) {
      setMissing(true);
      setItem(null);
    } else {
      setItem(row);
      setMissing(false);
      if (!row.is_read) void markNotificationRead(id);
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const type = String(item?.notification_type || "normal").toLowerCase();
  const danger = type === "danger";
  const title = brandJoscityText(item?.title) || "Joscity";
  const body = brandJoscityText(item?.message);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/notifications"))}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Joscity</Text>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : missing || !item ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>This announcement is no longer available.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.kicker, danger && styles.kickerDanger]}>
            {TYPE_LABEL[type] || "Announcement"}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.when}>{notificationWhen(item.time)}</Text>
          {body ? <Text selectable style={styles.body}>{body}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    backBtn: { padding: 8 },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      marginRight: 40,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.primary,
      textTransform: "uppercase",
    },
    kickerDanger: { color: colors.error },
    title: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      lineHeight: 32,
      color: colors.text,
    },
    when: {
      marginTop: 8,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    body: {
      marginTop: 18,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
    },
    empty: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
    },
  });
}
