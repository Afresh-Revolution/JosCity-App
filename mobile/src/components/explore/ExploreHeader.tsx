import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../FadeIn";
import { useI18n } from "../../i18n/I18nProvider";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  unreadCount?: number;
  onSearch?: () => void;
  onNotifications?: () => void;
};

export default function ExploreHeader({
  unreadCount = 0,
  onSearch,
  onNotifications,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <FadeIn duration={480} translateY={8}>
      <View style={styles.row}>
        <View>
          <Text style={styles.kicker}>{t("explore.kicker")}</Text>
          <Text style={styles.title}>{t("explore.title")}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.search")}
            hitSlop={8}
            onPress={onSearch}
            style={styles.iconBtn}
          >
            <Ionicons name="search-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.notifications")}
            hitSlop={8}
            onPress={onNotifications}
            style={styles.iconBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors: {
  text: string;
  textMuted: string;
  badge: string;
  white: string;
}) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
      marginBottom: 2,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 32,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.badge,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      color: colors.white,
      fontFamily: "Montserrat_700Bold",
      fontSize: 9,
      lineHeight: 12,
    },
  });
}
