import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
  suffix?: string;
  loading?: boolean;
  disabled?: boolean;
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  style,
  suffix,
  loading = false,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          minHeight: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        },
        primary: {
          backgroundColor: colors.brand,
        },
        primaryPressed: {
          backgroundColor: colors.primaryPressed,
        },
        secondary: {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        secondaryPressed: {
          backgroundColor: colors.navActive,
        },
        label: {
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 16,
          letterSpacing: 0.2,
        },
        primaryLabel: {
          color: colors.white,
        },
        secondaryLabel: {
          color: colors.text,
        },
        disabled: {
          opacity: 0.65,
        },
      }),
    [colors]
  );
  const primary = variant === "primary";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && !isDisabled && (primary ? styles.primaryPressed : styles.secondaryPressed),
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>
          {label}
          {suffix ? `  ${suffix}` : ""}
        </Text>
      )}
    </Pressable>
  );
}
