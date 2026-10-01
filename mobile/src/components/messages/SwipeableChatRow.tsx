import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  useWindowDimensions,
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
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const currentX = useRef(0);
  const rowHeight = useRef(0);
  const deleting = useRef(false);
  const dragging = useRef(false);
  const muteFired = useRef(false);
  const enabledRef = useRef(enabled);
  const screenWidthRef = useRef(screenWidth);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onDeleteRef = useRef(onDelete);
  const onToggleMuteRef = useRef(onToggleMute);
  enabledRef.current = enabled;
  screenWidthRef.current = screenWidth;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;
  onDeleteRef.current = onDelete;
  onToggleMuteRef.current = onToggleMute;
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    if (dragging.current || deleting.current) return;
    if (!enabled || (!open && currentX.current !== 0)) {
      startX.current = 0;
      currentX.current = 0;
      muteFired.current = false;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
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
        toValue: -screenWidthRef.current,
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
    ]).start(() => onDeleteRef.current());
  };

  const snapTo = (value: number) => {
    startX.current = value;
    currentX.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
    if (value < 0) onOpenRef.current();
    else onCloseRef.current();
  };

  const snapToRef = useRef(snapTo);
  const animateDeleteRef = useRef(animateDelete);
  snapToRef.current = snapTo;
  animateDeleteRef.current = animateDelete;
  const settled = useRef(false);
  const lastMuteAt = useRef(0);

  const toggleMuteOnce = useCallback(() => {
    const now = Date.now();
    if (now - lastMuteAt.current < 500) return;
    lastMuteAt.current = now;
    muteFired.current = true;
    onToggleMuteRef.current();
  }, []);

  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (!enabledRef.current || deleting.current || settled.current) return;
    const next = Math.min(
      REVEAL,
      Math.max(-screenWidthRef.current, startX.current + event.nativeEvent.translationX)
    );
    currentX.current = next;
    translateX.setValue(next);
    // Mute as soon as the action is uncovered. A short lock stops a second toggle
    // if this render restarts the gesture before the finger lifts.
    if (next >= REVEAL * 0.72) toggleMuteOnce();
  }, [toggleMuteOnce, translateX]);

  const onHandlerStateChange = useCallback((event: PanGestureHandlerStateChangeEvent) => {
    if (deleting.current) return;
    const { state, translationX, velocityX } = event.nativeEvent;
    if (state === State.BEGAN) {
      dragging.current = true;
      settled.current = false;
      muteFired.current = false;
      translateX.stopAnimation();
      startX.current = currentX.current;
      translateX.setValue(startX.current);
      return;
    }
    if (state !== State.END && state !== State.CANCELLED && state !== State.FAILED) return;
    if (settled.current) return;
    settled.current = true;
    dragging.current = false;

    const released = Math.min(
      REVEAL,
      Math.max(-screenWidthRef.current, startX.current + translationX)
    );

    // A scroll that steals the touch closes the row and must not mute.
    if (state === State.CANCELLED || state === State.FAILED || !enabledRef.current) {
      snapToRef.current(0);
      return;
    }

    currentX.current = released;
    if (released < -screenWidthRef.current * 0.45 || (released < -REVEAL && velocityX < -1200)) {
      animateDeleteRef.current();
      return;
    }
    if (released >= REVEAL * 0.72) toggleMuteOnce();
    if (released >= REVEAL * 0.72 || muteFired.current) {
      snapToRef.current(0);
      return;
    }
    if (released < -REVEAL * 0.45) {
      snapToRef.current(-REVEAL);
      return;
    }
    snapToRef.current(0);
  }, [toggleMuteOnce, translateX]);

  const deleteShift = translateX.interpolate({
    inputRange: [-REVEAL, 0],
    outputRange: [0, REVEAL],
    extrapolate: "clamp",
  });

  const muteOpacity = translateX.interpolate({
    inputRange: [0, REVEAL * 0.18, REVEAL * 0.62],
    outputRange: [0, 0, 1],
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
          activeOffsetX={[-18, 18]}
          failOffsetY={[-8, 8]}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={[styles.foreground, { transform: [{ translateX }], zIndex: 1 }]}>
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
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: REVEAL,
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
