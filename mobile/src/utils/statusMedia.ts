import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { StoryMediaFile } from "../api/stories";

export const MAX_STATUS_PHOTOS = 10;
export const MAX_STATUS_VIDEOS = 5;
export const MAX_STATUS_VIDEO_SECONDS = 60;

export function videoDurationSeconds(duration?: number | null): number {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return duration >= 1000 ? duration / 1000 : duration;
}

export type PickStatusMediaResult =
  | { ok: true; items: StoryMediaFile[] }
  | { ok: false; reason: "permission" | "canceled" | "too-long" };

export async function pickStatusMedia(
  kind: "photo" | "video",
  alreadySelected = 0
): Promise<PickStatusMediaResult> {
  const limit = kind === "photo" ? MAX_STATUS_PHOTOS : MAX_STATUS_VIDEOS;
  const remaining = Math.max(0, limit - alreadySelected);
  if (remaining <= 0) {
    return { ok: false, reason: "canceled" };
  }

  try {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      // Skip recompression so picking returns immediately.
      quality: 1,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Current,
      // Expo Go on Android cannot grant full media-library access; the legacy picker still works.
      legacy: Platform.OS === "android",
    });

    if (picked.canceled || !picked.assets?.length) {
      return { ok: false, reason: "canceled" };
    }

    const assets = picked.assets.filter((asset) => {
      const mime = String(asset.mimeType || "").toLowerCase();
      const assetType = String(asset.type || "").toLowerCase();
      if (kind === "photo") {
        return assetType !== "video" && !mime.startsWith("video");
      }
      return assetType === "video" || mime.startsWith("video") || !mime.startsWith("image");
    });

    if (!assets.length) {
      return { ok: false, reason: "canceled" };
    }

    if (kind === "video") {
      const tooLong = assets.some(
        (asset) => videoDurationSeconds(asset.duration) > MAX_STATUS_VIDEO_SECONDS
      );
      if (tooLong) {
        return { ok: false, reason: "too-long" };
      }
    }

    return {
      ok: true,
      items: assets.slice(0, remaining).map((asset) => ({
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
      })),
    };
  } catch {
    return { ok: false, reason: "permission" };
  }
}
