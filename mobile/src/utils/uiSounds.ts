import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

let player: ReturnType<typeof createAudioPlayer> | null = null;
let loading: Promise<void> | null = null;

async function ensurePlayer() {
  if (player) return player;
  if (!loading) {
    loading = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
        shouldRouteThroughEarpiece: false,
      });
      player = createAudioPlayer(require("../../assets/sounds/friend-request.wav"));
      player.volume = 0.7;
    })().catch(() => {
      loading = null;
    });
  }
  await loading;
  return player;
}

export function playFriendRequestSound() {
  void (async () => {
    const next = await ensurePlayer();
    if (!next) return;
    try {
      next.volume = 0.7;
      await next.seekTo(0);
      next.play();
    } catch {
      try {
        next.currentTime = 0;
        next.play();
      } catch {
        // Sound is optional.
      }
    }
  })();
}

let alarmPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let alarmLoading: Promise<void> | null = null;

async function ensureAlarm() {
  if (alarmPlayer) return alarmPlayer;
  if (!alarmLoading) {
    alarmLoading = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
        shouldRouteThroughEarpiece: false,
      });
      alarmPlayer = createAudioPlayer(require("../../assets/sounds/alarm.wav"));
      alarmPlayer.volume = 1;
    })().catch(() => {
      alarmLoading = null;
    });
  }
  await alarmLoading;
  return alarmPlayer;
}

export function playAlarmSound() {
  void (async () => {
    const next = await ensureAlarm();
    if (!next) return;
    try {
      next.volume = 1;
      await next.seekTo(0);
      next.play();
    } catch {
      try {
        next.currentTime = 0;
        next.play();
      } catch {
        // Alarm is optional when the file is unavailable.
      }
    }
  })();
}
