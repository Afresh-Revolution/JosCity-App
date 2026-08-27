import { AppState } from "react-native";

/** Run a callback on an interval only while the app is in the foreground. */
export function startForegroundInterval(callback: () => void, ms: number): () => void {
  const tick = () => {
    if (AppState.currentState === "active") callback();
  };
  const id = setInterval(tick, ms);
  return () => clearInterval(id);
}
