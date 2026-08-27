import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Audio, ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useI18n } from "../../i18n/I18nProvider";
import { playableVideoUrl } from "../../utils/media";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
};

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function unloadQuietly(player: Video | null) {
  if (!player) return;
  try {
    await player.stopAsync();
  } catch {
    // Native view may already be gone.
  }
  try {
    await player.unloadAsync();
  } catch {
    // Native view may already be gone.
  }
}

function VideoSeekBar({
  positionMs,
  durationMs,
  onSeek,
  onSeekEnd,
  compact,
}: {
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  onSeekEnd?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const trackRef = useRef<View>(null);
  const trackW = useRef(0);
  const trackX = useRef(0);
  const durationRef = useRef(durationMs);
  const onSeekRef = useRef(onSeek);
  const onSeekEndRef = useRef(onSeekEnd);
  const [width, setWidth] = useState(0);
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  durationRef.current = durationMs;
  onSeekRef.current = onSeek;
  onSeekEndRef.current = onSeekEnd;

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackX.current = x;
      trackW.current = w;
      setWidth(w);
    });
  };

  const seekFromEvent = (event: GestureResponderEvent) => {
    const span = trackW.current;
    const length = durationRef.current;
    if (span <= 0 || length <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.nativeEvent.pageX - trackX.current) / span));
    const ms = ratio * length;
    setScrubMs(ms);
    onSeekRef.current(ms);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        measureTrack();
        seekFromEvent(event);
      },
      onPanResponderMove: seekFromEvent,
      onPanResponderRelease: (event) => {
        seekFromEvent(event);
        setScrubMs(null);
        onSeekEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        setScrubMs(null);
        onSeekEndRef.current?.();
      },
    })
  ).current;

  const shown = scrubMs ?? positionMs;
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, shown / durationMs)) : 0;
  const fillW = width * progress;

  return (
    <View
      style={[styles.seekRow, compact && styles.seekRowCompact]}
      pointerEvents="box-none"
    >
      <Text style={[styles.time, compact && styles.timeCompact]}>{formatClock(shown)}</Text>
      <View
        ref={trackRef}
        onLayout={measureTrack}
        style={[styles.trackHit, compact && styles.trackHitCompact]}
        accessibilityRole="adjustable"
        accessibilityLabel={t("feed.videoProgress")}
        accessibilityValue={{
          min: 0,
          max: Math.round(durationMs / 1000),
          now: Math.round(shown / 1000),
        }}
        {...pan.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: fillW }]} />
          <View style={[styles.thumb, { left: Math.max(0, fillW - 7) }]} />
        </View>
      </View>
      <Text style={[styles.time, compact && styles.timeCompact]}>{formatClock(durationMs)}</Text>
    </View>
  );
}

export default function FeedVideo({ uri, style }: Props) {
  const playableUri = playableVideoUrl(uri);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const iconColor = "rgba(255,255,255,0.72)";
  const playerRef = useRef<Video>(null);
  const positionMillis = useRef(0);
  const scrubbing = useRef(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    setPlayerReady(false);
    const player = playerRef.current;
    return () => {
      void unloadQuietly(player);
    };
  }, [playableUri, fullscreen]);

  const openFullscreen = () => {
    const player = playerRef.current;
    const resume = !paused;
    setPaused(true);
    void unloadQuietly(player).finally(() => {
      setFullscreen(true);
      setPaused(!resume);
    });
  };

  const closeFullscreen = () => {
    const player = playerRef.current;
    void unloadQuietly(player).finally(() => setFullscreen(false));
  };

  const seekIfNeeded = () => {
    const player = playerRef.current;
    const ms = positionMillis.current;
    if (!player || ms <= 0) return;
    void player.setPositionAsync(ms).catch(() => undefined);
  };

  const seekTo = (ms: number) => {
    const length = durationMs || ms;
    const next = Math.min(Math.max(0, ms), Math.max(0, length));
    scrubbing.current = true;
    positionMillis.current = next;
    setPositionMs(next);
    void playerRef.current?.setPositionAsync(next).catch(() => undefined);
  };

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    positionMillis.current = status.positionMillis;
    if (status.durationMillis) setDurationMs(status.durationMillis);
    if (!scrubbing.current) setPositionMs(status.positionMillis);
  };

  const muteControl = (extraStyle?: StyleProp<ViewStyle>) => (
    <Pressable
      onPress={() => setMuted((value) => !value)}
      style={[styles.roundBtn, extraStyle]}
      accessibilityRole="button"
      accessibilityLabel={muted ? t("feed.unmute") : t("feed.mute")}
    >
      <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color={iconColor} />
    </Pressable>
  );

  const player = (
    <Video
      ref={playerRef}
      source={{ uri: playableUri }}
      style={StyleSheet.absoluteFill}
      resizeMode={fullscreen ? ResizeMode.CONTAIN : ResizeMode.COVER}
      shouldPlay={!paused && playerReady}
      isLooping
      isMuted={muted}
      useNativeControls={false}
      progressUpdateIntervalMillis={250}
      onReadyForDisplay={() => {
        setPlayerReady(true);
        seekIfNeeded();
      }}
      onPlaybackStatusUpdate={onStatus}
    />
  );

  const seekBar = (compact?: boolean) => (
    <VideoSeekBar
      positionMs={positionMs}
      durationMs={durationMs}
      onSeek={seekTo}
      onSeekEnd={() => {
        scrubbing.current = false;
      }}
      compact={compact}
    />
  );

  return (
    <View style={[styles.wrap, style]}>
      {fullscreen ? null : player}
      <Pressable
        onPress={() => setPaused((value) => !value)}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={paused ? t("feed.playVideo") : t("feed.pauseVideo")}
      />
      {paused ? (
        <View style={styles.play} pointerEvents="none">
          <Ionicons name="play" size={42} color="#FFFFFF" />
        </View>
      ) : null}
      {muteControl(styles.muteBtn)}
      <View style={styles.inlineSeek} pointerEvents="box-none">
        {seekBar(true)}
      </View>
      <View style={styles.topRight} pointerEvents="box-none">
        <Pressable
          onPress={openFullscreen}
          style={styles.roundBtn}
          accessibilityRole="button"
          accessibilityLabel={t("feed.fullscreen")}
        >
          <Ionicons name="expand" size={18} color={iconColor} />
        </Pressable>
      </View>

      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
        onRequestClose={closeFullscreen}
      >
        <View style={styles.fullRoot}>
          {fullscreen ? player : null}
          <Pressable
            onPress={() => setPaused((value) => !value)}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={paused ? t("feed.playVideo") : t("feed.pauseVideo")}
          />
          {paused ? (
            <View style={styles.play} pointerEvents="none">
              <Ionicons name="play" size={54} color="#FFFFFF" />
            </View>
          ) : null}
          {muteControl([
            styles.muteBtn,
            { bottom: 62 + insets.bottom, left: 14 + insets.left },
          ])}
          <View
            style={[
              styles.fullSeek,
              {
                paddingBottom: 14 + insets.bottom,
                paddingLeft: 14 + insets.left,
                paddingRight: 14 + insets.right,
              },
            ]}
            pointerEvents="box-none"
          >
            {seekBar(false)}
          </View>
          <View
            style={[
              styles.topRight,
              { top: insets.top + 10 + windowHeight * 0.05, right: 14 + insets.right },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={closeFullscreen}
              style={styles.roundBtn}
              accessibilityRole="button"
              accessibilityLabel={t("feed.exitFullscreen")}
            >
              <Ionicons name="close" size={18} color={iconColor} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  muteBtn: {
    position: "absolute",
    bottom: 36,
    left: 10,
    zIndex: 2,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullRoot: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineSeek: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 6,
    zIndex: 3,
  },
  fullSeek: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  seekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  seekRowCompact: {
    gap: 6,
  },
  time: {
    minWidth: 36,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
    fontVariant: ["tabular-nums"],
  },
  timeCompact: {
    minWidth: 30,
    fontSize: 10,
  },
  trackHit: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  trackHitCompact: {
    height: 20,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.32)",
    overflow: "visible",
    justifyContent: "center",
  },
  trackFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    top: -5.5,
  },
});
