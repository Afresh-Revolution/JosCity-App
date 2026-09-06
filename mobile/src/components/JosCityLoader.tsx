import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const logo = require("../../assets/logo.png");

type Props = {
  color?: string;
  size?: "small" | "large" | number;
  style?: StyleProp<ViewStyle>;
};

const LIME = "#C8F04D";
const BRAND = "#0F3D26";

function boxSize(size: Props["size"]) {
  if (typeof size === "number") return size;
  return size === "small" ? 22 : 58;
}

function isPale(color?: string) {
  const value = (color || "").trim().toLowerCase();
  return value === "#fff" || value === "#ffffff" || value === "white" || value === "rgb(255, 255, 255)";
}

export default function JosCityLoader({ color, size = "small", style }: Props) {
  const px = boxSize(size);
  const pale = isPale(color);
  const accent = pale ? "#FFFFFF" : color || BRAND;
  const spin = useRef(new Animated.Value(0)).current;
  const counter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const reverse = Animated.loop(
      Animated.timing(counter, {
        toValue: 1,
        duration: 3800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    orbit.start();
    reverse.start();
    glow.start();
    return () => {
      orbit.stop();
      reverse.stop();
      glow.stop();
    };
  }, [counter, pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rotateBack = counter.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  const mark = Math.round(px * 0.62);
  const ring = Math.round(px * 0.92);
  const compact = px <= 28;
  const styles = useMemo(() => makeStyles(px, mark, ring, accent, pale), [accent, mark, pale, px, ring]);

  return (
    <View
      style={[styles.box, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading JosCity"
    >
      {!compact ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
      ) : null}

      <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
        <Image
          source={logo}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel="JosCity logo"
          style={styles.logo}
        />
      </Animated.View>

      <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
        <View style={[styles.ellipse, styles.ellipseA]} />
        <View style={styles.satellite} />
      </Animated.View>

      <Animated.View style={[styles.orbit, { transform: [{ rotate: rotateBack }] }]}>
        <View style={[styles.ellipse, styles.ellipseB]} />
        {!compact ? <View style={styles.city} /> : null}
      </Animated.View>
    </View>
  );
}

function makeStyles(px: number, mark: number, ring: number, accent: string, pale: boolean) {
  const lime = pale ? "#FFFFFF" : LIME;
  const ringColor = pale ? "rgba(255,255,255,0.55)" : accent;
  return StyleSheet.create({
    box: {
      width: px,
      height: px,
      alignItems: "center",
      justifyContent: "center",
    },
    halo: {
      position: "absolute",
      width: px,
      height: px,
      borderRadius: px,
      backgroundColor: pale ? "rgba(255,255,255,0.22)" : "rgba(200,240,77,0.22)",
    },
    logoWrap: {
      width: mark,
      height: mark,
      borderRadius: mark,
      overflow: "hidden",
      zIndex: 2,
    },
    logo: {
      width: mark,
      height: mark,
    },
    orbit: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    },
    ellipse: {
      width: ring,
      height: ring * 0.42,
      borderRadius: ring,
      borderWidth: Math.max(1.25, px * 0.03),
      borderColor: ringColor,
    },
    ellipseA: {
      opacity: 0.95,
    },
    ellipseB: {
      transform: [{ rotate: "70deg" }],
      opacity: 0.55,
      borderColor: lime,
    },
    satellite: {
      position: "absolute",
      top: (px - ring * 0.42) / 2 - 3,
      width: Math.max(5, Math.round(px * 0.1)),
      height: Math.max(5, Math.round(px * 0.1)),
      borderRadius: 8,
      backgroundColor: lime,
      shadowColor: lime,
      shadowOpacity: 0.8,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 3,
    },
    city: {
      position: "absolute",
      bottom: (px - ring * 0.42) / 2 - 2,
      width: Math.max(4, Math.round(px * 0.07)),
      height: Math.max(4, Math.round(px * 0.07)),
      borderRadius: 6,
      backgroundColor: accent,
    },
  });
}
