import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import JosCityLoader from "./JosCityLoader";
import { biometricCopy, type BiometricKind } from "../biometrics/logic";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const LIME = "#C8F04D";
const SIZE = 56;
const FACE = 28;
const TRAVEL = 11;

type Props = {
  kind?: BiometricKind | null;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export default function BiometricScanButton({ kind = "generic", busy, disabled, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const copy = biometricCopy(kind || "generic");
  const scan = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const isFace = kind === "face";

  useEffect(() => {
    const beam = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    beam.start();
    pulse.start();
    return () => {
      beam.stop();
      pulse.stop();
    };
  }, [glow, scan]);

  const translateY = scan.interpolate({ inputRange: [0, 1], outputRange: [-TRAVEL, TRAVEL] });
  const lineOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.action}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, (disabled || busy) && styles.disabled]}
    >
      {busy ? (
        <JosCityLoader color={colors.white} />
      ) : (
        <View style={styles.stage}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Ionicons
            name={isFace ? "person" : copy.icon}
            size={isFace ? 22 : 24}
            color={LIME}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.beam, { opacity: lineOpacity, transform: [{ translateY }] }]}
          />
        </View>
      )}
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  const mark = 11;
  const thick = 2;
  return StyleSheet.create({
    btn: {
      width: SIZE,
      height: SIZE,
      borderRadius: 18,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.88,
    },
    disabled: {
      opacity: 0.65,
    },
    stage: {
      width: FACE + 10,
      height: FACE + 10,
      alignItems: "center",
      justifyContent: "center",
    },
    beam: {
      position: "absolute",
      left: 2,
      right: 2,
      height: 2,
      borderRadius: 2,
      backgroundColor: LIME,
      shadowColor: LIME,
      shadowOpacity: 0.9,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    },
    corner: {
      position: "absolute",
      width: mark,
      height: mark,
      borderColor: LIME,
    },
    tl: {
      top: 0,
      left: 0,
      borderTopWidth: thick,
      borderLeftWidth: thick,
      borderTopLeftRadius: 3,
    },
    tr: {
      top: 0,
      right: 0,
      borderTopWidth: thick,
      borderRightWidth: thick,
      borderTopRightRadius: 3,
    },
    bl: {
      bottom: 0,
      left: 0,
      borderBottomWidth: thick,
      borderLeftWidth: thick,
      borderBottomLeftRadius: 3,
    },
    br: {
      bottom: 0,
      right: 0,
      borderBottomWidth: thick,
      borderRightWidth: thick,
      borderBottomRightRadius: 3,
    },
  });
}
