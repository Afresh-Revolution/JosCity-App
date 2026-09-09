import Constants from "expo-constants";
import { Platform } from "react-native";

export type NotificationsModule = typeof import("expo-notifications");

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

export function isExpoGo(): boolean {
  return (
    Constants.appOwnership === "expo" ||
    String(Constants.executionEnvironment || "").toLowerCase() === "storeclient"
  );
}

export function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web" || isExpoGo()) return Promise.resolve(null);
  if (!notificationsPromise) {
    notificationsPromise = import("expo-notifications").catch(() => null);
  }
  return notificationsPromise;
}
