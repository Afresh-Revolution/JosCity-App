import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PresenceAvatar from "../components/messages/PresenceAvatar";
import SwipeableChatRow from "../components/messages/SwipeableChatRow";
import {
  createDirectConversation,
  getBusinessMessageRequests,
  getChatContacts,
  getChatFollowing,
  getChatPresence,
  getUserConversations,
  leaveConversation,
  respondBusinessMessageRequest,
  type ChatConversation,
  type ChatFriendContact,
  type MessageRequest,
} from "../api/chat";
import { getBusinessFollowers, getBusinessesIFollow } from "../api/marketplace";
import {
  friendDisplayName,
  getApprovedUsers,
  getMyFriends,
} from "../api/social";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getAccountType, getUser, isBusinessAccountType } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";
import { peerIsOnline } from "../utils/presence";
import { startForegroundInterval } from "../utils/foregroundInterval";

const hiddenChatAt = new Map<number, number>();
const hiddenPeerAt = new Map<number, number>();

function hideInboxChat(conversationId: number, otherUserId?: number) {
  const now = Date.now();
  hiddenChatAt.set(conversationId, now);
  if (otherUserId) hiddenPeerAt.set(otherUserId, now);
}

function isHiddenInboxChat(chat: ChatConversation) {
  const oid = Number(chat.otherUserId) || 0;
  const hiddenAt = hiddenChatAt.get(chat.conversationId) || (oid ? hiddenPeerAt.get(oid) : undefined);
  if (!hiddenAt) return false;
  const lastAt = Date.parse(String(chat.lastMessageAt || ""));
  if (Number.isFinite(lastAt) && lastAt > hiddenAt + 750) {
    hiddenChatAt.delete(chat.conversationId);
    if (oid) hiddenPeerAt.delete(oid);
    return false;
  }
  return true;
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [friends, setFriends] = useState<ChatFriendContact[]>([]);
  const [following, setFollowing] = useState<ChatFriendContact[]>([]);
  const [incoming, setIncoming] = useState<MessageRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MessageRequest[]>([]);
  const [isBusiness, setIsBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const peerIdsRef = useRef<number[]>([]);

  const load = useCallback(async () => {
    const [me, accountType] = await Promise.all([getUser(), getAccountType()]);
    const myId = Number(me?.user_id || 0);
    const businessMode = isBusinessAccountType(accountType);
    setIsBusiness(businessMode);
    const [conversations, friendRows, chatContacts, followerRows, followingRows, directory, requests] =
      await Promise.all([
        getUserConversations(1, 100).catch(() => [] as ChatConversation[]),
        getMyFriends().catch(() => []),
        getChatContacts().catch(() => [] as ChatFriendContact[]),
        businessMode ? getBusinessFollowers().catch(() => []) : Promise.resolve([]),
        businessMode
          ? Promise.resolve([])
          : getChatFollowing()
              .then(async (rows) => {
                if (rows.length) return rows;
                const shops = await getBusinessesIFollow().catch(() => []);
                return shops.map((row) => ({
                  userId: row.user_id,
                  displayName: row.display_name,
                  avatarUrl: row.user_picture || "",
                  address: row.address || "Jos",
                  kind: "business" as const,
                }));
              })
              .catch(() => [] as ChatFriendContact[]),
        getApprovedUsers({ limit: 40, accountType: "all" }).catch(() => []),
        getBusinessMessageRequests(),
      ]);

    const addressById = new Map<number, string>();
    const avatarById = new Map<number, string>();
    for (const person of directory) {
      if (person.address?.trim()) addressById.set(person.user_id, person.address.trim());
      if (person.user_picture) avatarById.set(person.user_id, person.user_picture);
    }
    for (const row of friendRows) {
      const url = row.user_picture || row.profile_image_url;
      if (url) avatarById.set(row.user_id, url);
    }
    for (const row of followerRows) {
      if (row.user_picture) avatarById.set(row.user_id, row.user_picture);
      if (row.address?.trim()) addressById.set(row.user_id, row.address.trim());
    }
    for (const row of followingRows) {
      if (row.avatarUrl) avatarById.set(row.userId, row.avatarUrl);
      if (row.address?.trim()) addressById.set(row.userId, row.address.trim());
    }
    for (const row of chatContacts) {
      if (row.avatarUrl) avatarById.set(row.userId, row.avatarUrl);
      if (row.address?.trim()) addressById.set(row.userId, row.address.trim());
    }

    const patched = conversations.map((chat) => {
      const oid = chat.otherUserId;
      const fromMe = Boolean(myId && chat.lastMessageSenderId === myId);
      return {
        ...chat,
        otherAvatar:
          oid && !chat.otherAvatar?.trim() && avatarById.get(oid)
            ? avatarById.get(oid)
            : chat.otherAvatar,
        unreadCount: fromMe ? 0 : Math.max(chat.unreadCount, 0),
      };
    });

    const conversationHasHistory = (chat: ChatConversation) =>
      Boolean(String(chat.lastMessageContent || "").trim() || chat.unreadCount > 0);
    const chatsWithHistory = businessMode
      ? patched
      : patched.filter((chat) => conversationHasHistory(chat) && !isHiddenInboxChat(chat));
    const inChat = new Set<number>();
    const inChatNames = new Set<string>();
    for (const chat of chatsWithHistory) {
      const oid = Number(chat.otherUserId);
      if (oid) inChat.add(oid);
      const name = (chat.otherUsername || chat.conversationName || "").trim().toLowerCase();
      if (name) inChatNames.add(name);
    }
    const isAlreadyChatting = (contact: ChatFriendContact) =>
      inChat.has(contact.userId) ||
      inChatNames.has((contact.displayName || "").trim().toLowerCase());

    const byId = new Map<number, ChatFriendContact>();
    const addContact = (
      userId: number,
      displayName: string,
      avatarUrl: string,
      address: string,
      kind: "person" | "business" = "person"
    ) => {
      const id = Number(userId);
      if (!id || id === myId) return;
      const existing = byId.get(id);
      byId.set(id, {
        userId: id,
        displayName: existing?.displayName || displayName,
        avatarUrl: existing?.avatarUrl || avatarUrl,
        address:
          existing?.address && existing.address !== "Jos" ? existing.address : address,
        kind: existing?.kind === "business" || kind === "business" ? "business" : "person",
      });
    };

    for (const row of chatContacts) {
      addContact(
        row.userId,
        row.displayName,
        row.avatarUrl,
        row.address || "Jos",
        row.kind === "business" ? "business" : "person"
      );
    }
    for (const row of followerRows) {
      addContact(
        row.user_id,
        row.display_name,
        row.user_picture || avatarById.get(row.user_id) || "",
        row.address?.trim() || addressById.get(row.user_id) || "Jos",
        "person"
      );
    }
    for (const row of friendRows) {
      const id = Number(row.user_id);
      const isShop = String(row.account_type || "").toLowerCase() === "business";
      addContact(
        id,
        friendDisplayName(row),
        row.user_picture || row.profile_image_url || avatarById.get(id) || "",
        row.address?.trim() || addressById.get(id) || "Jos",
        isShop ? "business" : "person"
      );
    }
    for (const row of followingRows) {
      addContact(
        row.userId,
        row.displayName,
        row.avatarUrl || avatarById.get(row.userId) || "",
        row.address?.trim() || addressById.get(row.userId) || "Jos",
        "business"
      );
    }
    if (!businessMode) {
      for (const chat of patched) {
        if (!chat.otherUserId || inChat.has(Number(chat.otherUserId))) continue;
        addContact(
          Number(chat.otherUserId),
          chat.otherUsername || chat.conversationName,
          chat.otherAvatar || avatarById.get(Number(chat.otherUserId)) || "",
          addressById.get(Number(chat.otherUserId)) || "Jos",
          "person"
        );
      }
    }

    const allContacts = [...byId.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    const nextFriends = businessMode
      ? allContacts.filter((contact) => !isAlreadyChatting(contact))
      : allContacts.filter(
          (contact) => contact.kind !== "business" && !isAlreadyChatting(contact)
        );
    const nextFollowing = businessMode
      ? []
      : allContacts.filter(
          (contact) => contact.kind === "business" && !isAlreadyChatting(contact)
        );

    setChats(chatsWithHistory);
    setFriends(nextFriends);
    setFollowing(nextFollowing);
    setIncoming(requests.incoming);
    setOutgoing(requests.outgoing.filter((row) => row.status === "pending"));
    setError(null);

    const ids = [
      ...patched.map((chat) => chat.otherUserId || 0),
      ...nextFriends.map((friend) => friend.userId),
      ...nextFollowing.map((shop) => shop.userId),
    ].filter((id) => id > 0);
    peerIdsRef.current = ids;
    void getChatPresence(ids).then(setOnlineIds);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    void load()
      .catch(() => setError("We couldn't load your messages. Pull down to try again."))
      .finally(() => setLoading(false));
  }, [allowed, load]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().catch(() => undefined);
      const stop = startForegroundInterval(() => {
        const ids = peerIdsRef.current;
        if (!ids.length) return;
        void getChatPresence(ids).then(setOnlineIds);
      }, 20000);
      return () => stop();
    }, [allowed, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      setError("We couldn't load your messages. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const q = query.trim().toLowerCase();
  const filteredChats = useMemo(
    () =>
      q
        ? chats.filter(
            (chat) =>
              chat.conversationName.toLowerCase().includes(q) ||
              (chat.otherUsername || "").toLowerCase().includes(q) ||
              chat.lastMessageContent.toLowerCase().includes(q)
          )
        : chats,
    [chats, q]
  );
  const filteredFriends = useMemo(
    () =>
      q
        ? friends.filter(
            (friend) =>
              friend.displayName.toLowerCase().includes(q) ||
              (friend.address || "").toLowerCase().includes(q)
          )
        : friends,
    [friends, q]
  );
  const filteredFollowing = useMemo(
    () =>
      q
        ? following.filter(
            (shop) =>
              shop.displayName.toLowerCase().includes(q) ||
              (shop.address || "").toLowerCase().includes(q)
          )
        : following,
    [following, q]
  );

  const openChat = (conversationId: number, name: string, avatar?: string) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/messages/[id]",
      params: { id: String(conversationId), name, avatar: avatar || "" },
    });
  };

  const deleteChat = async (conversationId: number) => {
    setOpenId(null);
    Keyboard.dismiss();
    const removed = chats.find((chat) => chat.conversationId === conversationId);
    const previousChats = chats;
    const previousFriends = friends;
    hideInboxChat(conversationId, removed?.otherUserId);
    setChats((current) => current.filter((chat) => chat.conversationId !== conversationId));
    if (!isBusiness && removed?.otherUserId) {
      const nextFriend: ChatFriendContact = {
        userId: removed.otherUserId,
        displayName: removed.otherUsername || removed.conversationName,
        avatarUrl: removed.otherAvatar || "",
        address: "Jos",
      };
      setFriends((current) =>
        current.some((friend) => friend.userId === nextFriend.userId)
          ? current
          : [...current, nextFriend].sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
    }
    const ok = await leaveConversation(conversationId);
    if (!ok) {
      hiddenChatAt.delete(conversationId);
      if (removed?.otherUserId) hiddenPeerAt.delete(removed.otherUserId);
      setChats(previousChats);
      setFriends(previousFriends);
      setError(t("messages.deleteFailed"));
      return;
    }
    void load().catch(() => undefined);
  };

  const startChat = async (friend: ChatFriendContact) => {
    if (openingId) return;
    Keyboard.dismiss();
    setOpeningId(friend.userId);
    try {
      const conversation = await createDirectConversation(friend.userId);
      if (conversation && "pending" in conversation && conversation.pending) {
        setError(conversation.message || t("business.messageRequestedBody", { name: friend.displayName }));
        void load();
        return;
      }
      if (!conversation || !("conversationId" in conversation)) {
        setError("We couldn't start this chat. Please try again.");
        return;
      }
      openChat(
        conversation.conversationId,
        friend.displayName,
        conversation.otherAvatar || friend.avatarUrl
      );
    } finally {
      setOpeningId(null);
    }
  };

  const respondRequest = async (request: MessageRequest, accept: boolean) => {
    if (openingId) return;
    setOpeningId(request.requestId);
    try {
      const result = await respondBusinessMessageRequest(request.requestId, accept);
      if (!result) {
        setError(t("messages.requestFailed"));
        return;
      }
      setIncoming((current) => current.filter((row) => row.requestId !== request.requestId));
      if (accept && result.conversationId) {
        openChat(result.conversationId, request.displayName, request.picture || "");
      } else {
        void load();
      }
    } finally {
      setOpeningId(null);
    }
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="messages"
      header={
        <FadeIn duration={480} translateY={8}>
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.header}>
              <Text style={styles.kicker}>{t("messages.kicker")}</Text>
              <Text style={styles.title}>{t("messages.title")}</Text>
            </View>
          </Pressable>
        </FadeIn>
      }
    >
      {loading &&
      chats.length === 0 &&
      friends.length === 0 &&
      following.length === 0 &&
      incoming.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <View style={styles.body}>
          <FadeIn delay={40}>
            <View style={styles.searchWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={isBusiness ? t("messages.searchBusiness") : t("messages.search")}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          </FadeIn>
          <View style={styles.listWrap}>
            <GestureScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void onRefresh()}
                  tintColor={colors.primary}
                />
              }
            >
          {error ? <ErrorBanner message={error} /> : null}

          {incoming.length ? (
            <FadeIn delay={50}>
              <Text style={styles.section}>{t("messages.requests")}</Text>
            </FadeIn>
          ) : null}

          {incoming.map((request, index) => (
            <FadeIn key={`req-${request.requestId}`} delay={Math.min(50 + index * 40, 180)}>
              <View style={styles.row}>
                <AvatarCircle name={request.displayName} uri={request.picture} size={48} />
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {request.displayName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={2}>
                    {t("messages.wantsToMessage", { name: request.displayName })}
                  </Text>
                  <View style={styles.requestActions}>
                    <Pressable
                      onPress={() => void respondRequest(request, false)}
                      disabled={openingId === request.requestId}
                      style={styles.rejectBtn}
                    >
                      <Text style={styles.rejectText}>{t("messages.reject")}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void respondRequest(request, true)}
                      disabled={openingId === request.requestId}
                      style={styles.acceptBtn}
                    >
                      {openingId === request.requestId ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Text style={styles.acceptText}>{t("messages.accept")}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </FadeIn>
          ))}

          {outgoing.length && !isBusiness ? (
            <FadeIn delay={70}>
              <Text style={styles.section}>{t("messages.waiting")}</Text>
            </FadeIn>
          ) : null}

          {!isBusiness
            ? outgoing.map((request, index) => (
                <FadeIn key={`out-${request.requestId}`} delay={Math.min(70 + index * 40, 180)}>
                  <View style={styles.row}>
                    <AvatarCircle name={request.displayName} uri={request.picture} size={48} />
                    <View style={styles.copy}>
                      <Text style={styles.name} numberOfLines={1}>
                        {request.displayName}
                      </Text>
                      <Text style={styles.meta} numberOfLines={2}>
                        {t("messages.waitingHint")}
                      </Text>
                    </View>
                  </View>
                </FadeIn>
              ))
            : null}

          {filteredChats.length ? (
            <FadeIn delay={60}>
              <Text style={styles.section}>{t("messages.chats")}</Text>
            </FadeIn>
          ) : null}

          {filteredChats.map((chat, index) => {
            const name = chat.otherUsername || chat.conversationName;
            const unread = Math.max(chat.unreadCount, 0);
            const peerId = chat.otherUserId || 0;
            const online = peerIsOnline({
              peerId,
              onlineIds,
              lastMessageAt: chat.lastMessageAt,
              lastMessageSenderId: chat.lastMessageSenderId,
            });
            return (
              <FadeIn key={`chat-${chat.conversationId}`} delay={Math.min(60 + index * 40, 200)}>
                <SwipeableChatRow
                  enabled={!openingId}
                  open={openId === chat.conversationId}
                  deleteLabel={t("messages.delete")}
                  onOpen={() => setOpenId(chat.conversationId)}
                  onClose={() =>
                    setOpenId((current) => (current === chat.conversationId ? null : current))
                  }
                  onDelete={() => void deleteChat(chat.conversationId)}
                >
                  <Pressable
                    onPress={() => {
                      if (openId === chat.conversationId) {
                        setOpenId(null);
                        return;
                      }
                      openChat(chat.conversationId, name, chat.otherAvatar);
                    }}
                    style={styles.row}
                  >
                    <PresenceAvatar name={name} uri={chat.otherAvatar} size={48} online={peerId > 0 ? online : null} />
                    <View style={styles.copy}>
                      <View style={styles.topLine}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name} numberOfLines={1}>
                            {name}
                          </Text>
                          {peerId > 0 ? (
                            <Text style={online ? styles.online : styles.offline}>
                              {online ? t("messages.online") : t("messages.offline")}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.time}>{timeAgo(chat.lastMessageAt)}</Text>
                      </View>
                      <View style={styles.bottomLine}>
                        <Text style={styles.preview} numberOfLines={1}>
                          {chat.lastMessageContent || t("messages.empty")}
                        </Text>
                        {unread > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                </SwipeableChatRow>
              </FadeIn>
            );
          })}

          {filteredFriends.length || !isBusiness ? (
            <FadeIn delay={120}>
              <Text style={styles.section}>
                {isBusiness ? t("messages.followers") : t("messages.friends")}
              </Text>
            </FadeIn>
          ) : null}

          {filteredFriends.length
            ? filteredFriends.map((friend, index) => (
            <FadeIn key={`friend-${friend.userId}`} delay={Math.min(140 + index * 40, 240)}>
              <Pressable
                onPress={() => void startChat(friend)}
                disabled={openingId === friend.userId}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`Message ${friend.displayName}`}
              >
                <PresenceAvatar
                  name={friend.displayName}
                  uri={friend.avatarUrl}
                  size={48}
                  online={onlineIds.has(friend.userId)}
                />
                <View style={styles.copy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {friend.displayName}
                    </Text>
                    <Text style={onlineIds.has(friend.userId) ? styles.online : styles.offline}>
                      {onlineIds.has(friend.userId) ? t("messages.online") : t("messages.offline")}
                    </Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {openingId === friend.userId
                      ? t("messages.starting")
                      : t("messages.startHint")}
                  </Text>
                </View>
                {openingId === friend.userId ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            </FadeIn>
          ))
            : !isBusiness && !q ? (
              <Text style={styles.empty}>{t("messages.noFriends")}</Text>
            ) : null}

          {!isBusiness ? (
            <FadeIn delay={160}>
              <Text style={styles.section}>{t("messages.following")}</Text>
            </FadeIn>
          ) : null}

          {!isBusiness && filteredFollowing.length
            ? filteredFollowing.map((shop, index) => (
                <FadeIn key={`follow-${shop.userId}`} delay={Math.min(180 + index * 40, 280)}>
                  <Pressable
                    onPress={() => void startChat(shop)}
                    disabled={openingId === shop.userId}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${shop.displayName}`}
                  >
                    <PresenceAvatar
                      name={shop.displayName}
                      uri={shop.avatarUrl}
                      size={48}
                      online={onlineIds.has(shop.userId)}
                    />
                    <View style={styles.copy}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {shop.displayName}
                        </Text>
                        <Text style={onlineIds.has(shop.userId) ? styles.online : styles.offline}>
                          {onlineIds.has(shop.userId) ? t("messages.online") : t("messages.offline")}
                        </Text>
                      </View>
                      <Text style={styles.meta} numberOfLines={1}>
                        {openingId === shop.userId
                          ? t("messages.starting")
                          : t("messages.startHint")}
                      </Text>
                    </View>
                    {openingId === shop.userId ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Ionicons name="storefront-outline" size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                </FadeIn>
              ))
            : !isBusiness && !q ? (
              <Text style={styles.empty}>{t("messages.noFollowing")}</Text>
            ) : !isBusiness && q && !filteredFriends.length ? (
              <Text style={styles.empty}>{t("messages.searchEmpty")}</Text>
            ) : null}

          {isBusiness &&
          !filteredChats.length &&
          !filteredFriends.length &&
          !incoming.length &&
          !outgoing.length ? (
            <Text style={styles.empty}>
              {q ? t("messages.searchEmptyBusiness") : t("messages.noneBusiness")}
            </Text>
          ) : null}
            </GestureScrollView>
            {keyboardVisible ? (
              <Pressable
                onPress={Keyboard.dismiss}
                accessible
                accessibilityLabel="Hide keyboard"
                style={styles.keyboardDismiss}
              />
            ) : null}
          </View>
        </View>
      )}
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  kicker: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 32,
    color: colors.text,
  },
  body: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  keyboardDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: TAB_BAR_SPACE + 16,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sheet,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  searchInput: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.error,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomLine: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  offline: {
    flexShrink: 0,
    fontFamily: "Montserrat_500Medium",
    fontSize: 11,
    color: "#9CA3AF",
  },
  online: {
    flexShrink: 0,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#22C55E",
  },
  time: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  preview: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  meta: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.white,
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    lineHeight: 14,
  },
  section: {
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 16,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  requestActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  rejectBtn: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: colors.text,
  },
  acceptBtn: {
    minHeight: 34,
    minWidth: 88,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
    color: colors.white,
  },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.navActive,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    marginTop: 32,
    paddingHorizontal: 24,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
});
}
