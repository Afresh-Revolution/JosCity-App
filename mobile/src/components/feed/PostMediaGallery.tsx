import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { FeedPost } from "../../api/feed";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { saveRemoteImage } from "../../utils/saveImage";
import { videoThumbnailUrl } from "../../utils/media";
import { splitPostMedia } from "../../utils/postMedia";
import FeedImage from "./FeedImage";
import FeedVideo from "./FeedVideo";
import ImageSaveSheet from "./ImageSaveSheet";

type Props = {
  post: FeedPost;
  compact?: boolean;
};

const GRID_GAP = 2;

function snap(value: number) {
  return Platform.OS === "android" ? Math.floor(value) : Math.round(value);
}

export default function PostMediaGallery({ post, compact = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);
  const { images, videos } = useMemo(() => splitPostMedia(post), [post]);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const visibleImages = images.filter((uri) => !failed[uri]);

  if (!visibleImages.length && !videos.length) return null;

  return (
    <View style={styles.wrap} collapsable={false}>
      <ImageStrip
        uris={visibleImages}
        compact={compact}
        styles={styles}
        onImageError={(uri) => setFailed((current) => ({ ...current, [uri]: true }))}
      />
      <VideoStrip uris={videos} styles={styles} />
    </View>
  );
}

function ImageStrip({
  uris,
  compact,
  styles,
  onImageError,
}: {
  uris: string[];
  compact: boolean;
  styles: ReturnType<typeof makeStyles>;
  onImageError: (uri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boxW, setBoxW] = useState(() => snap(Math.max(0, screenW - 32)));
  if (!uris.length) return null;

  const useGrid = uris.length >= 4;
  const shown = useGrid ? uris.slice(0, 4) : uris;
  const remaining = useGrid ? Math.max(0, uris.length - 4) : 0;
  const viewerUri = viewerIndex !== null ? uris[viewerIndex] : null;
  const leftW = boxW > 0 ? snap((boxW - GRID_GAP) / 2) : 0;
  const rightW = boxW > 0 ? boxW - GRID_GAP - leftW : 0;
  const cellH = compact ? Math.min(leftW, 140) : leftW;

  const save = async () => {
    if (!viewerUri || saving) return;
    setSaving(true);
    try {
      const ok = await saveRemoteImage(viewerUri);
      setSaving(false);
      if (ok) {
        setMenu(false);
        Alert.alert("Saved", "Image saved to your photos.");
      }
    } catch {
      setSaving(false);
      Alert.alert("Could not save", "Please try again.");
    }
  };

  const tile = (uri: string, index: number, width: number, height: number, overlay?: number) => (
    <View
      collapsable={false}
      style={{ width, height, overflow: "hidden", position: "relative", backgroundColor: "#111111" }}
    >
      <FeedImage
        uri={uri}
        fit="cover"
        naturalAspect={false}
        blurRadius={overlay ? 8 : 0}
        style={{ width, height }}
        onPress={() => setViewerIndex(index)}
        onError={() => onImageError(uri)}
        accessibilityLabel={`Photo ${index + 1} of ${uris.length}`}
      />
      {overlay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${overlay} more photos`}
          onPress={() => setViewerIndex(index)}
          style={styles.overlay}
        >
          <Text style={styles.overlayText}>+{overlay}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View
      collapsable={false}
      onLayout={(event) => {
        const next = snap(event.nativeEvent.layout.width);
        if (next > 0 && next !== boxW) setBoxW(next);
      }}
    >
      {useGrid ? (
        boxW > 0 ? (
          <View style={{ width: boxW, gap: GRID_GAP }} collapsable={false}>
            <View style={{ flexDirection: "row", gap: GRID_GAP }} collapsable={false}>
              {tile(shown[0], 0, leftW, cellH)}
              {shown[1] ? tile(shown[1], 1, rightW, cellH) : <View style={{ width: rightW, height: cellH }} />}
            </View>
            <View style={{ flexDirection: "row", gap: GRID_GAP }} collapsable={false}>
              {shown[2] ? tile(shown[2], 2, leftW, cellH) : <View style={{ width: leftW, height: cellH }} />}
              {shown[3]
                ? tile(shown[3], 3, rightW, cellH, remaining || undefined)
                : <View style={{ width: rightW, height: cellH }} />}
            </View>
          </View>
        ) : (
          <View style={{ height: compact ? 220 : 280 }} />
        )
      ) : (
        <View style={styles.stack}>
          {shown.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.stackItem} collapsable={false}>
              <FeedImage
                uri={uri}
                fit="contain"
                naturalAspect
                style={styles.photo}
                onPress={uris.length > 1 ? () => setViewerIndex(index) : undefined}
                onError={() => onImageError(uri)}
                accessibilityLabel={`Photo ${index + 1} of ${uris.length}`}
              />
            </View>
          ))}
        </View>
      )}

      {viewerIndex !== null ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            setMenu(false);
            setViewerIndex(null);
          }}
        >
          <View style={styles.viewer}>
            {viewerUri ? (
              <Pressable
                onLongPress={() => setMenu(true)}
                delayLongPress={400}
                onPress={() => {
                  if (!menu) setViewerIndex(null);
                }}
                style={styles.viewerImageWrap}
              >
                <Image
                  source={{ uri: viewerUri }}
                  style={{ width: screenW, height: screenH }}
                  resizeMode="contain"
                />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => {
                setMenu(false);
                setViewerIndex(null);
              }}
              style={[styles.viewerClose, { top: Math.max(insets.top, 12) }]}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
            {uris.length > 1 ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  onPress={() => setViewerIndex((uris.length + viewerIndex - 1) % uris.length)}
                  style={[styles.viewerNav, styles.viewerNavLeft]}
                >
                  <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  onPress={() => setViewerIndex((viewerIndex + 1) % uris.length)}
                  style={[styles.viewerNav, styles.viewerNavRight]}
                >
                  <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                </Pressable>
                <Text style={[styles.viewerCount, { bottom: Math.max(insets.bottom, 16) }]}>
                  {viewerIndex + 1} / {uris.length}
                </Text>
              </>
            ) : null}
            <ImageSaveSheet
              visible={menu}
              embedded
              saving={saving}
              onSave={() => void save()}
              onClose={() => setMenu(false)}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function VideoStrip({
  uris,
  styles,
}: {
  uris: string[];
  styles: ReturnType<typeof makeStyles>;
}) {
  const [activeVideo, setActiveVideo] = useState(0);
  if (!uris.length) return null;
  return (
    <View style={styles.stack}>
      {uris.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.stackItem} collapsable={false}>
          {activeVideo === index ? (
            <FeedVideo uri={uri} style={styles.video} />
          ) : (
            <VideoThumb uri={uri} style={styles.video} onPress={() => setActiveVideo(index)} />
          )}
        </View>
      ))}
    </View>
  );
}

function VideoThumb({
  uri,
  style,
  onPress,
}: {
  uri: string;
  style: object;
  onPress: () => void;
}) {
  const thumb = videoThumbnailUrl(uri);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play video"
      onPress={onPress}
      style={[style, { overflow: "hidden", backgroundColor: "#111111", alignItems: "center", justifyContent: "center" }]}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="play" size={28} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette, compact: boolean) {
  const radius = compact ? 12 : 16;
  const videoHeight = compact ? 180 : 240;
  return StyleSheet.create({
    wrap: {
      marginBottom: compact ? 8 : 10,
      overflow: "hidden",
      borderRadius: radius,
      gap: GRID_GAP,
    },
    stack: {
      gap: GRID_GAP,
    },
    stackItem: {
      overflow: "hidden",
      position: "relative",
    },
    photo: {
      width: "100%",
      backgroundColor: colors.fieldBg,
    },
    video: {
      width: "100%",
      height: videoHeight,
      backgroundColor: colors.fieldBg,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.28)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 4,
      elevation: 4,
    },
    overlayText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: compact ? 28 : 36,
      color: "#FFFFFF",
      textShadowColor: "rgba(0,0,0,0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    viewer: {
      flex: 1,
      backgroundColor: "#000000",
    },
    viewerImageWrap: {
      flex: 1,
    },
    viewerClose: {
      position: "absolute",
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },
    viewerNav: {
      position: "absolute",
      top: "45%",
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },
    viewerNavLeft: {
      left: 10,
    },
    viewerNavRight: {
      right: 10,
    },
    viewerCount: {
      position: "absolute",
      alignSelf: "center",
      left: 0,
      right: 0,
      textAlign: "center",
      color: "#FFFFFF",
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
    },
  });
}
