import { useEffect, useState, type ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const aspectCache = new Map<string, number>();
const FALLBACK_ASPECT = 1;
/** Soft bounds so extreme photos still fit the column without blowing the feed. */
const MIN_ASPECT = 0.62;
const MAX_ASPECT = 1.45;

function clampAspect(value: number) {
  if (!(value > 0)) return FALLBACK_ASPECT;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, value));
}

type Props = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  fallback?: ReactNode;
  backgroundColor?: string;
};

/**
 * Listing thumbnail that sizes to the photo’s own ratio — portrait stays tall,
 * landscape stays wide — on a neutral field like a marketplace feed.
 */
export default function ListingThumb({
  uri,
  style,
  fallback,
  backgroundColor = "#F3F1EC",
}: Props) {
  const [failed, setFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (!uri) return FALLBACK_ASPECT;
    return aspectCache.get(uri) || FALLBACK_ASPECT;
  });

  useEffect(() => {
    setFailed(false);
    if (!uri) {
      setAspectRatio(FALLBACK_ASPECT);
      return undefined;
    }
    const cached = aspectCache.get(uri);
    if (cached) {
      setAspectRatio(cached);
      return undefined;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || !(width > 0) || !(height > 0)) return;
        const next = clampAspect(width / height);
        aspectCache.set(uri, next);
        setAspectRatio(next);
      },
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[styles.frame, styles.placeholder, { aspectRatio: FALLBACK_ASPECT, backgroundColor }, style]}>
        {fallback}
      </View>
    );
  }

  return (
    <View style={[styles.frame, { aspectRatio, backgroundColor }, style]}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
        fadeDuration={0}
        onError={() => setFailed(true)}
        onLoad={(event) => {
          const width = event.nativeEvent.source?.width;
          const height = event.nativeEvent.source?.height;
          if (!(width > 0) || !(height > 0)) return;
          const next = clampAspect(width / height);
          if (aspectCache.get(uri) === next) return;
          aspectCache.set(uri, next);
          setAspectRatio(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    minHeight: 120,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
