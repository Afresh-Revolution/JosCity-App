import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingAgentApplication } from "../api/agentSignup";

const KEY = "joscity.pendingAgentApplication";

export async function savePendingAgentApplication(pending: PendingAgentApplication): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(pending));
}

export async function loadPendingAgentApplication(): Promise<PendingAgentApplication | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAgentApplication;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      bio: String(parsed.bio || ""),
      category: String(parsed.category || ""),
      services: Array.isArray(parsed.services) ? parsed.services.map(String) : [],
      nin: String(parsed.nin || ""),
    };
  } catch {
    return null;
  }
}

export async function clearPendingAgentApplication(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
