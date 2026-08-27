import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FadeIn from "../components/FadeIn";
import { pingApi } from "../api/client";
import { getAuthToken } from "../storage/session";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/layout";

const logo = require("../../assets/logo.png");

type SplashScreenProps = {
  onFinished: (hasSession: boolean) => void;
};

export default function SplashScreen({ onFinished }: SplashScreenProps) {
  const layout = useResponsive();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      setPercent(Math.round(value * 100));
    });

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const sessionPromise = Promise.all([
      getAuthToken(),
      pingApi(),
    ]);

    animation.start();

    const minimumWait = new Promise((resolve) => setTimeout(resolve, 2400));

    Promise.all([sessionPromise, minimumWait])
      .then(([[token]]) => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onFinished(Boolean(token));
      })
      .catch(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onFinished(false);
      });

    return () => {
      progress.removeListener(listener);
      animation.stop();
    };
  }, [onFinished, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, layout.progressWidth],
  });

  return (
    <View
      style={[styles.root, { backgroundColor: colors.splashBackground }]}
      accessibilityLabel="JosCity splash screen"
    >
      <FadeIn delay={40} duration={900} translateY={0} style={styles.glowWrap}>
        <View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width: layout.shortest * 1.35,
              height: layout.shortest * 1.35,
              borderRadius: layout.shortest * 0.675,
              backgroundColor: colors.splashGlow,
            },
          ]}
        />
      </FadeIn>

      <FadeIn delay={80} duration={800} scaleFrom={0.92} translateY={10}>
        <View style={styles.brand}>
          <Image
            source={logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="JosCity globe logo"
            style={{
              width: layout.logoSize,
              height: layout.logoSize,
            }}
          />

          <FadeIn delay={280} duration={700} translateY={8}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.title,
                {
                  fontSize: layout.titleSize,
                  letterSpacing: layout.titleTracking,
                  marginTop: layout.verticalScale(18),
                  paddingHorizontal: layout.titleTracking,
                },
              ]}
            >
              JOSCITY
            </Text>
          </FadeIn>
        </View>
      </FadeIn>

      <FadeIn
        delay={420}
        duration={700}
        translateY={6}
        style={[
          styles.progressSlot,
          { bottom: Math.max(layout.progressBottom, insets.bottom + 28) },
        ]}
      >
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading JosCity"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <View
            style={[
              styles.track,
              {
                width: layout.progressWidth,
                height: layout.progressHeight,
                borderRadius: layout.progressHeight,
                backgroundColor: colors.progressTrack,
              },
            ]}
          >
            <Animated.View
              style={{
                height: layout.progressHeight,
                width: fillWidth,
                borderRadius: layout.progressHeight,
                backgroundColor: colors.progressFill,
              }}
            />
          </View>
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  glow: {
    opacity: 0.42,
  },
  brand: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.white,
    fontFamily: "Montserrat_700Bold",
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  progressSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  track: {
    overflow: "hidden",
  },
});
