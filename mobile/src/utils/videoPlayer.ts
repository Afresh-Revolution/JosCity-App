type VideoLike = {
  play?: () => void;
  pause?: () => void;
  muted?: boolean;
  loop?: boolean;
  currentTime?: number;
  duration?: number;
  status?: string;
};

/** expo-video throws if play/pause run after the native SharedObject is released. */
export function runVideoPlayer(player: VideoLike | null | undefined, fn: (player: VideoLike) => void) {
  if (!player) return;
  try {
    fn(player);
  } catch {
    // Native player already released on unmount or source replace.
  }
}
