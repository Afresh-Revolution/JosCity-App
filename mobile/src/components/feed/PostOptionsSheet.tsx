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

export type PostOption = {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  options: PostOption[];
  onClose: () => void;
  title?: string;
};

export default function PostOptionsSheet({ visible, options, onClose, title = "Post options" }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    overlay.setValue(0);
    sheet.setValue(420);
  }, [overlay, sheet, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
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
          <Text style={styles.title}>{title}</Text>
          {options.map((option, index) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              onPress={option.onPress}
              style={({ pressed }) => [
                styles.row,
                index < options.length - 1 && styles.rowBorder,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={[styles.label, option.destructive && styles.destructive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dim: {
    ...StyleSheet.absoluteFill,
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
    marginBottom: 16,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    minHeight: 54,
    justifyContent: "center",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.fieldBorder,
  },
  rowPressed: {
    opacity: 0.65,
  },
  label: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 16,
    color: colors.text,
  },
  destructive: {
    color: colors.error,
    fontFamily: "Montserrat_600SemiBold",
  },
});
}
