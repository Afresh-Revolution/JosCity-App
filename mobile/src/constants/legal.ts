import { Alert, Linking } from "react-native";

export const LEGAL = {
  site: "https://joscity.com",
  terms: "https://joscity.com/terms-of-service",
  merchant: "https://joscity.com/terms-of-service",
  privacy: "https://joscity.com/privacy-policy",
  cookies: "https://joscity.com/cookie-policy",
  guidelines: "https://joscity.com/community-guidelines",
  childSafety: "https://joscity.com/child-safety",
  support: "https://joscity.com/contact",
  deleteAccount: "https://joscity.com/delete-account",
  businessSignup: "https://joscity.com/business-form",
  supportEmail: "support@joscity.com",
  supportPhone: "+2347067621916",
  supportPhoneLabel: "+234 7067621916",
} as const;

export const SUPPORT_MAILTO = `mailto:${LEGAL.supportEmail}`;

export async function openExternalUrl(url: string) {
  try {
    const allowed = await Linking.canOpenURL(url);
    if (!allowed) {
      Alert.alert("Could not open link", url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Could not open link", url);
  }
}
