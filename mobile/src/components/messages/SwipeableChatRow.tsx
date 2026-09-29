import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  enabled?: boolean;
  open: boolean;
  muted?: boolean;
  deleteLabel: string;
  muteLabel: string;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onToggleMute: () => void;
};

export default function SwipeableChatRow({
  children,
  enabled = true,
  open,
  muted = false,
  deleteLabel,
  muteLabel,
  onOpen,
  onClose,
  onDelete,
  onToggleMute,
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
  const muteFired = useRef(false);
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
    heightAnim.setValue(rowHeight.current || 72);
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

  const fireMuteNow = () => {
    if (muteFired.current || deleting.current) return;
    muteFired.current = true;
    onToggleMute();
    snapTo(0);
  };

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    if (!enabled || deleting.current) return;
    const next = Math.min(REVEAL, Math.max(-SCREEN, startX.current + event.nativeEvent.translationX));
    currentX.current = next;
    translateX.setValue(next);
    // Mute as soon as the right-slide crosses the reveal — no need to release.
    if (!muteFired.current && next >= REVEAL * 0.55) {
      fireMuteNow();
    }
  };

  const onHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (!enabled || deleting.current) return;
    const { state, translationX, velocityX } = event.nativeEvent;
    if (state === State.BEGAN) {
      startX.current = currentX.current;
      muteFired.current = false;
      return;
    }
    if (state !== State.END && state !== State.CANCELLED) return;

    if (muteFired.current) {
      snapTo(0);
      return;
    }

    const next = Math.min(REVEAL, Math.max(-SCREEN, startX.current + translationX));
    if (next < -SCREEN * 0.45 || velocityX < -900) {
      animateDelete();
      return;
    }
    if (next > REVEAL * 0.35 || velocityX > 500) {
      fireMuteNow();
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

  const muteOpacity = translateX.interpolate({
    inputRange: [0, 8, REVEAL],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });

  const deleteOpacity = translateX.interpolate({
    inputRange: [-REVEAL, -8, 0],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[styles.wrap, collapsing ? { height: heightAnim } : null]}
      onLayout={(event) => {
        if (!collapsing) rowHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <Animated.View style={[styles.layer, { opacity: fade }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.mutePane, { opacity: muteOpacity }]}
        >
          <View style={styles.muteBtn}>
            <Ionicons
              name={muted ? "notifications-outline" : "notifications-off-outline"}
              size={20}
              color={colors.white}
            />
            <Text style={styles.actionText}>{muteLabel}</Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[styles.deletePane, { opacity: deleteOpacity, transform: [{ translateX: deleteShift }] }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
            onPress={animateDelete}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color={colors.white} />
            <Text style={styles.actionText}>{deleteLabel}</Text>
          </Pressable>
        </Animated.View>

        <PanGestureHandler
          enabled={enabled}
          activeOffsetX={[-12, 12]}
          failOffsetY={[-14, 14]}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={[styles.foreground, { transform: [{ translateX }] }]}>
            {children}
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </Animated.View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: {
      overflow: "hidden",
    },
    layer: {
      position: "relative",
    },
    foreground: {
      backgroundColor: colors.background,
    },
    mutePane: {
      ...StyleSheet.absoluteFill,
      alignItems: "flex-start",
      justifyContent: "center",
      paddingLeft: 4,
    },
    muteBtn: {
      width: REVEAL - 8,
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deletePane: {
      ...StyleSheet.absoluteFill,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: 4,
    },
    deleteBtn: {
      width: REVEAL - 8,
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: "#DC2626",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    actionText: {
      color: colors.white,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
    },
  });
}
