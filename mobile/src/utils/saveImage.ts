import { Alert, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
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

export async function saveRemoteImage(url: string): Promise<boolean> {
  if (!url) return false;

  if (Platform.OS === "web") {
    return downloadOnWeb(url);
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

  const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  if (permission.status !== "granted") {
    Alert.alert("Permission needed", "Allow photo access to save this image.");
    return false;
  }

  const downloaded = await File.downloadFileAsync(
    url,
    new Directory(Paths.cache),
    { idempotent: true }
  );
  await MediaLibrary.saveToLibraryAsync(downloaded.uri);
  return true;
}
