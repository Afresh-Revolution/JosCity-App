import { authenticateBiometrics, getBiometricStatus } from "../biometrics/biometrics";
import { getRememberedSession, type AccountType, type StoredSession } from "./session";

export type SwitchPreparation =
  | { kind: "ready"; session: StoredSession }
  | { kind: "cancelled" }
  | { kind: "login" };

export async function prepareAccountSwitch(type: AccountType): Promise<SwitchPreparation> {
  const saved = await getRememberedSession(type);
  if (!saved) return { kind: "login" };
  const status = await getBiometricStatus();
  if (status.enabled && status.available && status.enrolled) {
    const ok = await authenticateBiometrics(`Switch to your ${type} account`);
    if (!ok) return { kind: "cancelled" };
  }
  return { kind: "ready", session: saved };
}
