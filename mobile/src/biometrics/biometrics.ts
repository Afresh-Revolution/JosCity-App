import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import {
  biometricCopy,
  kindFromAuthTypes,
  parseBiometricCredentials,
  parseBiometricHint,
  serializeBiometricCredentials,
  serializeBiometricHint,
  type BiometricAccountType,
  type BiometricCredentials,
  type BiometricHint,
  type BiometricKind,
} from "./logic";

const ENABLED_KEY = "joscity.biometrics.enabled";
const HINT_KEY = "joscity.biometrics.hint";
const SECRET_KEY = "joscity.biometrics.secret";

export type BiometricStatus = {
  available: boolean;
  enrolled: boolean;
  enabled: boolean;
  kind: BiometricKind;
  hint: BiometricHint | null;
};

async function readKey(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (Platform.OS === "web") {
    return { available: false, enrolled: false, enabled: false, kind: "generic", hint: null };
  }
  try {
    const [hasHardware, enrolled, types, enabledRaw, hintRaw] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      readKey(ENABLED_KEY),
      readKey(HINT_KEY),
    ]);
    return {
      available: Boolean(hasHardware),
      enrolled: Boolean(enrolled),
      enabled: enabledRaw === "1",
      kind: kindFromAuthTypes(types || [], Platform.OS),
      hint: parseBiometricHint(hintRaw),
    };
  } catch {
    return { available: false, enrolled: false, enabled: false, kind: "generic", hint: null };
  }
}

export async function authenticateBiometrics(prompt: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return Boolean(result.success);
  } catch {
    return false;
  }
}

export async function enableBiometricLogin(credentials: BiometricCredentials): Promise<{
  success: boolean;
  message?: string;
}> {
  const status = await getBiometricStatus();
  if (!status.available) {
    return { success: false, message: "This device does not support biometric sign-in." };
  }
  if (!status.enrolled) {
    return { success: false, message: `Set up ${biometricCopy(status.kind, Platform.OS).noun} on this device first.` };
  }
  const ok = await authenticateBiometrics(`Turn on ${biometricCopy(status.kind, Platform.OS).noun} for JOSCITY`);
  if (!ok) return { success: false, message: "Biometric confirmation was cancelled." };
  try {
    await SecureStore.setItemAsync(SECRET_KEY, serializeBiometricCredentials(credentials));
    await SecureStore.setItemAsync(HINT_KEY, serializeBiometricHint(credentials));
    await SecureStore.setItemAsync(ENABLED_KEY, "1");
    return { success: true };
  } catch {
    return { success: false, message: "Could not save biometric sign-in on this device." };
  }
}

export async function updateBiometricPassword(
  password: string,
  accountType?: BiometricAccountType
): Promise<void> {
  const status = await getBiometricStatus();
  if (!status.enabled || !status.hint) return;
  const secret = await readKey(SECRET_KEY);
  const current = parseBiometricCredentials(secret);
  const next: BiometricCredentials = {
    email: status.hint.email,
    accountType: accountType || current?.accountType || status.hint.accountType,
    password,
  };
  await SecureStore.setItemAsync(SECRET_KEY, serializeBiometricCredentials(next));
  await SecureStore.setItemAsync(HINT_KEY, serializeBiometricHint(next));
}

export async function disableBiometricLogin(options?: { confirm?: boolean }): Promise<{
  success: boolean;
  message?: string;
}> {
  if (options?.confirm) {
    const status = await getBiometricStatus();
    const ok = await authenticateBiometrics(`Turn off ${biometricCopy(status.kind, Platform.OS).noun} for JOSCITY`);
    if (!ok) return { success: false, message: "Biometric confirmation was cancelled." };
  }
  try {
    await SecureStore.deleteItemAsync(SECRET_KEY);
    await SecureStore.deleteItemAsync(HINT_KEY);
    await SecureStore.deleteItemAsync(ENABLED_KEY);
  } catch {
    // still treat as disabled
  }
  return { success: true };
}

export async function unlockBiometricCredentials(): Promise<{
  success: boolean;
  credentials?: BiometricCredentials;
  message?: string;
}> {
  const status = await getBiometricStatus();
  if (!status.enabled) {
    return { success: false, message: "Biometric sign-in is not set up on this device." };
  }
  if (!status.available || !status.enrolled) {
    return { success: false, message: `Set up ${biometricCopy(status.kind, Platform.OS).noun} on this device first.` };
  }
  const ok = await authenticateBiometrics(biometricCopy(status.kind, Platform.OS).action);
  if (!ok) return { success: false, message: "Biometric sign-in was cancelled." };
  const secret = await readKey(SECRET_KEY);
  const credentials = parseBiometricCredentials(secret);
  if (!credentials) {
    await disableBiometricLogin();
    return { success: false, message: "Biometric sign-in needs to be set up again." };
  }
  return { success: true, credentials };
}
