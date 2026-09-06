import { Alert, AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  clearNotificationFocus,
  registerPushToken,
  setNotificationFocus,
  unregisterPushToken,
} from "../api/notifications";
import { getAuthToken } from "../storage/session";
import { isPushFocused } from "./pushFocus";

const STORED_TOKEN_KEY = "joscity.expoPushToken";
const INSTALL_ID_KEY = "joscity.installationId";
const PERMISSION_ASKED_KEY = "joscity.pushPermissionAsked";
const CHANNELS_SOUND_KEY = "joscity.androidChannels.sound.v3";

const presentedAt = new Map<string, number>();
const PRESENTED_TTL_MS = 45_000;

function prunePresented(now = Date.now()) {
  for (const [key, at] of presentedAt) {
    if (now - at > PRESENTED_TTL_MS) presentedAt.delete(key);
  }
}

function pushDedupeKey(data?: {
  eventId?: string | number;
  type?: string;
  screen?: string;
  entityId?: string | number;
} | null): string {
  if (!data) return "";
  const eventId = String(data.eventId || "").trim();
  if (eventId) return eventId;
  const type = String(data.type || "").trim();
  const screen = String(data.screen || "").trim();
  const entityId = String(data.entityId || "").trim();
  if (!type && !screen && !entityId) return "";
  return `${type}:${screen}:${entityId}`;
}

function markPresented(key: string) {
  if (!key) return;
  prunePresented();
  presentedAt.set(key, Date.now());
}

function wasPresented(key: string): boolean {
  if (!key) return false;
  prunePresented();
  return presentedAt.has(key);
}

let configured = false;
let bootstrapPromise: Promise<void> | null = null;
let tokenListener: { remove: () => void } | null = null;

function easProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

function appVersion(): string {
  return String(
    Constants.expoConfig?.version ||
      Constants.nativeAppVersion ||
      "1.0.0"
  );
}

function newInstallationId(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getInstallationId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const created = newInstallationId();
    await AsyncStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return newInstallationId();
  }
}

export function configurePushNotifications(): void {
  if (configured || Platform.OS === "web") return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as {
        kind?: string;
        type?: string;
        screen?: string;
        entityId?: string | number;
        eventId?: string | number;
      } | undefined;
      const scheduledLive = data?.kind === "scheduled_post_published";
      const inForeground = AppState.currentState === "active";
      const viewingThread =
        data?.screen === "messages" && isPushFocused("messages", data.entityId);
      const key = pushDedupeKey(data);
      const duplicate = wasPresented(key);
      if (!duplicate) markPresented(key);
      const suppressBanner = (scheduledLive && inForeground) || viewingThread || duplicate;
      return {
        shouldShowBanner: !suppressBanner,
        shouldShowList: !duplicate,
        shouldPlaySound: !suppressBanner,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  const soundAndVibrate = {
    vibrationPattern: [0, 250, 250, 250] as number[],
    lightColor: "#0F3D26",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    sound: "default" as const,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  };
  const channels: Array<{
    id: string;
    name: string;
    importance: Notifications.AndroidImportance;
  }> = [
    { id: "messages", name: "Messages", importance: Notifications.AndroidImportance.HIGH },
    { id: "notifications", name: "Notifications", importance: Notifications.AndroidImportance.HIGH },
    { id: "rides", name: "Rides", importance: Notifications.AndroidImportance.MAX },
    { id: "payments", name: "Payments", importance: Notifications.AndroidImportance.HIGH },
    { id: "default", name: "JosCity", importance: Notifications.AndroidImportance.HIGH },
  ];
  const rebuilt = await AsyncStorage.getItem(CHANNELS_SOUND_KEY);
  for (const channel of channels) {
    if (rebuilt !== "1") {
      await Notifications.deleteNotificationChannelAsync(channel.id).catch(() => undefined);
    }
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      importance: channel.importance,
      ...soundAndVibrate,
    });
  }
  if (rebuilt !== "1") {
    await AsyncStorage.setItem(CHANNELS_SOUND_KEY, "1");
  }
}

function isGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function permissionAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PERMISSION_ASKED_KEY)) === "1";
  } catch {
    return false;
  }
}

async function markPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "1");
  } catch {
    // ignore
  }
}

function explainThenRequest(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Stay up to date",
      "JOSCITY uses notifications for messages, orders, payments and account updates, including when the app is closed.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => {
            void markPermissionAsked();
            resolve(false);
          },
        },
        {
          text: "Allow",
          onPress: async () => {
            await markPermissionAsked();
            const next = await Notifications.requestPermissionsAsync({
              ios: { allowAlert: true, allowBadge: true, allowSound: true },
            });
            resolve(isGranted(next));
          },
        },
      ]
    );
  });
}

/**
 * Asks once after explaining why. Denied users are not prompted again;
 * they can enable notifications from Settings.
 */
export async function requestPushPermissionOnLaunch(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await ensureAndroidChannels();

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;

  const canAsk = current.canAskAgain !== false;
  if (!canAsk || current.status === "denied") {
    await markPermissionAsked();
    return false;
  }
  if (await permissionAsked()) return false;
  return explainThenRequest();
}

export async function openSystemNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Settings may be unavailable on some emulators.
  }
}

export async function getNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  return isGranted(current);
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
    return storedPushToken();
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
  const installationId = await getInstallationId();
  await registerPushToken({
    token,
    platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
    installationId,
    appVersion: appVersion(),
  });
}

function listenForTokenChanges(): void {
  if (tokenListener || Platform.OS === "web") return;
  tokenListener = Notifications.addPushTokenListener((event) => {
    const token = String(event.data || "").trim();
    if (!token) return;
    void AsyncStorage.setItem(STORED_TOKEN_KEY, token);
    void syncTokenWithApi(token);
  });
}

export async function bootstrapPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    configurePushNotifications();
    listenForTokenChanges();
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
    listenForTokenChanges();
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
    const installationId = await getInstallationId();
    await clearNotificationFocus();
    await unregisterPushToken({ token, installationId });
  } catch {
    // Logout should still complete.
  }
}

export async function reportPushFocus(
  screen: string,
  entityId?: string | number | null
): Promise<void> {
  try {
    await setNotificationFocus(screen, entityId);
  } catch {
    // Focus is best-effort.
  }
}

export async function reportPushFocusCleared(): Promise<void> {
  try {
    await clearNotificationFocus();
  } catch {
    // Focus is best-effort.
  }
}
