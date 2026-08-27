import * as SecureStore from "expo-secure-store";

const ONBOARDING_KEY = "joscity.onboardingComplete";

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, "1");
}
