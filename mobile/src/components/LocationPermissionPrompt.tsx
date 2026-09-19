import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { requestMapLocationAccess } from "../location/permissions";

export default function LocationPermissionPrompt() {
  useEffect(() => {
    // Browser permission requests stay tied to the explicit map action.
    if (Platform.OS === "web") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (AppState.currentState !== "active") return;
      timer = setTimeout(() => {
        if (AppState.currentState === "active") {
          // Unsupported old native builds must remain usable. Retry next launch.
          void requestMapLocationAccess().catch(() => undefined);
        }
      }, 2000);
    };
    schedule();
    const subscription = AppState.addEventListener("change", schedule);
    return () => { if (timer) clearTimeout(timer); subscription.remove(); };
  }, []);
  return null;
}
