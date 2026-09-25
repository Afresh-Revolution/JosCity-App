import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import ImageSaveSheet from "./ImageSaveSheet";
import { saveRemoteImage } from "../../utils/saveImage";

const aspectCache = new Map<string, number>();
const DEFAULT_ASPECT = 1;

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  onError?: () => void;
  onPress?: () => void;
  fit?: "contain" | "cover";
  naturalAspect?: boolean;
  blurRadius?: number;
  accessibilityLabel?: string;
};

export default function FeedImage({
  uri,
  style,
  onError,
  onPress,
  fit = "contain",
  naturalAspect = true,
  blurRadius = 0,
  accessibilityLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(
    () => (uri && aspectCache.get(uri)) || DEFAULT_ASPECT
  );
  const styles = useMemo(() => makeThumbStyles(), []);
  const viewerStyles = useMemo(() => makeViewerStyles(), []);

  useEffect(() => {
    if (!uri || !naturalAspect) return undefined;
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
        const next = width / height;
        aspectCache.set(uri, next);
        setAspectRatio(next);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [naturalAspect, uri]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await saveRemoteImage(uri);
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

  return (
    <>
      <HoldTarget
        onHold={() => setMenu(true)}
        onTap={() => (onPress ? onPress() : setOpen(true))}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.hit,
          naturalAspect ? { aspectRatio } : null,
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={styles.fill}
          resizeMode={fit}
          fadeDuration={0}
          blurRadius={blurRadius}
          onError={onError}
          onLoad={(event) => {
            if (!naturalAspect) return;
            const width = event.nativeEvent.source?.width;
            const height = event.nativeEvent.source?.height;
            if (!(width > 0) || !(height > 0)) return;
            const next = width / height;
            if (aspectCache.get(uri) === next) return;
            aspectCache.set(uri, next);
            setAspectRatio(next);
          }}
        />
      </HoldTarget>

      <Modal
        visible={!onPress && open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setMenu(false);
          setOpen(false);
        }}
      >
        <View style={viewerStyles.root}>
          <HoldTarget
            onHold={() => setMenu(true)}
            onTap={() => {
              if (!menu) setOpen(false);
            }}
            style={viewerStyles.imageWrap}
          >
            <Image source={{ uri }} style={viewerStyles.full} resizeMode="contain" />
          </HoldTarget>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => {
              setMenu(false);
              setOpen(false);
            }}
            style={[viewerStyles.close, { top: Math.max(insets.top, 12) }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <ImageSaveSheet
            visible={menu}
            embedded
            saving={saving}
            onSave={() => void save()}
            onClose={() => setMenu(false)}
          />
        </View>
      </Modal>

      {open ? null : (
        <ImageSaveSheet
          visible={menu}
          saving={saving}
          onSave={() => void save()}
          onClose={() => setMenu(false)}
        />
      )}
    </>
  );
}

function HoldTarget({
  children,
  onHold,
  onTap,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onHold: () => void;
  onTap: () => void;
  style?: StyleProp<ViewStyle | ImageStyle>;
  accessibilityLabel?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel || "View image"}
      delayLongPress={400}
      onPressIn={() => {
        held.current = false;
        clearTimer();
        timer.current = setTimeout(() => {
          held.current = true;
          onHold();
        }, 400);
      }}
      onPressOut={clearTimer}
      onLongPress={() => {
        held.current = true;
        clearTimer();
        onHold();
      }}
      onPress={() => {
        if (!held.current) onTap();
        held.current = false;
      }}
      // @ts-expect-error web right-click
      onContextMenu={(event: { preventDefault?: () => void }) => {
        event.preventDefault?.();
        held.current = true;
        clearTimer();
        onHold();
      }}
      style={style}
    >
      {children}
    </Pressable>
  );
}

function makeThumbStyles() {
  return StyleSheet.create({
    hit: {
      width: "100%",
      overflow: "hidden",
      backgroundColor: "#EFECE6",
    },
    fill: {
      width: "100%",
      height: "100%",
    },
  });
}

function makeViewerStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#000000",
    },
    imageWrap: {
      flex: 1,
    },
    full: {
      width: "100%",
      height: "100%",
    },
    close: {
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
  });
}
