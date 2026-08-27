import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  saved: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export default function SaveBookmark({ saved, onPress, disabled = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? "Unsave post" : "Save post"}
      accessibilityState={{ selected: saved, disabled }}
      hitSlop={10}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={saved ? "bookmark" : "bookmark-outline"}
        size={22}
        color={saved ? colors.primary : colors.text}
      />
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  button: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
});
}
