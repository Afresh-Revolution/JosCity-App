import AsyncStorage from "@react-native-async-storage/async-storage";

// A feature-specific key reaches existing installs once when this update lands.
export const LOCATION_PROMPT_KEY = "joscity.location.foreground-introduction.v1";
let inFlight: Promise<{ granted: boolean; canAskAgain: boolean } | null> | null = null;
export function requestMapLocationAccess(manual = false) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!manual && await AsyncStorage.getItem(LOCATION_PROMPT_KEY)) return null;
    const Location = await import("expo-location");
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    await AsyncStorage.setItem(LOCATION_PROMPT_KEY, "handled");
    return { granted: permission.granted, canAskAgain: permission.canAskAgain };
  })().finally(() => { inFlight = null; });
  return inFlight;
}
