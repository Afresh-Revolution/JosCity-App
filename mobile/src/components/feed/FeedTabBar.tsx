import { Pressable, StyleSheet, Text, View, Keyboard } from "react-native";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../FadeIn";
import ChatCountBadge from "../ChatCountBadge";
import { useI18n } from "../../i18n/I18nProvider";
import { useTheme } from "../../theme/ThemeProvider";

export type FeedTab = "home" | "explore" | "create" | "messages" | "profile" | "overview" | "manage";

type Props = {
  active: FeedTab;
  messageUnread?: number;
};

export default function FeedTabBar({ active, messageUnread = 0 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <FadeIn delay={120} duration={500} translateY={18} style={styles.wrap}>
      <View style={[styles.bar, { marginBottom: Math.max(insets.bottom, 10) }]}>
        <TabButton
          label={t("nav.home")}
          icon={active === "home" ? "home" : "home-outline"}
          active={active === "home"}
          colors={colors}
          styles={styles}
          onPress={() => {
            Keyboard.dismiss();
            router.replace("/home");
          }}
        />
        <TabButton
          label={t("nav.explore")}
          icon={active === "explore" ? "compass" : "compass-outline"}
          active={active === "explore"}
          colors={colors}
          styles={styles}
          onPress={() => {
            Keyboard.dismiss();
            router.replace("/explore");
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("nav.create")}
          onPress={() => {
            Keyboard.dismiss();
            if (active === "create") return;
            router.push(pathname === "/reels" ? "/reels/create" : "/create");
          }}
          style={styles.createBtn}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
        <TabButton
          label={t("nav.messages")}
          icon={active === "messages" ? "chatbubble" : "chatbubble-outline"}
          active={active === "messages"}
          badge={messageUnread}
          colors={colors}
          styles={styles}
          onPress={() => {
            Keyboard.dismiss();
            router.replace("/messages");
          }}
        />
        <TabButton
          label={t("nav.profile")}
          icon={active === "profile" ? "person" : "person-outline"}
          active={active === "profile"}
          colors={colors}
          styles={styles}
          onPress={() => {
            Keyboard.dismiss();
            router.replace("/profile");
          }}
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
    createBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 4,
    },
  });
}
