import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../FadeIn";
import { useI18n } from "../../i18n/I18nProvider";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  unreadCount?: number;
  searchActive?: boolean;
  onSearch?: () => void;
  showSearch?: boolean;
  onNotifications?: () => void;
};

const logo = require("../../../assets/logo.png");

export default function FeedHeader({
  unreadCount = 0,
  searchActive = false,
  onSearch,
  showSearch = true,
  onNotifications,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <FadeIn duration={500} translateY={8}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.title}>JOSCITY</Text>
        </View>
        <View style={styles.actions}>
          {showSearch && <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.search")}
            hitSlop={8}
            onPress={onSearch}
            style={styles.iconBtn}
          >
            <Ionicons
              name={searchActive ? "search" : "search-outline"}
              size={22}
              color={colors.text}
            />
          </Pressable>}
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
  background: string;
  text: string;
  badge: string;
  white: string;
}) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.background,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      letterSpacing: 1.4,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
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
