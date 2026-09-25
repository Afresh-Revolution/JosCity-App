export type BiometricKind = "face" | "fingerprint" | "iris" | "generic";

export type BiometricAccountType = "personal" | "business" | "agent";

export type BiometricHint = {
  email: string;
  accountType: BiometricAccountType;
};

export type BiometricCredentials = BiometricHint & {
  password: string;
};

export const BIOMETRIC_AUTH_TYPES = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
} as const;

function isAccountType(value: string): value is BiometricAccountType {
  return value === "personal" || value === "business" || value === "agent";
}

export function parseBiometricHint(raw?: string | null): BiometricHint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricHint>;
    const email = String(parsed.email || "").trim().toLowerCase();
    const accountType = String(parsed.accountType || "").trim().toLowerCase();
    if (!email.includes("@") || !isAccountType(accountType)) return null;
    return { email, accountType };
  } catch {
    return null;
  }
}

export function serializeBiometricHint(hint: BiometricHint): string {
  return JSON.stringify({
    email: hint.email.trim().toLowerCase(),
    accountType: hint.accountType,
  });
}

export function parseBiometricCredentials(raw?: string | null): BiometricCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricCredentials>;
    const hint = parseBiometricHint(JSON.stringify({
      email: parsed.email,
      accountType: parsed.accountType,
    }));
    const password = String(parsed.password || "");
    if (!hint || !password) return null;
    return { ...hint, password };
  } catch {
    return null;
  }
}

export function serializeBiometricCredentials(credentials: BiometricCredentials): string {
  return JSON.stringify({
    email: credentials.email.trim().toLowerCase(),
    accountType: credentials.accountType,
    password: credentials.password,
  });
}

export function kindFromAuthTypes(types: number[], platform?: string): BiometricKind {
  const hasFace = types.includes(BIOMETRIC_AUTH_TYPES.FACIAL_RECOGNITION);
  const hasIris = types.includes(BIOMETRIC_AUTH_TYPES.IRIS);
  const hasFingerprint = types.includes(BIOMETRIC_AUTH_TYPES.FINGERPRINT);
  if (platform === "android") {
    if (hasFingerprint) return "fingerprint";
    if (hasIris) return "iris";
    if (hasFace) return "generic";
    return "generic";
  }
  if (hasFace) return "face";
  if (hasIris) return "iris";
  if (hasFingerprint) return "fingerprint";
  return "generic";
}

export function biometricCopy(
  kind: BiometricKind,
  platform?: string
): {
  noun: string;
  action: string;
  icon: "scan-outline" | "finger-print-outline" | "eye-outline";
} {
  const android = platform === "android";
  if (kind === "face" && !android) {
    return { noun: "Face ID", action: "Sign in with Face ID", icon: "scan-outline" };
  }
  if (kind === "fingerprint") {
    if (android) {
      return { noun: "Fingerprint", action: "Sign in with fingerprint", icon: "finger-print-outline" };
    }
    return { noun: "Touch ID", action: "Sign in with Touch ID", icon: "finger-print-outline" };
  }
  if (kind === "iris" && !android) {
    return { noun: "iris unlock", action: "Sign in with iris", icon: "eye-outline" };
  }
  if (android) {
    return { noun: "Biometrics", action: "Sign in with biometrics", icon: "finger-print-outline" };
  }
  return { noun: "biometrics", action: "Sign in with biometrics", icon: "finger-print-outline" };
}

export function shouldOfferBiometricSetup(input: {
  available: boolean;
  enrolled: boolean;
  enabled: boolean;
  enabledEmail?: string;
  currentEmail?: string;
}): "setup" | "update" | "none" {
  if (!input.available || !input.enrolled) return "none";
  const current = String(input.currentEmail || "").trim().toLowerCase();
  const enabledFor = String(input.enabledEmail || "").trim().toLowerCase();
  if (!input.enabled) return "setup";
  if (current && enabledFor && current !== enabledFor) return "update";
  return "none";
}
