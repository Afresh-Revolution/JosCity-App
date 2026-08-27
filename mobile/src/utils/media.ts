function mediaPath(url?: string | null) {
  return String(url || "").split("?")[0].toLowerCase();
}

const PLAYABLE_VIDEO_TRANSFORM = "f_mp4,vc_h264,ac_aac,q_auto";

export function isVideoUrl(url?: string | null, type?: string | null) {
  const path = mediaPath(url);
  if (
    /\.(mp4|mov|webm|m4v|3gp|avi)$/.test(path) ||
    /\/video\/upload\//.test(path)
  ) {
    return true;
  }
  const kind = String(type || "").toLowerCase();
  return kind.startsWith("video");
}

function alreadyTransformed(tail: string) {
  const first = tail.split("/")[0] || "";
  return (
    first.includes(",") ||
    /^(f_|q_|w_|h_|c_|vc_|ac_|so_|sp_|fl_|e_|b_|ar_|dpr_|g_)/.test(first)
  );
}

export function playableVideoUrl(url?: string | null): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";

  let candidate = trimmed;
  if (candidate.includes("/image/upload/")) {
    candidate = candidate.replace("/image/upload/", "/video/upload/");
  }

  const marker = "/video/upload/";
  const index = candidate.indexOf(marker);
  if (index === -1) return trimmed;

  const tail = candidate.slice(index + marker.length);
  if (alreadyTransformed(tail)) return candidate;
  return `${candidate.slice(0, index + marker.length)}${PLAYABLE_VIDEO_TRANSFORM}/${tail}`;
}

const THUMB_TRANSFORM = "so_0,w_320,h_320,c_fill,q_auto,f_jpg";

export function videoThumbnailUrl(url?: string | null): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";

  let candidate = trimmed;
  if (candidate.includes("/image/upload/")) {
    candidate = candidate.replace("/image/upload/", "/video/upload/");
  }

  const marker = "/video/upload/";
  const index = candidate.indexOf(marker);
  if (index === -1) return "";

  const tail = candidate.slice(index + marker.length);
  const rest = alreadyTransformed(tail) ? tail.split("/").slice(1).join("/") : tail;
  const withoutExt = rest.replace(/\.(mp4|mov|webm|m4v|3gp|avi)$/i, "");
  if (!withoutExt) return "";
  return `${candidate.slice(0, index + marker.length)}${THUMB_TRANSFORM}/${withoutExt}.jpg`;
}

export function isImageUrl(url?: string | null, type?: string | null) {
  if (isVideoUrl(url, type)) return false;
  const kind = String(type || "").toLowerCase();
  if (kind.startsWith("image") || kind === "photo") return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(mediaPath(url));
}
