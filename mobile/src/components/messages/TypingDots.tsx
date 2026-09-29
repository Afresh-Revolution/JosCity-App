import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  compact?: boolean;
};

export default function TypingDots({ compact = false }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors, compact);
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(420 - delay),
        ])
      );
    const runners = [pulse(a, 0), pulse(b, 140), pulse(c, 280)];
    runners.forEach((runner) => runner.start());
    return () => runners.forEach((runner) => runner.stop());
  }, [a, b, c]);

  const scale = (value: Animated.Value) =>
    value.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] });
  const opacity = (value: Animated.Value) =>
    value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={styles.row}>
      {[a, b, c].map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            { opacity: opacity(value), transform: [{ scale: scale(value) }] },
          ]}
        />
      ))}
    </View>
  );
}

function makeStyles(colors: Palette, compact: boolean) {
  const size = compact ? 5 : 7;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: compact ? 3 : 4,
    },
    dot: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.primary,
    },
  });
}
