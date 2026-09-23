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

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  onError?: () => void;
};

export default function FeedImage({ uri, style, onError }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const styles = useMemo(() => makeThumbStyles(), []);
  const viewerStyles = useMemo(() => makeViewerStyles(), []);

  useEffect(() => {
    let cancelled = false;
    setAspectRatio(null);
    if (!uri) return undefined;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || !(width > 0) || !(height > 0)) return;
        setAspectRatio(width / height);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

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
        onTap={() => setOpen(true)}
        style={[styles.hit, aspectRatio ? { aspectRatio } : styles.pending, style]}
      >
        <Image source={{ uri }} style={styles.fill} resizeMode="contain" onError={onError} />
      </HoldTarget>

      <Modal
        visible={open}
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
}: {
  children: ReactNode;
  onHold: () => void;
  onTap: () => void;
  style?: StyleProp<ViewStyle | ImageStyle>;
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
      accessibilityLabel="View image"
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
    },
    pending: {
      minHeight: 180,
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
