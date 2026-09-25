import { Alert, AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import type { NotificationPermissionsStatus } from "expo-notifications";
import {
  clearNotificationFocus,
  registerPushToken,
  setNotificationFocus,
  unregisterPushToken,
} from "../api/notifications";
import { getAuthToken } from "../storage/session";
import { isPushFocused } from "./pushFocus";
import {
  getNotificationsModule,
  type NotificationsModule,
} from "../utils/optionalNativeModules";

const STORED_TOKEN_KEY = "joscity.expoPushToken";
const INSTALL_ID_KEY = "joscity.installationId";
const PERMISSION_ASKED_KEY = "joscity.pushPermissionAsked";
const CHANNELS_SOUND_KEY = "joscity.androidChannels.sound.v4";

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

export async function configurePushNotifications(): Promise<void> {
  if (configured || Platform.OS === "web") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as {
        kind?: string;
        type?: string;
        screen?: string;
        entityId?: string | number;
        eventId?: string | number;
        alarm?: boolean | string;
        notificationType?: string;
      } | undefined;
      const scheduledLive = data?.kind === "scheduled_post_published";
      const alarm =
        data?.alarm === true ||
        data?.alarm === "true" ||
        data?.notificationType === "danger";
      const inForeground = AppState.currentState === "active";
      const viewingThread =
        inForeground && data?.screen === "messages" && isPushFocused("messages", data.entityId);
      const key = data?.eventId ? pushDedupeKey(data) : notification.request.identifier;
      const duplicate = wasPresented(key);
      if (!duplicate) markPresented(key);
      const suppressBanner = (scheduledLive && inForeground) || viewingThread || duplicate;
      return {
        shouldShowBanner: !suppressBanner,
        shouldShowList: !duplicate,
        shouldPlaySound: alarm ? !inForeground && !duplicate : !suppressBanner,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
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
  const channels = [
    { id: "messages", name: "Messages", importance: Notifications.AndroidImportance.HIGH, sound: "default" as const },
    { id: "notifications", name: "Notifications", importance: Notifications.AndroidImportance.HIGH, sound: "default" as const },
    { id: "rides", name: "Rides", importance: Notifications.AndroidImportance.MAX, sound: "default" as const },
    { id: "payments", name: "Payments", importance: Notifications.AndroidImportance.HIGH, sound: "default" as const },
    { id: "default", name: "JosCity", importance: Notifications.AndroidImportance.HIGH, sound: "default" as const },
    {
      id: "alerts",
      name: "Joscity alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "alarm.wav",
      vibrationPattern: [0, 400, 200, 400, 200, 800] as number[],
    },
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
      sound: channel.sound,
      vibrationPattern: "vibrationPattern" in channel ? channel.vibrationPattern : soundAndVibrate.vibrationPattern,
    });
  }
  if (rebuilt !== "1") {
    await AsyncStorage.setItem(CHANNELS_SOUND_KEY, "1");
  }
}

function isGranted(
  status: NotificationPermissionsStatus,
  Notifications: NotificationsModule
): boolean {
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

async function explainThenRequest(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
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
            resolve(isGranted(next, Notifications));
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
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  await ensureAndroidChannels();

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current, Notifications)) return true;

  const canAsk = current.canAskAgain !== false;
  if (!canAsk || current.status === "denied") {
    await markPermissionAsked();
    return false;
  }
  if (await permissionAsked()) return false;
  return explainThenRequest();
}

export async function activatePushNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await configurePushNotifications();
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  await ensureAndroidChannels();
  await listenForTokenChanges();
  await markPermissionAsked();

  let current = await Notifications.getPermissionsAsync();
  if (!isGranted(current, Notifications) && current.canAskAgain !== false && current.status !== "denied") {
    current = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (!isGranted(current, Notifications)) return false;
  if (!(await getAuthToken())) return true;
  const token = await getExpoPushToken();
  if (token) await syncTokenWithApi(token);
  return true;
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
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  return isGranted(current, Notifications);
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;
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
  const registered = await registerPushToken({
    token,
    platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
    installationId,
    appVersion: appVersion(),
  });
  if (!registered) throw new Error("Push token registration failed");
}

async function listenForTokenChanges(): Promise<void> {
  if (tokenListener || Platform.OS === "web") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  tokenListener = Notifications.addPushTokenListener(() => {
    // This event contains an APNs/FCM token, not an Expo push token.
    // Resolve the Expo token again before registering it with our Expo endpoint.
    void registerPushTokenAfterLogin();
  });
}

export async function bootstrapPushNotifications(): Promise<void> {
  if (Platform.OS === "web" || !(await getAuthToken())) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await configurePushNotifications();
    await listenForTokenChanges();
    const granted = await requestPushPermissionOnLaunch();
    if (!granted) return;
    const token = await getExpoPushToken();
    if (token) await syncTokenWithApi(token);
  })().catch(() => {
    console.warn("Push registration failed; it will retry when the app resumes or reconnects.");
  }).finally(() => { bootstrapPromise = null; });

  return bootstrapPromise;
}

export async function registerPushTokenAfterLogin(): Promise<void> {
  if (Platform.OS === "web") return;
  await bootstrapPushNotifications();
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
