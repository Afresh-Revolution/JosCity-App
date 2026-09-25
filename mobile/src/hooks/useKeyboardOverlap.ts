import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from "react-native";

function windowHeight() {
  return Dimensions.get("window").height;
}

function coveredByKeyboard(event: KeyboardEvent) {
  const coords = event.endCoordinates;
  const height = Math.max(0, coords?.height || 0);
  const screenY = coords?.screenY;
  if (typeof screenY === "number" && screenY > 0) {
    return Math.max(0, windowHeight() - screenY);
  }
  return height;
}

/**
 * Android edge-to-edge often overlays the keyboard instead of resizing the
 * window. Return how much to lift bottom UI, or 0 when the window already
 * shrank around the keyboard.
 */
export function useKeyboardOverlap() {
  const restH = useRef(windowHeight());
  const [frameH, setFrameH] = useState(windowHeight);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const applyShow = (event: KeyboardEvent) => {
      const height = Math.max(0, event.endCoordinates?.height || 0);
      const covered = coveredByKeyboard(event);
      const resized = restH.current - windowHeight() > 80;
      setKeyboardHeight(height);
      setOverlap(resized ? 0 : covered > 24 ? covered : height);
    };
    const applyHide = () => {
      setKeyboardHeight(0);
      setOverlap(0);
      restH.current = windowHeight();
    };

    const show = Keyboard.addListener(showEvent, applyShow);
    const hide = Keyboard.addListener(hideEvent, applyHide);
    const change =
      Platform.OS === "android"
        ? Keyboard.addListener("keyboardDidChangeFrame", applyShow)
        : null;

    return () => {
      show.remove();
      hide.remove();
      change?.remove();
    };
  }, []);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next > 0) setFrameH(next);
  }, []);

  return {
    keyboardHeight,
    overlap,
    frameH,
    windowResized: overlap === 0 && keyboardHeight > 0,
    onContainerLayout,
  };
}
