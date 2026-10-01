import { Platform } from "react-native";
import { AppAlert } from "../components/AppDialog";
import { Directory, File, Paths } from "expo-file-system";
import { absoluteUrl } from "./format";
import { isExpoGo } from "./optionalNativeModules";

function extensionFromUrl(url: string): string {
  const clean = url.split("?")[0] || "";
  const match = clean.match(/\.(jpe?g|png|webp|gif|heic)$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

function isLocalUri(url: string): boolean {
  return /^(file|content|ph|assets-library):/i.test(url);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Please try again.";
}

function permissionGranted(permission: {
  granted?: boolean;
  status?: string;
  accessPrivileges?: string;
}): boolean {
  return (
    permission.granted === true ||
    permission.status === "granted" ||
    permission.accessPrivileges === "all" ||
    permission.accessPrivileges === "limited"
  );
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
  if (!downloaded.uri || !downloaded.exists || downloaded.size <= 0) {
    throw new Error("Download failed");
  }
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

async function localCopy(url: string): Promise<string> {
  if (isLocalUri(url)) return url;
  try {
    return await downloadToCache(url);
  } catch {
    return downloadWithLegacy(url);
  }
}

async function ensureGalleryPermission(): Promise<boolean> {
  const MediaLibrary = await import("expo-media-library");
  // Write access is what gallery save needs. A full library read prompt on
  // Android 13+ can be granted without allowing the app to add a photo.
  let permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permissionGranted(permission)) {
    permission = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  }
  return permissionGranted(permission);
}

async function writeToGallery(localUri: string): Promise<void> {
  const failures: string[] = [];

  try {
    const { Asset } = await import("expo-media-library");
    await Asset.create(localUri);
    return;
  } catch (error) {
    failures.push(errorMessage(error));
  }

  try {
    const legacy = await import("expo-media-library/legacy");
    await legacy.saveToLibraryAsync(localUri);
    return;
  } catch (error) {
    failures.push(errorMessage(error));
  }

  const useful = failures.find((message) => !/deprecated|legacy method/i.test(message));
  throw new Error(useful || "Could not add this image to your photos.");
}

export async function saveRemoteImage(url: string): Promise<boolean> {
  const resolved = absoluteUrl(url) || String(url || "").trim();
  if (!resolved) return false;

  if (Platform.OS === "web") {
    return downloadOnWeb(resolved);
  }

  if (isExpoGo()) {
    AppAlert.alert(
      "Development build required",
      "Saving images is unavailable in Expo Go. Install the latest JosCity development build."
    );
    return false;
  }

  try {
    await import("expo-media-library");
  } catch {
    AppAlert.alert(
      "Development build required",
      "Saving images is unavailable in this Expo client. Install the latest JosCity development build."
    );
    return false;
  }

  const allowed = await ensureGalleryPermission();
  if (!allowed) {
    AppAlert.alert("Permission needed", "Allow photo access to save this image.");
    return false;
  }

  let localUri: string;
  try {
    localUri = await localCopy(resolved);
  } catch (error) {
    AppAlert.alert("Could not save", errorMessage(error));
    return false;
  }

  try {
    await writeToGallery(localUri);
  } catch (error) {
    AppAlert.alert("Could not save", errorMessage(error));
    return false;
  }
  return true;
}
