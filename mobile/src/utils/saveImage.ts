import { Alert, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { absoluteUrl } from "./format";
import { isExpoGo } from "./optionalNativeModules";

function extensionFromUrl(url: string): string {
  const clean = url.split("?")[0] || "";
  const match = clean.match(/\.(jpe?g|png|webp|gif|heic)$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

function downloadOnWeb(url: string): boolean {
  if (typeof document === "undefined") return false;
  const link = document.createElement("a");
  link.href = url;
  link.download = `joscity-image${extensionFromUrl(url)}`;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

async function downloadToCache(url: string): Promise<string> {
  const dir = new Directory(Paths.cache, "joscity-image-saves");
  if (!dir.exists) {
    dir.create();
  }
  const dest = new File(dir, `save-${Date.now()}${extensionFromUrl(url)}`);
  const downloaded = await File.downloadFileAsync(url, dest, { idempotent: true });
  return downloaded.uri;
}

async function downloadWithLegacy(url: string): Promise<string> {
  const legacy = await import("expo-file-system/legacy");
  const ext = extensionFromUrl(url);
  const target = `${legacy.cacheDirectory}joscity-save-${Date.now()}${ext}`;
  const result = await legacy.downloadAsync(url, target);
  if (!result?.uri) throw new Error("Download failed");
  return result.uri;
}

export async function saveRemoteImage(url: string): Promise<boolean> {
  const resolved = absoluteUrl(url) || String(url || "").trim();
  if (!resolved) return false;

  if (Platform.OS === "web") {
    return downloadOnWeb(resolved);
  }

  if (isExpoGo()) {
    Alert.alert(
      "Development build required",
      "Saving images is unavailable in Expo Go. Install the latest JosCity development build."
    );
    return false;
  }

  let MediaLibrary: typeof import("expo-media-library");
  try {
    MediaLibrary = await import("expo-media-library");
  } catch {
    Alert.alert(
      "Development build required",
      "Saving images is unavailable in this Expo client. Install the latest JosCity development build."
    );
    return false;
  }

  let permission = await MediaLibrary.requestPermissionsAsync();
  if (permission.status !== "granted" && permission.accessPrivileges !== "limited") {
    permission = await MediaLibrary.requestPermissionsAsync(true);
  }
  if (permission.status !== "granted" && permission.accessPrivileges !== "limited") {
    Alert.alert("Permission needed", "Allow photo access to save this image.");
    return false;
  }

  let localUri: string;
  try {
    localUri = await downloadToCache(resolved);
  } catch {
    try {
      localUri = await downloadWithLegacy(resolved);
    } catch (error) {
      Alert.alert(
        "Could not save",
        error instanceof Error ? error.message : "Please try again."
      );
      return false;
    }
  }

  try {
    await MediaLibrary.saveToLibraryAsync(localUri);
  } catch {
    await MediaLibrary.createAssetAsync(localUri);
  }
  return true;
}
