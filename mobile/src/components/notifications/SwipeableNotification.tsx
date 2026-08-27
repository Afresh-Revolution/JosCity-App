import { useMemo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

const REVEAL = 88;
const SCREEN = Dimensions.get("window").width;

type Props = {
  children: ReactNode;
  enabled: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export default function SwipeableNotification({
  children,
  enabled,
  open,
  onOpen,
  onClose,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const currentX = useRef(0);
  const rowHeight = useRef(0);
  const deleting = useRef(false);
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    if (!enabled || (!open && currentX.current !== 0 && !deleting.current)) {
      startX.current = 0;
      currentX.current = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 16,
      }).start();
    }
  }, [enabled, open, translateX]);

  const animateDelete = () => {
    if (deleting.current) return;
    deleting.current = true;
    heightAnim.setValue(rowHeight.current || 96);
    setCollapsing(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => onDelete());
  };

  const snapTo = (value: number) => {
    startX.current = value;
    currentX.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      bounciness: 6,
      speed: 16,
    }).start();
    if (value < 0) onOpen();
    else onClose();
  };

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    if (!enabled || deleting.current) return;
    const next = Math.min(0, Math.max(-SCREEN, startX.current + event.nativeEvent.translationX));
    currentX.current = next;
    translateX.setValue(next);
  };

  const onHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (!enabled || deleting.current) return;
    const { state, translationX, velocityX } = event.nativeEvent;
    if (state === State.BEGAN) {
      startX.current = currentX.current;
      return;
    }
    if (state !== State.END && state !== State.CANCELLED) return;

    const next = Math.min(0, startX.current + translationX);
    if (next < -SCREEN * 0.45 || velocityX < -900) {
      animateDelete();
      return;
    }
    if (next < -REVEAL * 0.45) {
      snapTo(-REVEAL);
      return;
    }
    snapTo(0);
  };

  const deleteShift = translateX.interpolate({
    inputRange: [-REVEAL, 0],
    outputRange: [0, REVEAL],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[styles.wrap, collapsing ? { height: heightAnim, marginBottom: 0 } : null]}
      onLayout={(event) => {
        if (!collapsing) rowHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <Animated.View style={[styles.layer, { opacity: fade }]}>
        <Animated.View style={[styles.deletePane, { transform: [{ translateX: deleteShift }] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
            onPress={animateDelete}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color={colors.white} />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </Animated.View>

        <PanGestureHandler
          enabled={enabled}
          activeOffsetX={[-12, 12]}
          failOffsetY={[-14, 14]}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </Animated.View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  wrap: {
    overflow: "hidden",
    marginBottom: 10,
  },
  layer: {
    position: "relative",
  },
  deletePane: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 4,
  },
  deleteBtn: {
    width: REVEAL - 8,
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: "#C62828",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  deleteText: {
    color: colors.white,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
  },
});
}
