import "react-native-gesture-handler";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Platform, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import type { NotificationResponse } from "expo-notifications";
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
import {
  getNetworkOnline,
  pingApi,
  setUnauthorizedHandler,
  subscribeNetworkOnline,
} from "../src/api/client";
import { clearSession } from "../src/storage/session";
import { colors } from "../src/theme/colors";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { NoticeHost } from "../src/components/AppNotice";
import RatingPromptHost from "../src/components/RatingPromptHost";
import { startScheduledPostNoticeWatcher } from "../src/state/scheduledPostNotice";
import { startForegroundInterval } from "../src/utils/foregroundInterval";
import { getNotificationsModule } from "../src/utils/optionalNativeModules";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configurePushNotifications();

export const unstable_settings = {
  initialRouteName: "index",
};

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
    const resumed = AppState.addEventListener("change", state => {
      if (state === "active") void bootstrapPushNotifications();
    });
    const unsubscribe = subscribeNetworkOnline(online => {
      if (online && AppState.currentState === "active") void bootstrapPushNotifications();
    });
    const stopRetry = startForegroundInterval(() => void bootstrapPushNotifications(), 60000);
    return () => { clearTimeout(timer); resumed.remove(); unsubscribe(); stopRetry(); };
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
  const [online, setOnline] = useState(getNetworkOnline);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await unregisterPushTokenOnLogout();
      await clearSession();
      router.replace("/welcome");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => subscribeNetworkOnline(setOnline), []);

  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => void pingApi(), 10000);
    return () => clearInterval(timer);
  }, [online]);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <NotificationTapRouter />
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          Keyboard.dismiss();
          return false;
        }}
      >
        {!online ? (
          <View
            style={{
              backgroundColor: palette.primary,
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: palette.white,
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 12,
              }}
            >
              Offline — showing saved content
            </Text>
          </View>
        ) : null}
        <Stack
          initialRouteName="index"
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="messages/[id]"
            options={{ gestureEnabled: false }}
          />
        </Stack>
      </View>
    </>
  );
}

function NotificationTapRouter() {
  const router = useRouter();
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
    let active = true;
    let sub: { remove: () => void } | null = null;

    const handleResponse = (response: NotificationResponse | null) => {
      if (!active || !response) return;
      const key = response.notification.request.identifier;
      if (seen.current === key) return;
      void getNotificationsModule().then((notifications) => {
        if (!active || !notifications) return;
        // The startup lookup and live listener can deliver the same tap together.
        if (seen.current === key) return;
        if (response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
        seen.current = key;
        openPayload(response.notification.request.content.data as PushPayload | undefined);
        // Expo retains this response across reloads until it is explicitly consumed.
        void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }).catch(() => undefined);
    };

    void getNotificationsModule().then((notifications) => {
      if (!active || !notifications) return;
      sub = notifications.addNotificationResponseReceivedListener(handleResponse);
      void notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      active = false;
      sub?.remove();
    };
  }, [openPayload]);

  return null;
}
