import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../FadeIn";
import ChatCountBadge from "../ChatCountBadge";
import { useI18n } from "../../i18n/I18nProvider";
import { useTheme } from "../../theme/ThemeProvider";

export type BusinessTab = "overview" | "feed" | "manage" | "messages" | "business";

type Props = {
  active: BusinessTab;
  messageUnread?: number;
};

export default function BusinessTabBar({ active, messageUnread = 0 }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <FadeIn delay={120} duration={500} translateY={18} style={styles.wrap}>
      <View style={[styles.bar, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <TabButton
          label={t("nav.overview")}
          icon={active === "overview" ? "grid" : "grid-outline"}
          active={active === "overview"}
          colors={colors}
          styles={styles}
          onPress={() => router.replace("/business" as never)}
        />
        <TabButton
          label={t("nav.feed")}
          icon={active === "feed" ? "newspaper" : "newspaper-outline"}
          active={active === "feed"}
          colors={colors}
          styles={styles}
          onPress={() => router.replace("/home")}
        />
        <TabButton
          label={t("nav.manage")}
          icon={active === "manage" ? "cube" : "cube-outline"}
          active={active === "manage"}
          colors={colors}
          styles={styles}
          onPress={() => router.replace("/business/manage")}
        />
        <TabButton
          label={t("nav.messages")}
          icon={active === "messages" ? "chatbubble" : "chatbubble-outline"}
          active={active === "messages"}
          badge={messageUnread}
          colors={colors}
          styles={styles}
          onPress={() => router.replace("/messages")}
        />
        <TabButton
          label={t("nav.business")}
          icon={active === "business" ? "briefcase" : "briefcase-outline"}
          active={active === "business"}
          colors={colors}
          styles={styles}
          onPress={() => router.replace("/business/profile")}
        />
      </View>
    </FadeIn>
  );
}

function TabButton({
  label,
  icon,
  active,
  badge = 0,
  onPress,
  colors,
  styles,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  badge?: number;
  onPress: () => void;
  colors: { primary: string; textMuted: string; badge: string; white: string; card: string };
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      onPress={onPress}
      style={styles.tab}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textMuted} />
        <ChatCountBadge
          count={badge}
          backgroundColor={colors.badge}
          textColor={colors.white}
          borderColor={colors.card}
        />
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: {
  background: string;
  card: string;
  primary: string;
  brand: string;
  navActive: string;
  white: string;
  textMuted: string;
  badge: string;
}) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 0,
    },
    bar: {
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrap: {
      width: 36,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapActive: {
      backgroundColor: colors.navActive,
    },
    label: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 10,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.primary,
      fontFamily: "Montserrat_600SemiBold",
    },
  });
}
