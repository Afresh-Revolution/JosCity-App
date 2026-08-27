import { apiFetch, readJson } from "./client";

type JsonRecord = Record<string, unknown>;

export type ChatConversation = {
  conversationId: number;
  conversationType: "direct" | "group";
  conversationName: string;
  otherUserId?: number;
  otherUsername?: string;
  otherAvatar?: string;
  lastMessageContent: string;
  lastMessageAt?: string;
  lastMessageSenderId?: number;
  unreadCount: number;
};

export type ChatMessage = {
  messageId: number;
  conversationId: number;
  senderId: number;
  username?: string;
  messageContent: string;
  createdAt: string;
};

export type ChatFriendContact = {
  userId: number;
  displayName: string;
  avatarUrl: string;
  address?: string;
  kind?: "person" | "business";
};

export type MessageRequest = {
  requestId: number;
  displayName: string;
  picture?: string | null;
  status: string;
  conversationId?: number | null;
};

export type DirectConversationResult =
  | ChatConversation
  | { pending: true; message?: string };

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function normalizeConversation(value: unknown): ChatConversation | null {
  const record = toRecord(value);
  const otherUser = toRecord(record.other_user ?? record.otherUser);
  const conversationId = pickNumber(record.conversationId, record.conversation_id, record.id);
  if (!conversationId) return null;
  const type = pickString(record.conversation_type, record.conversationType, record.type);
  return {
    conversationId,
    conversationType: type === "group" ? "group" : "direct",
    conversationName:
      pickString(
        record.conversation_name,
        record.conversationName,
        record.other_username,
        record.otherUsername,
        otherUser.display_name,
        otherUser.username
      ) || "Conversation",
    otherUserId: pickNumber(
      record.other_user_id,
      record.otherUserId,
      otherUser.user_id,
      otherUser.id
    ),
    otherUsername: pickString(
      record.other_username,
      record.otherUsername,
      otherUser.display_name,
      otherUser.username
    ),
    otherAvatar: pickString(
      record.other_avatar,
      record.otherAvatar,
      record.other_profile_picture,
      record.other_user_avatar,
      otherUser.user_picture,
      otherUser.profile_picture,
      otherUser.avatar
    ),
    lastMessageContent:
      pickString(record.last_message_content, record.lastMessageContent, record.last_message) ||
      "",
    lastMessageAt: pickString(
      record.last_message_at,
      record.lastMessageAt,
      record.updated_at,
      record.created_at
    ),
    lastMessageSenderId: pickNumber(record.last_message_sender_id, record.lastMessageSenderId),
    unreadCount: pickNumber(record.unread_count, record.unreadCount) || 0,
  };
}

function normalizeMessage(value: unknown, conversationId?: number): ChatMessage | null {
  const record = toRecord(value);
  const messageId = pickNumber(record.message_id, record.messageId, record.id);
  const senderId = pickNumber(record.sender_id, record.senderId);
  if (!messageId || !senderId) return null;
  return {
    messageId,
    conversationId:
      pickNumber(record.conversation_id, record.conversationId) || conversationId || 0,
    senderId,
    username: pickString(record.username, record.sender_username),
    messageContent: pickString(record.message_content, record.messageContent, record.content) || "",
    createdAt: pickString(record.created_at, record.createdAt) || new Date().toISOString(),
  };
}

function normalizeContact(value: unknown): ChatFriendContact | null {
  const record = toRecord(value);
  const userId = pickNumber(record.user_id, record.userId, record.id);
  if (!userId) return null;
  return {
    userId,
    displayName:
      pickString(record.display_name, record.displayName, record.username, record.name) ||
      "Member",
    avatarUrl:
      pickString(record.avatarUrl, record.user_picture, record.profile_picture, record.picture) ||
      "",
    address: pickString(record.address, record.location) || "Jos",
    kind:
      String(record.account_type || record.kind || "").toLowerCase() === "business"
        ? "business"
        : "person",
  };
}

function normalizeRequest(value: unknown): MessageRequest | null {
  const record = toRecord(value);
  const requestId = pickNumber(record.request_id, record.requestId, record.id);
  if (!requestId) return null;
  return {
    requestId,
    displayName: pickString(record.display_name, record.displayName, record.username) || "Member",
    picture: pickString(record.user_picture, record.picture, record.profile_picture) || null,
    status: pickString(record.status) || "pending",
    conversationId: pickNumber(record.conversation_id, record.conversationId) || null,
  };
}

export async function getChatUnreadCount(): Promise<number> {
  try {
    const response = await apiFetch("/chat/unread-count", {
      method: "GET",
      auth: true,
      timeoutMs: 12000,
    });
    const data = await readJson<{ unreadCount?: number; unread_count?: number; count?: number }>(
      response
    );
    if (!response.ok) return 0;
    return Number(data.unreadCount ?? data.unread_count ?? data.count ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function getUserConversations(
  page = 1,
  limit = 50
): Promise<ChatConversation[]> {
  const response = await apiFetch(`/chat/conversations?page=${page}&limit=${limit}`, {
    method: "GET",
    auth: true,
    timeoutMs: 20000,
  });
  const data = await readJson<{ conversations?: unknown[]; data?: unknown[] }>(response);
  const rows = Array.isArray(data.conversations)
    ? data.conversations
    : Array.isArray(data.data)
      ? data.data
      : [];
  return rows.map(normalizeConversation).filter(Boolean) as ChatConversation[];
}

export async function getConversation(
  conversationId: number,
  viewerId?: number
): Promise<{ conversation: ChatConversation | null; messages: ChatMessage[] }> {
  const response = await apiFetch(`/chat/conversations/${conversationId}`, {
    method: "GET",
    auth: true,
    timeoutMs: 20000,
  });
  const data = await readJson<{
    conversation?: unknown;
    participants?: unknown[];
    messages?: unknown[];
  }>(response);
  const conversation = normalizeConversation(data.conversation);
  if (conversation && viewerId) {
    const other = (data.participants || [])
      .map((item) => toRecord(item))
      .find((row) => pickNumber(row.user_id, row.userId) !== viewerId);
    if (other) {
      conversation.otherUserId = pickNumber(other.user_id, other.userId) || conversation.otherUserId;
      conversation.otherUsername =
        pickString(other.username, other.display_name) || conversation.otherUsername;
      conversation.otherAvatar =
        pickString(other.profile_picture, other.user_picture, other.avatar) ||
        conversation.otherAvatar;
    }
  }
  const messages = (Array.isArray(data.messages) ? data.messages : [])
    .map((item) => normalizeMessage(item, conversationId))
    .filter(Boolean) as ChatMessage[];
  return { conversation, messages };
}

export async function sendChatMessage(
  conversationId: number,
  messageContent: string
): Promise<ChatMessage | null> {
  const response = await apiFetch(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    auth: true,
    timeoutMs: 20000,
    body: JSON.stringify({ messageContent }),
  });
  const data = await readJson<{ message?: unknown; data?: unknown }>(response);
  if (!response.ok) return null;
  return normalizeMessage(data.message ?? data.data, conversationId);
}

export async function markConversationRead(conversationId: number): Promise<boolean> {
  try {
    const response = await apiFetch(`/chat/conversations/${conversationId}/read`, {
      method: "POST",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function leaveConversation(conversationId: number): Promise<boolean> {
  try {
    const response = await apiFetch(`/chat/conversations/${conversationId}/leave`, {
      method: "POST",
      auth: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createDirectConversation(
  otherUserId: number
): Promise<DirectConversationResult | null> {
  const response = await apiFetch("/chat/conversations/direct", {
    method: "POST",
    auth: true,
    timeoutMs: 20000,
    body: JSON.stringify({ otherUserId }),
  });
  const data = await readJson<{
    pending?: boolean;
    message?: string;
    conversation?: unknown;
    conversation_id?: number;
  }>(response);
  if (data.pending) {
    return { pending: true, message: data.message };
  }
  if (!response.ok) return null;
  return (
    normalizeConversation(data.conversation) ||
    (pickNumber(data.conversation_id)
      ? {
          conversationId: Number(data.conversation_id),
          conversationType: "direct" as const,
          conversationName: "",
          lastMessageContent: "",
          unreadCount: 0,
        }
      : null)
  );
}

export async function getChatFollowing(): Promise<ChatFriendContact[]> {
  try {
    const response = await apiFetch("/chat/following", {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{ data?: unknown[]; contacts?: unknown[] }>(response);
    if (!response.ok) return [];
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.contacts)
        ? data.contacts
        : [];
    return rows
      .map(normalizeContact)
      .filter(Boolean)
      .map((row) => ({ ...(row as ChatFriendContact), kind: "business" as const }));
  } catch {
    return [];
  }
}

export async function getChatContacts(): Promise<ChatFriendContact[]> {
  try {
    const response = await apiFetch("/chat/contacts", {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{ data?: unknown[]; contacts?: unknown[] }>(response);
    const rows = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.contacts)
        ? data.contacts
        : [];
    return rows.map(normalizeContact).filter(Boolean) as ChatFriendContact[];
  } catch {
    return [];
  }
}

export async function getChatPresence(userIds: number[]): Promise<Set<number>> {
  const online = new Set<number>();
  const unique = [...new Set(userIds.filter((id) => id > 0))];
  if (!unique.length) return online;
  try {
    const response = await apiFetch(`/chat/presence?userIds=${unique.join(",")}`, {
      method: "GET",
      auth: true,
      timeoutMs: 12000,
    });
    const data = await readJson<{
      presence?: Record<string, unknown> | unknown[];
      onlineUserIds?: unknown[];
      online_user_ids?: unknown[];
      users?: unknown[];
    }>(response);
    const addId = (value: unknown) => {
      const id = Number(value);
      if (id > 0) online.add(id);
    };
    const list = data.onlineUserIds ?? data.online_user_ids;
    if (Array.isArray(list)) {
      for (const value of list) addId(value);
    }
    if (Array.isArray(data.users)) {
      for (const item of data.users) {
        const row = toRecord(item);
        const id = pickNumber(row.user_id, row.userId, row.id);
        const flagged =
          row.online === true ||
          row.is_online === true ||
          row.online === 1 ||
          row.online === "true";
        if (id && flagged) online.add(id);
      }
    }
    const presence = data.presence;
    if (presence && typeof presence === "object" && !Array.isArray(presence)) {
      for (const [key, value] of Object.entries(presence)) {
        const row = toRecord(value);
        const id = pickNumber(row.user_id, row.userId, key);
        const flagged =
          value === true ||
          row.online === true ||
          row.is_online === true ||
          row.online === 1;
        if (id && flagged) online.add(id);
      }
    }
  } catch {
    // Presence is best-effort.
  }
  return online;
}

export async function getBusinessMessageRequests(): Promise<{
  incoming: MessageRequest[];
  outgoing: MessageRequest[];
}> {
  try {
    const response = await apiFetch("/chat/business-message-requests", {
      method: "GET",
      auth: true,
      timeoutMs: 20000,
    });
    const data = await readJson<{ incoming?: unknown[]; outgoing?: unknown[] }>(response);
    return {
      incoming: (data.incoming || []).map(normalizeRequest).filter(Boolean) as MessageRequest[],
      outgoing: (data.outgoing || []).map(normalizeRequest).filter(Boolean) as MessageRequest[],
    };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}

export async function respondBusinessMessageRequest(
  requestId: number,
  accept: boolean
): Promise<{ conversationId?: number } | null> {
  const response = await apiFetch(`/chat/business-message-requests/${requestId}/respond`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ action: accept ? "accept" : "reject" }),
  });
  const data = await readJson<{
    success?: boolean;
    data?: { conversationId?: number; conversation_id?: number };
  }>(response);
  if (!response.ok || data.success === false) return null;
  const conversationId = pickNumber(
    data.data?.conversationId,
    data.data?.conversation_id
  );
  return { conversationId };
}
