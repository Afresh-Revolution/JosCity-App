import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken, unregisterPushToken } from "../api/notifications";
import { getAuthToken } from "../storage/session";

const STORED_TOKEN_KEY = "joscity.expoPushToken";

let configured = false;
let bootstrapPromise: Promise<void> | null = null;

function easProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

export function configurePushNotifications(): void {
  if (configured || Platform.OS === "web") return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { kind?: string } | undefined;
      const scheduledLive = data?.kind === "scheduled_post_published";
      const inForeground = AppState.currentState === "active";
      return {
        shouldShowBanner: !(scheduledLive && inForeground),
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "JosCity",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0F3D26",
    enableVibrate: true,
    showBadge: true,
  });
}

function isGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Shows the system permission dialog on first install / first open
 * (status is still undetermined). Later launches skip the dialog.
 */
export async function requestPushPermissionOnLaunch(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;

  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return isGranted(next);
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const projectId = easProjectId();
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = String(result?.data || "").trim();
    if (!token) return null;
    await AsyncStorage.setItem(STORED_TOKEN_KEY, token);
    return token;
  } catch {
    return AsyncStorage.getItem(STORED_TOKEN_KEY);
  }
}

async function storedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORED_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function syncTokenWithApi(token: string): Promise<void> {
  if (!(await getAuthToken())) return;
  await registerPushToken(token, Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown");
}

export async function bootstrapPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    configurePushNotifications();
    const granted = await requestPushPermissionOnLaunch();
    if (!granted) return;
    const token = await getExpoPushToken();
    if (token) await syncTokenWithApi(token);
  })().catch(() => undefined);

  return bootstrapPromise;
}

export async function registerPushTokenAfterLogin(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    configurePushNotifications();
    const granted = await requestPushPermissionOnLaunch();
    if (!granted) return;
    const token = (await getExpoPushToken()) || (await storedPushToken());
    if (token) await syncTokenWithApi(token);
  } catch {
    // Login should not fail because push registration failed.
  }
}

export async function unregisterPushTokenOnLogout(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await storedPushToken();
    await unregisterPushToken(token);
  } catch {
    // Logout should still complete.
  }
}
