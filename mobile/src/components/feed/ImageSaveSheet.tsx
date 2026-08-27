import { useMemo, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  visible: boolean;
  saving?: boolean;
  embedded?: boolean;
  onSave: () => void;
  onClose: () => void;
};

export default function ImageSaveSheet({
  visible,
  saving,
  embedded = false,
  onSave,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(280)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    overlay.setValue(0);
    sheet.setValue(280);
  }, [overlay, sheet, visible]);

  if (!visible && embedded) return null;

  const body = (
    <View style={styles.root} pointerEvents={visible ? "auto" : "none"}>
      <Pressable style={StyleSheet.absoluteFill} onPress={saving ? undefined : onClose}>
        <Animated.View style={[styles.dim, { opacity: overlay }]} />
      </Pressable>
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 18),
            transform: [{ translateY: sheet }],
          },
        ]}
      >
        <View style={styles.handle} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save image"
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.pressed]}
        >
          <Text style={styles.save}>{saving ? "Saving…" : "Save image"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onClose}
          disabled={saving}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );

  if (embedded) {
    return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{body}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {body}
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
    },
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.42)",
    },
    sheet: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    row: {
      minHeight: 54,
      justifyContent: "center",
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.fieldBorder,
    },
    pressed: {
      opacity: 0.65,
    },
    save: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.text,
    },
    cancel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 16,
      color: colors.textMuted,
    },
  });
}
