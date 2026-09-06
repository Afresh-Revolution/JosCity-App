import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import InlinePostComments from "./InlinePostComments";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  postId: number | null;
  onClose: () => void;
  onCountChange: (count: number) => void;
};

export default function ReelCommentsSheet({ postId, onClose, onCountChange }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [frameH, setFrameH] = useState(screenH);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerActive, setComposerActive] = useState(false);

  const windowResized = frameH > 0 && frameH < screenH - 80;
  const kbInset = windowResized ? 0 : keyboardHeight;
  const usable = Math.max(280, (windowResized ? frameH : screenH) - kbInset);
  const peek = Math.max(insets.top + 56, Math.round(screenH * 0.26));
  const half = Math.round(screenH * 0.58);
  const full = Math.round(screenH - Math.max(insets.top, 12) - 8);
  const composingH = Math.min(half, Math.max(260, usable - peek));
  const composing = composerActive || keyboardHeight > 0;
  const composingRef = useRef(composing);
  composingRef.current = composing;
  const halfRef = useRef(half);
  halfRef.current = half;
  const fullRef = useRef(full);
  fullRef.current = full;
  const composingHRef = useRef(composingH);
  composingHRef.current = composingH;

  const height = useRef(new Animated.Value(half)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(half);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const wasComposing = useRef(false);
  const visible = postId != null;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates?.height || 0));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      height.setValue(half);
      setKeyboardHeight(0);
      setComposerActive(false);
      wasComposing.current = false;
      return;
    }
    height.setValue(half);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [half, height, opacity, postId, visible]);

  const snapToRef = useRef<(target: number) => void>(() => undefined);
  snapToRef.current = (target: number) => {
    Animated.spring(height, {
      toValue: target,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    if (!visible) return;
    if (composing) {
      snapToRef.current(composingH);
    } else if (wasComposing.current) {
      snapToRef.current(half);
    }
    wasComposing.current = composing;
  }, [composing, composingH, half, visible]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderGrant: () => {
          height.stopAnimation((value) => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const max = composingRef.current ? composingHRef.current : fullRef.current;
          const min = composingHRef.current * 0.55;
          const next = Math.min(max, Math.max(min, dragStart.current - gesture.dy));
          height.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const current = dragStart.current - gesture.dy;
          const writing = composingRef.current;
          const lockH = composingHRef.current;
          const halfH = halfRef.current;
          const fullH = fullRef.current;
          if (current < lockH * 0.72 || gesture.vy > 1.15) {
            Keyboard.dismiss();
            Animated.timing(opacity, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }).start(() => onCloseRef.current());
            return;
          }
          if (writing) {
            snapToRef.current(lockH);
            return;
          }
          const target = current > (halfH + fullH) / 2 || gesture.vy < -0.85 ? fullH : halfH;
          snapToRef.current(target);
        },
      }),
    [height, opacity]
  );

  const composerInset = kbInset > 0 ? 8 : Math.max(insets.bottom, 12);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      {visible && postId ? (
        <GestureHandlerRootView
          style={styles.overlay}
          pointerEvents="box-none"
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            if (next > 0) setFrameH(next);
          }}
        >
          <Animated.View style={[styles.scrim, { opacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              {
                height,
                maxHeight: composing ? composingH : full,
                bottom: kbInset,
              },
            ]}
          >
            <View {...pan.panHandlers} style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <InlinePostComments
              postId={postId}
              fill
              bottomInset={composerInset}
              onCountChange={onCountChange}
              onComposerActive={setComposerActive}
            />
          </Animated.View>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      backgroundColor: colors.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: "hidden",
    },
    handleWrap: {
      paddingTop: 10,
      paddingBottom: 8,
      alignItems: "center",
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
  });
}
