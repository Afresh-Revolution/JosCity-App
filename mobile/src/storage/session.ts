import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  getTimeBasedGreeting,
  periodForHour,
  type TimeGreeting,
} from "../utils/format";
import {
  friendshipAllowed,
  isAgentAccountType,
  isBusinessAccountType,
  isDedicatedAgentAccount,
  isPersonalAccountType,
  loginKindForUser,
  loginMatchesAccount,
  type AccountType as KindAccountType,
} from "./accountKind";

const TOKEN_KEY = "joscity.authToken";
const ACCOUNT_TYPE_KEY = "joscity.accountType";
const USER_KEY = "joscity.user";
const GREETING_KEY = "joscity.greeting";
const LINKED_TOKEN_KEY = "joscity.linkedAuthToken";
const LINKED_ACCOUNT_TYPE_KEY = "joscity.linkedAccountType";
const LINKED_USER_KEY = "joscity.linkedUser";
const REMEMBERED_KEY = "joscity.rememberedSessions";

export type AccountType = KindAccountType;

export type StoredUser = {
  user_id?: number;
  email?: string;
  user_email?: string;
  business_email?: string;
  first_name?: string;
  last_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  display_name?: string;
  business_name?: string;
  user_picture?: string | null;
  picture?: string | null;
  user_name?: string | null;
  username?: string | null;
  account_type?: AccountType | string;
  [key: string]: unknown;
};

export function pickUserPicture(user?: StoredUser | null): string | null {
  const value =
    (typeof user?.user_picture === "string" && user.user_picture.trim()) ||
    (typeof user?.picture === "string" && user.picture.trim()) ||
    "";
  return value || null;
}

export function mergeStoredUser(
  stored?: StoredUser | null,
  incoming?: StoredUser | null
): StoredUser {
  const next = { ...(stored || {}), ...(incoming || {}) };
  const picture = pickUserPicture(incoming) || pickUserPicture(stored);
  if (picture) {
    next.user_picture = picture;
    next.picture = picture;
  }
  return next;
}

export type StoredSession = {
  token: string;
  accountType: AccountType;
  user: StoredUser;
};

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAccountType(): Promise<AccountType | null> {
  try {
    const value = await SecureStore.getItemAsync(ACCOUNT_TYPE_KEY);
    if (value === "personal" || value === "business" || value === "agent") return value;
    return null;
  } catch {
    return null;
  }
}

export async function setAccountType(type: AccountType): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_TYPE_KEY, type);
}

export async function getUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export async function setUser(user: StoredUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function saveSession(params: {
  token: string;
  accountType: AccountType;
  user: StoredUser;
}): Promise<void> {
  await setAuthToken(params.token);
  await setAccountType(params.accountType);
  await setUser({ ...params.user, account_type: params.accountType });
  await saveLoginGreeting(getTimeBasedGreeting());
  await rememberSession({
    token: params.token,
    accountType: params.accountType,
    user: { ...params.user, account_type: params.accountType },
  });
}

export async function saveLoginGreeting(greeting: TimeGreeting): Promise<void> {
  await AsyncStorage.setItem(GREETING_KEY, JSON.stringify(greeting));
}

export async function getLoginGreeting(): Promise<TimeGreeting> {
  try {
    const raw = await AsyncStorage.getItem(GREETING_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as TimeGreeting;
      if (stored?.period === periodForHour() && stored.message && stored.greeting) {
        return stored;
      }
    }
  } catch {
    // Fall through and pick a fresh greeting.
  }
  const next = getTimeBasedGreeting();
  await saveLoginGreeting(next);
  return next;
}

export async function clearLinkedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(LINKED_TOKEN_KEY);
  await SecureStore.deleteItemAsync(LINKED_ACCOUNT_TYPE_KEY);
  await AsyncStorage.removeItem(LINKED_USER_KEY);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCOUNT_TYPE_KEY);
  await AsyncStorage.removeItem(USER_KEY);
  await AsyncStorage.removeItem(GREETING_KEY);
  await clearLinkedSession();
  await SecureStore.deleteItemAsync(REMEMBERED_KEY).catch(() => undefined);
}

export {
  friendshipAllowed,
  isAgentAccountType,
  isBusinessAccountType,
  isDedicatedAgentAccount,
  isPersonalAccountType,
  loginKindForUser,
  loginMatchesAccount,
};

export function loginMismatchMessage(intended: AccountType): string {
  if (intended === "personal") return "That login is not a personal account. Use Business or Agent sign-in.";
  if (intended === "business") return "That login is not a business account. Use Personal or Agent sign-in.";
  return "That login is not an agent account. Use Personal or Business sign-in.";
}

export function normalizeAccountType(value?: string | null): AccountType {
  if (isAgentAccountType(value)) return "agent";
  return isBusinessAccountType(value) ? "business" : "personal";
}

export function homeRouteForAccount(value?: string | null): "/home" | "/business" | "/agents" {
  const type = normalizeAccountType(value);
  if (type === "agent") return "/agents";
  if (type === "business") return "/business";
  return "/home";
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await getAuthToken());
}

export async function hasPersonalSession(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  const storedType = await getAccountType();
  const user = await getUser();
  return isPersonalAccountType(user?.account_type || storedType);
}

export async function getActiveSession(): Promise<StoredSession | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const user = (await getUser()) || {};
  const storedType = await getAccountType();
  const accountType = normalizeAccountType(storedType || user.account_type);
  return { token, accountType, user: { ...user, account_type: accountType } };
}

export async function getLinkedSession(): Promise<StoredSession | null> {
  try {
    const token = await SecureStore.getItemAsync(LINKED_TOKEN_KEY);
    if (!token) return null;
    const typeValue = await SecureStore.getItemAsync(LINKED_ACCOUNT_TYPE_KEY);
    const raw = await AsyncStorage.getItem(LINKED_USER_KEY);
    const user = raw ? (JSON.parse(raw) as StoredUser) : {};
    const accountType = normalizeAccountType(typeValue || user.account_type);
    return { token, accountType, user: { ...user, account_type: accountType } };
  } catch {
    return null;
  }
}

export async function setLinkedSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(LINKED_TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(LINKED_ACCOUNT_TYPE_KEY, session.accountType);
  await AsyncStorage.setItem(
    LINKED_USER_KEY,
    JSON.stringify({ ...session.user, account_type: session.accountType })
  );
}

type RememberedSessions = Partial<Record<AccountType, StoredSession>>;

async function readRemembered(): Promise<RememberedSessions> {
  try {
    const raw = await SecureStore.getItemAsync(REMEMBERED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RememberedSessions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function rememberSession(session: StoredSession): Promise<void> {
  if (!session.token) return;
  const book = await readRemembered();
  book[session.accountType] = {
    token: session.token,
    accountType: session.accountType,
    user: { ...session.user, account_type: session.accountType },
  };
  await SecureStore.setItemAsync(REMEMBERED_KEY, JSON.stringify(book));
}

export async function getRememberedSession(type: AccountType): Promise<StoredSession | null> {
  const book = await readRemembered();
  const saved = book[type];
  if (saved?.token) return saved;
  const linked = await getLinkedSession();
  if (linked?.token && linked.accountType === type) return linked;
  return null;
}

export async function switchToSession(next: StoredSession): Promise<void> {
  const current = await getActiveSession();
  if (current?.token) {
    await setLinkedSession(current);
    await rememberSession(current);
  }
  await saveSession(next);
}
