import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "joscity.signupDraft";

export type SignupKind = "personal" | "agent" | "business";

export type PersonalSignupDraft = {
  kind: "personal" | "agent";
  step: number;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  firstName: string;
  lastName: string;
  gender: string;
  address: string;
  nin: string;
  agreed: boolean;
  agentBio: string;
  agentCategories: string;
  services: string[];
};

export type BusinessSignupDraft = {
  kind: "business";
  step: number;
  businessName: string;
  businessType: string;
  description: string;
  address: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  cac: string;
  agreed: boolean;
};

export type SignupDraft = PersonalSignupDraft | BusinessSignupDraft;

function hasProgress(draft: SignupDraft): boolean {
  if (draft.kind === "business") {
    return Boolean(
      draft.step > 1 ||
        draft.businessName.trim() ||
        draft.email.trim() ||
        draft.phone.trim() ||
        draft.address.trim()
    );
  }
  return Boolean(
    draft.step > 1 ||
      draft.email.trim() ||
      draft.phone.trim() ||
      draft.firstName.trim() ||
      draft.agentBio.trim()
  );
}

export async function saveSignupDraft(draft: SignupDraft): Promise<void> {
  if (!hasProgress(draft)) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function loadSignupDraft(): Promise<SignupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupDraft;
    if (!parsed || (parsed.kind !== "personal" && parsed.kind !== "agent" && parsed.kind !== "business")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSignupDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export function signupDraftRoute(draft: SignupDraft): "/register/personal" | "/register/agent" | "/register/business" {
  if (draft.kind === "agent") return "/register/agent";
  if (draft.kind === "business") return "/register/business";
  return "/register/personal";
}
