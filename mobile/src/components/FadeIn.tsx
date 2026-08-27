import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
  replayKey?: string | number;
};

export default function FadeIn({
  children,
  delay = 0,
  duration = 650,
  translateY = 14,
  scaleFrom = 1,
  style,
  replayKey = 0,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(translateY)).current;
  const scale = useRef(new Animated.Value(scaleFrom)).current;

  useEffect(() => {
    opacity.setValue(0);
    shift.setValue(translateY);
    scale.setValue(scaleFrom);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shift, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, duration, opacity, replayKey, scale, scaleFrom, shift, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY: shift }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
