import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

export default function MarqueeText({ children, style }: Props) {
  const shift = useRef(new Animated.Value(0)).current;
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const overflowing = boxWidth > 0 && textWidth > boxWidth + 4;

  useEffect(() => {
    shift.stopAnimation();
    shift.setValue(0);
    if (!overflowing) return;

    const distance = textWidth - boxWidth;
    const duration = Math.min(16000, Math.max(4500, distance * 38));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(shift, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(shift, {
          toValue: 0,
          duration: Math.max(600, duration / 3),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [boxWidth, overflowing, shift, textWidth, children]);

  return (
    <View
      style={styles.clip}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
    >
      <Text
        pointerEvents="none"
        style={[style, styles.measure]}
        onTextLayout={(event) => {
          const widest = event.nativeEvent.lines.reduce(
            (max, line) => Math.max(max, line.width),
            0
          );
          if (widest > 0) setTextWidth(Math.ceil(widest));
        }}
      >
        {children}
      </Text>
      <Animated.Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[
          style,
          overflowing ? { width: textWidth } : styles.fit,
          { transform: [{ translateX: shift }] },
        ]}
      >
        {children}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  measure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
    width: 4000,
  },
  fit: {
    flexShrink: 1,
  },
});
