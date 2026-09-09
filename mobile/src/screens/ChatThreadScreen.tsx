import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import PresenceAvatar from "../components/messages/PresenceAvatar";
import { ErrorBanner } from "../components/AppNotice";
import {
  getChatPresence,
  getConversation,
  markConversationRead,
  sendChatMessage,
  type ChatMessage,
} from "../api/chat";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";
import { isRecentlyActive } from "../utils/presence";
import { startForegroundInterval } from "../utils/foregroundInterval";
import { openMemberProfile } from "../utils/openProfile";
import ReportSheet from "../components/ReportSheet";
import { clearPushFocus, setPushFocus } from "../push/pushFocus";
import { reportPushFocus, reportPushFocusCleared } from "../push/pushNotifications";

export default function ChatThreadScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name?: string; avatar?: string }>();
  const conversationId = Number(params.id || 0);
  const [myId, setMyId] = useState(0);
  const [name, setName] = useState(String(params.name || "Chat"));
  const [avatar, setAvatar] = useState(String(params.avatar || ""));
  const [otherUserId, setOtherUserId] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    type: "conversation" | "message";
    id: number;
    userId?: number;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!allowed || !conversationId) return;
      let cancelled = false;
      let inFlight = false;
      setLoading(true);
      const refresh = async () => {
        if (cancelled || inFlight || AppState.currentState !== "active") return;
        inFlight = true;
        try {
          const user = await getUser();
          const userId = Number(user?.user_id || 0);
          if (!userId || cancelled) return;
          const result = await getConversation(conversationId, userId);
          if (cancelled || AppState.currentState !== "active") return;
          setMyId(userId);
          if (result.conversation) {
            setName((current) => result.conversation?.otherUsername || result.conversation?.conversationName || current);
            if (result.conversation.otherAvatar) setAvatar(result.conversation.otherAvatar);
            if (result.conversation.otherUserId) setOtherUserId(result.conversation.otherUserId);
          }
          setMessages((current) => {
            const merged = new Map(current.map((message) => [message.messageId, message]));
            for (const message of result.messages) {
              const previous = merged.get(message.messageId);
              merged.set(message.messageId, { ...message, seen: message.seen || previous?.seen });
            }
            return [...merged.values()].sort((a, b) => a.messageId - b.messageId);
          });
          // Wait for the loaded conversation to render before acknowledging it.
          requestAnimationFrame(() => {
            if (!cancelled && AppState.currentState === "active") {
              void markConversationRead(conversationId);
            }
          });
        } catch {
          // Keep the current thread during temporary connection failures.
        } finally {
          inFlight = false;
          if (!cancelled) setLoading(false);
        }
      };
      void refresh();
      const stop = startForegroundInterval(() => void refresh(), 5000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      return () => {
        cancelled = true;
        stop();
        subscription.remove();
      };
    }, [allowed, conversationId])
  );

  useEffect(() => {
    setMessages([]);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return () => undefined;
      setPushFocus("messages", conversationId);
      void reportPushFocus("messages", conversationId);
      const stop = startForegroundInterval(() => {
        void reportPushFocus("messages", conversationId);
      }, 30000);
      return () => {
        stop();
        clearPushFocus();
        void reportPushFocusCleared();
      };
    }, [conversationId])
  );

  const latestFromPeer = useMemo(
    () => [...messages].reverse().find((row) => row.senderId === otherUserId)?.createdAt,
    [messages, otherUserId]
  );

  useEffect(() => {
    if (!allowed || !otherUserId) {
      setOnline(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const ids = await getChatPresence([otherUserId]);
      if (cancelled) return;
      const fromPresence = ids.has(otherUserId);
      setOnline(fromPresence || isRecentlyActive(latestFromPeer));
    };
    void tick();
    const stop = startForegroundInterval(() => void tick(), 20000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [allowed, otherUserId, latestFromPeer]);

  const shownOnline = online === true || isRecentlyActive(latestFromPeer);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;
    const selectedReply = replyTo;
    setSending(true);
    setDraft("");
    setReplyTo(null);
    setSendError(null);
    try {
      const result = await sendChatMessage(conversationId, text, selectedReply?.messageId);
      if (result.message) {
        setMessages((current) => {
          if (current.some((row) => row.messageId === result.message!.messageId)) return current;
          return [...current, { ...result.message!, senderId: result.message!.senderId || myId }];
        });
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      } else {
        setDraft(text);
        setReplyTo(selectedReply);
        setSendError(result.error || t("messages.sendFailed"));
      }
    } catch {
      setDraft(text);
      setReplyTo(selectedReply);
      setSendError(t("messages.sendFailed"));
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, sending, myId, replyTo, t]);

  const selectReply = useCallback((message: ChatMessage) => {
    setReplyTo(message);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const canSend = Boolean(draft.trim()) && !sending;

  const rows = useMemo(() => messages, [messages]);

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/messages"))}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => openMemberProfile(router, otherUserId)}
          disabled={!otherUserId}
          style={styles.identity}
          accessibilityRole="button"
        >
          <PresenceAvatar name={name} uri={avatar} size={36} online={otherUserId ? shownOnline : null} />
          <View style={styles.identityText}>
            <Text style={styles.title} numberOfLines={1}>
              {name}
            </Text>
            {otherUserId ? (
              <Text style={shownOnline ? styles.online : styles.offline}>
                {shownOnline ? t("messages.online") : t("messages.offline")}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() =>
            setReport({
              type: "conversation",
              id: conversationId,
              userId: otherUserId || undefined,
            })
          }
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("messages.report")}
        >
          <Ionicons name="flag-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={8}
      >
        {loading ? (
          <View style={styles.centered}>
            <JosCityLoader color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.thread}
            directionalLockEnabled
            canCancelContentTouches
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {rows.length === 0 ? (
              <Text style={styles.empty}>No messages yet. Say hello.</Text>
            ) : (
              rows.map((item) => {
                const mine = myId > 0 && item.senderId === myId;
                return (
                  <SwipeReplyMessage
                    key={item.messageId}
                    item={item}
                    mine={mine}
                    myId={myId}
                    peerName={name}
                    colors={colors}
                    styles={styles}
                    onReply={selectReply}
                    onReport={() =>
                      setReport({
                        type: "message",
                        id: item.messageId,
                        userId: item.senderId,
                      })
                    }
                  />
                );
              })
            )}
          </ScrollView>
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {sendError ? (
            <View style={styles.sendError}>
              <ErrorBanner message={sendError} />
            </View>
          ) : null}
          {replyTo ? (
            <View style={styles.replyPreview}>
              <View style={styles.replyPreviewCopy}>
                <Text style={styles.replyPreviewName}>
                  {replyTo.senderId === myId ? "You" : name}
                </Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyTo.messageContent}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyTo(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (sendError) setSendError(null);
            }}
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Ionicons name="send" size={16} color={colors.white} />
          </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <ReportSheet
        visible={Boolean(report)}
        onClose={() => setReport(null)}
        contentType={report?.type === "message" ? "message" : "conversation"}
        contentId={report?.id}
        reportedUserId={report?.userId || otherUserId || null}
      />
    </View>
  );
}

function SwipeReplyMessage({
  item,
  mine,
  myId,
  peerName,
  colors,
  styles,
  onReply,
  onReport,
}: {
  item: ChatMessage;
  mine: boolean;
  myId: number;
  peerName: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  onReply: (message: ChatMessage) => void;
  onReport: () => void;
}) {
  const { t } = useI18n();
  const translateX = useRef(new Animated.Value(0)).current;
  const replyActionOpacity = translateX.interpolate({
    inputRange: [0, 15, 30],
    outputRange: [0, 0.45, 1],
    extrapolate: "clamp",
  });
  const replyActionScale = translateX.interpolate({
    inputRange: [0, 30],
    outputRange: [0.65, 1],
    extrapolate: "clamp",
  });
  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 5,
    }).start();
  }, [translateX]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx > 3 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1,
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          gesture.dx > 3 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_event, gesture) => {
          translateX.setValue(Math.min(Math.max(gesture.dx, 0), 52));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx >= 30) onReply(item);
          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [item, onReply, resetPosition, translateX]
  );
  const quotedSender =
    item.replyToSenderId === myId
      ? "You"
      : item.replyToSenderUsername || peerName;

  return (
    <View style={mine ? styles.swipeMine : styles.swipeTheirs}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeReplyAction,
          {
            opacity: replyActionOpacity,
            transform: [{ scale: replyActionScale }],
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={21} color={colors.primary} />
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {item.replyToId && item.replyToContent ? (
            <View
              style={[
                styles.quotedMessage,
                mine ? styles.quotedMessageMine : styles.quotedMessageTheirs,
              ]}
            >
              <Text
                style={[styles.quotedSender, mine && styles.quotedSenderMine]}
                numberOfLines={1}
              >
                {quotedSender}
              </Text>
              <Text
                style={[styles.quotedText, mine && styles.quotedTextMine]}
                numberOfLines={2}
              >
                {item.replyToContent}
              </Text>
            </View>
          ) : null}
          <Text
            style={[styles.bubbleText, mine && styles.bubbleTextMine]}
            onLongPress={mine ? undefined : onReport}
          >
            {item.messageContent}
          </Text>
        </View>
        <Text style={styles.stamp}>{timeAgo(item.createdAt)}</Text>
        {mine && item.seen ? <Text style={styles.stamp}>{t("messages.seen")}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 17,
    color: colors.text,
  },
  offline: {
    marginTop: 1,
    fontFamily: "Montserrat_500Medium",
    fontSize: 12,
    color: "#9CA3AF",
  },
  online: {
    marginTop: 1,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#22C55E",
  },
  body: {
    flex: 1,
  },
  thread: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  empty: {
    marginTop: 40,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  bubbleWrap: {
    maxWidth: "100%",
  },
  bubbleWrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  bubbleWrapTheirs: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  swipeMine: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    overflow: "visible",
  },
  swipeTheirs: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    overflow: "visible",
  },
  swipeReplyAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.sheet,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  quotedMessage: {
    marginBottom: 6,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  quotedMessageMine: {
    borderLeftColor: colors.white,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  quotedMessageTheirs: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.background,
  },
  quotedSender: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: colors.primary,
  },
  quotedSenderMine: {
    color: colors.white,
  },
  quotedText: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  quotedTextMine: {
    color: "rgba(255,255,255,0.84)",
  },
  stamp: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  sendError: {
    marginBottom: 4,
  },
  replyPreview: {
    minHeight: 52,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.sheet,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replyPreviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  replyPreviewName: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: colors.primary,
  },
  replyPreviewText: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    backgroundColor: colors.sheet,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    backgroundColor: "#9AAE9A",
  },
});
}
