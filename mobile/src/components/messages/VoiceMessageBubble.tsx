import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

type Props = {
  uri: string;
  duration?: number;
  mine?: boolean;
  playing: boolean;
  onToggle: () => void;
  onFinished: () => void;
};

export default function VoiceMessageBubble({
  uri,
  duration = 0,
  mine,
  playing,
  onToggle,
  onFinished,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const player = useAudioPlayer(uri || null);
  const status = useAudioPlayerStatus(player);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!player) return;
    if (!playing) {
      try {
        player.pause();
      } catch {
        // Ignore.
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const atEnd =
          player.duration > 0 && player.currentTime >= Math.max(0, player.duration - 0.2);
        if (atEnd) await player.seekTo(0);
        if (!cancelled) player.play();
      } catch {
        // Playback is optional if the file is missing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, playing]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    void player.seekTo(0).catch(() => undefined);
    onFinishedRef.current();
  }, [player, status.didJustFinish]);

  const length = status.duration > 0 ? status.duration : duration;
  const elapsed = playing ? status.currentTime : 0;
  const progress = length > 0 ? Math.min(1, elapsed / length) : 0;

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, mine && styles.rowMine]}
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause voice message" : "Play voice message"}
    >
      <View style={[styles.play, mine ? styles.playMine : styles.playTheirs]}>
        <Ionicons
          name={playing ? "pause" : "play"}
          size={16}
          color={mine ? colors.primary : colors.white}
        />
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, mine && styles.barMine]}>
          <View
            style={[
              styles.fill,
              mine ? styles.fillMine : styles.fillTheirs,
              { width: `${Math.max(8, progress * 100)}%` },
            ]}
          />
        </View>
        <Text style={[styles.time, mine && styles.timeMine]}>
          {formatDuration(playing && elapsed > 0 ? elapsed : length)}
        </Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      minWidth: 168,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rowMine: {},
    play: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    playMine: {
      backgroundColor: colors.white,
    },
    playTheirs: {
      backgroundColor: colors.primary,
    },
    track: {
      flex: 1,
      minWidth: 110,
    },
    bar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(15,61,38,0.18)",
      overflow: "hidden",
    },
    barMine: {
      backgroundColor: "rgba(255,255,255,0.28)",
    },
    fill: {
      height: 4,
      borderRadius: 2,
    },
    fillMine: {
      backgroundColor: colors.white,
    },
    fillTheirs: {
      backgroundColor: colors.primary,
    },
    time: {
      marginTop: 6,
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
    },
    timeMine: {
      color: "rgba(255,255,255,0.86)",
    },
  });
}
