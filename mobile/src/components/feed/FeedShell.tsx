import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BusinessTabBar, { type BusinessTab } from "../business/BusinessTabBar";
import AgentTabBar from "../agents/AgentTabBar";
import FeedHeader from "./FeedHeader";
import FeedTabBar, { type FeedTab } from "./FeedTabBar";
import { getChatUnreadCount } from "../../api/chat";
import { useI18n } from "../../i18n/I18nProvider";
import { getAccountType, isBusinessAccountType } from "../../storage/session";
import { useTheme } from "../../theme/ThemeProvider";
import { startForegroundInterval } from "../../utils/foregroundInterval";

type Props = {
  children: ReactNode;
  tab: FeedTab;
  unreadCount?: number;
  searchActive?: boolean;
  onSearch?: () => void;
  header?: ReactNode;
  showTabBar?: boolean;
  hideHeader?: boolean;
  statusBarStyle?: "light" | "dark" | "auto";
};

export const TAB_BAR_SPACE = 96;

function toBusinessTab(tab: FeedTab): BusinessTab {
  if (tab === "overview") return "overview";
  if (tab === "manage") return "manage";
  if (tab === "messages") return "messages";
  if (tab === "profile") return "business";
  return "feed";
}

export default function FeedShell({
  children,
  tab,
  unreadCount = 0,
  searchActive = false,
  onSearch,
  header,
  showTabBar = true,
  hideHeader = false,
  statusBarStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const agentFeed = usePathname().startsWith("/agents/");
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<"unknown" | "personal" | "business">("unknown");
  const [chatUnread, setChatUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const prevUnread = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: hideHeader ? "#000000" : colors.background,
        },
        body: {
          flex: 1,
          overflow: "visible",
        },
        toast: {
          position: "absolute",
          left: 20,
          right: 20,
          zIndex: 40,
          borderRadius: 18,
          backgroundColor: colors.brand,
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        },
        toastText: {
          color: colors.white,
          fontFamily: "Montserrat_700Bold",
          fontSize: 14,
          textAlign: "center",
        },
      }),
    [colors, hideHeader]
  );

  const pingUnread = useCallback(async () => {
    if (agentFeed) return;
    try {
      const next = await getChatUnreadCount();
      const previous = prevUnread.current;
      if (previous != null && next > previous && tab !== "messages") {
        const gained = next - previous;
        const label = gained === 1 ? t("messages.newOne") : t("messages.newMany", { count: gained });
        setToast(label);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4200);
      }
      prevUnread.current = next;
      setChatUnread(next);
    } catch {
      // Badge polling must not crash the feed.
    }
  }, [t, tab, agentFeed]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getAccountType().then((type) => {
        if (active) setMode(isBusinessAccountType(type) ? "business" : "personal");
      });
      void pingUnread();
      const stop = startForegroundInterval(() => {
        void pingUnread();
      }, 12000);
      return () => {
        active = false;
        stop();
      };
    }, [pingUnread])
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar
        style={
          statusBarStyle === "light" || statusBarStyle === "dark"
            ? statusBarStyle
            : scheme === "dark"
              ? "light"
              : "dark"
        }
      />
      {hideHeader ? null : (
        <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
          {header ?? (
            <FeedHeader
              unreadCount={agentFeed ? 0 : unreadCount}
              searchActive={searchActive}
              onSearch={onSearch}
              onNotifications={() => router.push((agentFeed ? "/agents/notifications" : "/notifications") as never)}
            />
          )}
        </View>
      )}
      <View style={styles.body}>{children}</View>
      {showTabBar && agentFeed ? <AgentTabBar active="feed" /> : showTabBar && mode !== "unknown" ? (
        mode === "business" ? (
          <BusinessTabBar active={toBusinessTab(tab)} messageUnread={chatUnread} />
        ) : (
          <FeedTabBar active={tab} messageUnread={chatUnread} />
        )
      ) : null}
      {toast ? (
        <Pressable
          onPress={() => {
            setToast(null);
            router.push("/messages");
          }}
          style={[styles.toast, { top: insets.top + 8 }]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
