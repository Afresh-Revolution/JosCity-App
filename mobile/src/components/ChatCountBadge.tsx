import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export default function ChatCountBadge({
  count,
  backgroundColor,
  textColor,
  borderColor,
}: {
  count: number;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current && count > 0) {
      scale.setValue(0.7);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 220,
        useNativeDriver: true,
      }).start();
    }
    previous.current = count;
  }, [count, scale]);

  if (count <= 0) return null;

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor, borderColor, transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>
        {count > 99 ? "99+" : String(count)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  text: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 9,
    lineHeight: 11,
  },
});
