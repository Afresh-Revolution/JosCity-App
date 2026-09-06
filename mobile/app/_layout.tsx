import "react-native-gesture-handler";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { hydrateStoryCache } from "../src/storage/storyMediaCache";
import { bootstrapPushNotifications, configurePushNotifications, unregisterPushTokenOnLogout } from "../src/push/pushNotifications";
import { openRatingPrompt } from "../src/state/ratingPrompt";
import { resolvePushRoute, pushRateOrderId, type PushPayload } from "../src/push/pushRoute";
import { setUnauthorizedHandler } from "../src/api/client";
import { clearSession } from "../src/storage/session";
import { colors } from "../src/theme/colors";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { NoticeHost } from "../src/components/AppNotice";
import RatingPromptHost from "../src/components/RatingPromptHost";
import { startScheduledPostNoticeWatcher } from "../src/state/scheduledPostNotice";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configurePushNotifications();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.splashBackground).catch(
      () => undefined
    );
  }, []);

  const onReady = useCallback(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    if (!fontsLoaded || Platform.OS === "web") return;
    void hydrateStoryCache();
    const timer = setTimeout(() => {
      void bootstrapPushNotifications();
    }, 600);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;
    return startScheduledPostNoticeWatcher();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <ThemedRoot />
            <NoticeHost />
            <RatingPromptHost />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedRoot() {
  const { colors: palette, scheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await unregisterPushTokenOnLogout();
      await clearSession();
      router.replace("/welcome");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <NotificationTapRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: palette.background },
        }}
      />
    </>
  );
}

function NotificationTapRouter() {
  const router = useRouter();
  const last = Notifications.useLastNotificationResponse();
  const seen = useRef<string | undefined>(undefined);

  const openPayload = useCallback(
    (data?: PushPayload) => {
      const rateOrderId = pushRateOrderId(data);
      if (rateOrderId > 0) {
        openRatingPrompt(rateOrderId);
      }
      const href = resolvePushRoute(data);
      if (!href) return;
      router.push(href as never);
    },
    [router]
  );

  useEffect(() => {
    if (!last) return;
    const key = last.notification.request.identifier;
    if (seen.current === key) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    seen.current = key;
    openPayload(last.notification.request.content.data as PushPayload | undefined);
  }, [last, openPayload]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const key = response.notification.request.identifier;
      if (seen.current === key) return;
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      seen.current = key;
      openPayload(response.notification.request.content.data as PushPayload | undefined);
    });
    return () => sub.remove();
  }, [openPayload]);

  return null;
}
