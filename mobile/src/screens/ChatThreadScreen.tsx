import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
} from "react-native-gesture-handler";
import JosCityLoader from "../components/JosCityLoader";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import PresenceAvatar from "../components/messages/PresenceAvatar";
import MessageReceiptMark from "../components/messages/MessageReceipt";
import StatusReplyBubble from "../components/messages/StatusReplyBubble";
import VoiceMessageBubble from "../components/messages/VoiceMessageBubble";
import { ErrorBanner } from "../components/AppNotice";
import {
  getChatPresence,
  getConversation,
  markConversationRead,
  sendChatMessage,
  sendVoiceMessage,
  deleteChatMessage,
  type ChatMessage,
  type MessageReceipt,
} from "../api/chat";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";
import { parseStatusReply } from "../utils/statusReply";
import { isRecentlyActive } from "../utils/presence";
import { startForegroundInterval } from "../utils/foregroundInterval";
import { openMemberProfile } from "../utils/openProfile";
import ReportSheet from "../components/ReportSheet";
import PostOptionsSheet from "../components/feed/PostOptionsSheet";
import * as Clipboard from "expo-clipboard";
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
  const [recording, setRecording] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    type: "conversation" | "message";
    id: number;
    userId?: number;
  } | null>(null);
  const [menuMessage, setMenuMessage] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    void getUser().then((user) => {
      const userId = Number(user?.user_id || 0);
      if (userId) setMyId(userId);
    });
  }, []);

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
              merged.set(message.messageId, {
                ...message,
                seen: message.seen || previous?.seen,
                receipt: strongerReceipt(previous?.receipt, message.receipt, message.seen || previous?.seen),
              });
            }
            return [...merged.values()].sort((a, b) => {
              const aPending = a.messageId < 0;
              const bPending = b.messageId < 0;
              if (aPending !== bPending) return aPending ? 1 : -1;
              return a.messageId - b.messageId;
            });
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
      const markViewing = () => {
        setPushFocus("messages", conversationId);
        void reportPushFocus("messages", conversationId);
      };
      const markAway = () => {
        clearPushFocus();
        void reportPushFocusCleared();
      };
      if (AppState.currentState === "active") markViewing();
      else markAway();
      const stop = startForegroundInterval(markViewing, 30000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") markViewing();
        else markAway();
      });
      return () => {
        stop();
        subscription.remove();
        markAway();
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
          return [...current, { ...result.message!, senderId: result.message!.senderId || myId, receipt: result.message!.receipt || "sent" }];
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

  const onSendVoice = useCallback(
    async (uri: string, duration: number) => {
      if (!conversationId || sending) {
        setRecording(false);
        return;
      }
      const selectedReply = replyTo;
      const pendingId = -Date.now();
      setRecording(false);
      setSending(true);
      setReplyTo(null);
      setSendError(null);
      setMessages((current) => [
        ...current,
        {
          messageId: pendingId,
          conversationId,
          senderId: myId,
          messageContent: "Voice message",
          messageType: "voice",
          attachmentUrl: uri,
          duration: Math.max(1, Math.round(duration)),
          createdAt: new Date().toISOString(),
          receipt: "sending",
        },
      ]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      try {
        const result = await sendVoiceMessage(conversationId, uri, duration, selectedReply?.messageId);
        if (result.message) {
          setMessages((current) => {
            const withoutPending = current.filter((row) => row.messageId !== pendingId);
            if (withoutPending.some((row) => row.messageId === result.message!.messageId)) {
              return withoutPending;
            }
            return [
              ...withoutPending,
              { ...result.message!, senderId: result.message!.senderId || myId, receipt: "sent" },
            ];
          });
          requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
        } else {
          setMessages((current) => current.filter((row) => row.messageId !== pendingId));
          setReplyTo(selectedReply);
          setSendError(result.error || t("messages.voiceFailed"));
        }
      } catch {
        setMessages((current) => current.filter((row) => row.messageId !== pendingId));
        setReplyTo(selectedReply);
        setSendError(t("messages.voiceFailed"));
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, myId, replyTo, t]
  );

  const selectReply = useCallback((message: ChatMessage) => {
    if (message.isDeleted) return;
    setReplyTo(message);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const removeMessage = useCallback(
    async (message: ChatMessage) => {
      const result = await deleteChatMessage(message.messageId);
      if (!result?.isDeleted) {
        Alert.alert("", t("messages.deleteMessageFailed"));
        return;
      }
      setMessages((prev) =>
        prev.map((row) =>
          row.messageId === message.messageId
            ? { ...row, isDeleted: true, messageContent: t("messages.deleted") }
            : row
        )
      );
      setReplyTo((prev) => (prev?.messageId === message.messageId ? null : prev));
    },
    [t]
  );

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
            keyboardShouldPersistTaps="handled"
            delayContentTouches={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {rows.length === 0 ? (
              <Text style={styles.empty}>No messages yet. Say hello.</Text>
            ) : (
              rows.map((item) => {
                const mine = myId > 0 && Number(item.senderId) === Number(myId);
                return (
                  <SwipeReplyMessage
                    key={item.messageId}
                    item={item}
                    mine={mine}
                    myId={myId}
                    peerName={name}
                    colors={colors}
                    styles={styles}
                    playing={playingVoiceId === item.messageId}
                    onToggleVoice={() =>
                      setPlayingVoiceId((current) =>
                        current === item.messageId ? null : item.messageId
                      )
                    }
                    onVoiceEnded={() =>
                      setPlayingVoiceId((current) =>
                        current === item.messageId ? null : current
                      )
                    }
                    onReply={selectReply}
                    onOpenMenu={setMenuMessage}
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
          {recording ? (
            <VoiceRecordBar
              colors={colors}
              styles={styles}
              onSend={(uri, duration) => void onSendVoice(uri, duration)}
              onCancel={() => setRecording(false)}
            />
          ) : (
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
          {sending ? (
            <View style={styles.send} accessibilityLabel="Sending">
              <JosCityLoader color={colors.white} size={18} />
            </View>
          ) : canSend ? (
            <Pressable
              onPress={() => void onSend()}
              style={styles.send}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Ionicons name="send" size={16} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setRecording(true)}
              style={styles.send}
              accessibilityRole="button"
              accessibilityLabel={t("messages.voice")}
            >
              <Ionicons name="mic" size={18} color={colors.white} />
            </Pressable>
          )}
          </View>
          )}
        </View>
      </KeyboardAvoidingView>
      <ReportSheet
        visible={Boolean(report)}
        onClose={() => setReport(null)}
        contentType={report?.type === "message" ? "message" : "conversation"}
        contentId={report?.id}
        reportedUserId={report?.userId || otherUserId || null}
      />
      <PostOptionsSheet
        visible={Boolean(menuMessage && !menuMessage.isDeleted)}
        title="Message"
        onClose={() => setMenuMessage(null)}
        options={[
          {
            key: "copy",
            label: "Copy",
            onPress: () => {
              const body = String(menuMessage?.messageContent || "");
              setMenuMessage(null);
              if (body) void Clipboard.setStringAsync(body);
            },
          },
          ...(myId > 0 && menuMessage && Number(menuMessage.senderId) === Number(myId)
            ? [
                {
                  key: "delete",
                  label: t("messages.delete"),
                  destructive: true,
                  onPress: () => {
                    const target = menuMessage;
                    setMenuMessage(null);
                    if (!target) return;
                    setTimeout(() => {
                      Alert.alert(
                        t("messages.deleteMessage"),
                        t("messages.deleteMessageConfirm"),
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("messages.delete"),
                            style: "destructive",
                            onPress: () => void removeMessage(target),
                          },
                        ]
                      );
                    }, 200);
                  },
                },
              ]
            : [
                {
                  key: "report",
                  label: t("messages.reportMessage"),
                  destructive: true,
                  onPress: () => {
                    const target = menuMessage;
                    setMenuMessage(null);
                    if (!target) return;
                    setReport({
                      type: "message",
                      id: target.messageId,
                      userId: target.senderId,
                    });
                  },
                },
              ]),
        ]}
      />
    </View>
  );
}

const VOICE_NOTE_OPTIONS = {
  extension: ".m4a",
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: "mpeg4" as const,
    audioEncoder: "aac" as const,
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 32000,
  },
};

const RECEIPT_RANK: Record<MessageReceipt, number> = {
  sending: 0,
  sent: 1,
  received: 2,
  read: 3,
};

function strongerReceipt(
  previous?: MessageReceipt,
  next?: MessageReceipt,
  seen?: boolean
): MessageReceipt | undefined {
  const left = previous;
  const right = next || (seen ? "read" : undefined);
  if (!left) return right;
  if (!right) return left;
  return RECEIPT_RANK[left] >= RECEIPT_RANK[right] ? left : right;
}

function receiptLabel(item: ChatMessage) {
  const status = item.messageId < 0 ? "sending" : item.receipt || (item.seen ? "read" : "sent");
  if (status === "sending") return "messages.sending" as const;
  if (status === "received") return "messages.received" as const;
  if (status === "read") return "messages.read" as const;
  return "messages.sent" as const;
}

function formatVoiceClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function VoiceRecordBar({
  colors,
  styles,
  onSend,
  onCancel,
}: {
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const recorder = useAudioRecorder(VOICE_NOTE_OPTIONS);
  const recState = useAudioRecorderState(recorder, 200);
  const finishing = useRef(false);
  const [handingOff, setHandingOff] = useState(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        Alert.alert("", t("messages.voicePermission"));
        onCancelRef.current();
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (cancelled) return;
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
      } catch {
        if (cancelled) return;
        Alert.alert("", t("messages.voiceFailed"));
        onCancelRef.current();
      }
    })();
    return () => {
      cancelled = true;
      // Send and cancel already stop the recorder. A later stop runs after
      // expo-audio has released the native object and throws.
      if (finishing.current) return;
      try {
        void recorder.stop();
      } catch {
        // Native recorder was already released.
      }
    };
  }, [recorder, t]);

  const seconds = (recState.durationMillis || 0) / 1000;

  const finish = useCallback(
    async (send: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      if (send) setHandingOff(true);
      try {
        if (recorder.isRecording) await recorder.stop();
      } catch {
        // Recorder may already have stopped.
      }
      let uri: string | null = null;
      let recordedSeconds = seconds;
      try {
        uri = recorder.uri;
        recordedSeconds = Math.max(recorder.currentTime || seconds, seconds);
      } catch {
        // Native recorder was already released.
      }
      const duration = recordedSeconds;
      if (send && uri && duration >= 0.4) onSend(uri, duration);
      else onCancel();
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    },
    [onCancel, onSend, recorder, seconds]
  );

  useEffect(() => {
    if (seconds >= 60) void finish(true);
  }, [finish, seconds]);

  return (
    <View style={styles.recordRow}>
      <Pressable
        onPress={() => void finish(false)}
        style={styles.recordSide}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </Pressable>
      <View style={styles.recordLive}>
        <View style={styles.recordDot} />
        <Text style={styles.recordTime}>{formatVoiceClock(seconds)}</Text>
      </View>
      <Pressable
        onPress={() => void finish(true)}
        disabled={handingOff}
        style={styles.send}
        accessibilityRole="button"
        accessibilityLabel={t("messages.voiceSend")}
        accessibilityState={{ busy: handingOff }}
      >
        {handingOff ? (
          <JosCityLoader color={colors.white} size={18} />
        ) : (
          <Ionicons name="send" size={16} color={colors.white} />
        )}
      </Pressable>
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
  playing,
  onToggleVoice,
  onVoiceEnded,
  onReply,
  onOpenMenu,
}: {
  item: ChatMessage;
  mine: boolean;
  myId: number;
  peerName: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  playing: boolean;
  onToggleVoice: () => void;
  onVoiceEnded: () => void;
  onReply: (message: ChatMessage) => void;
  onOpenMenu: (message: ChatMessage) => void;
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
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!item.isDeleted)
      .activeOffsetX([-40, 8])
      .failOffsetY([-28, 28])
      .onUpdate((event) => {
        translateX.setValue(Math.min(Math.max(event.translationX, 0), 56));
      })
      .onEnd((event) => {
        if (event.translationX >= 24 || event.velocityX >= 700) onReply(item);
        resetPosition();
      })
      .onFinalize(() => {
        resetPosition();
      });
    const longPress = Gesture.LongPress()
      .enabled(!item.isDeleted)
      .minDuration(420)
      .maxDistance(14)
      .onStart(() => {
        onOpenMenu(item);
      });
    return Gesture.Race(pan, longPress);
  }, [item, onOpenMenu, onReply, resetPosition, translateX]);
  const quotedSender =
    item.replyToSenderId === myId
      ? "You"
      : item.replyToSenderUsername || peerName;
  const voice = item.messageType === "voice" && Boolean(item.attachmentUrl) && !item.isDeleted;
  const statusReply = item.isDeleted ? null : parseStatusReply(item.messageContent);

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
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, item.isDeleted && styles.bubbleDeleted]}>
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
              {voice ? (
                <VoiceMessageBubble
                  uri={item.attachmentUrl || ""}
                  duration={item.duration}
                  mine={mine}
                  playing={playing}
                  onToggle={onToggleVoice}
                  onFinished={onVoiceEnded}
                />
              ) : statusReply ? (
                <StatusReplyBubble
                  reply={statusReply}
                  mine={mine}
                  authorName={mine ? peerName : "You"}
                  textStyle={[
                    styles.bubbleText,
                    mine && styles.bubbleTextMine,
                  ]}
                />
              ) : (
                <Text
                  style={[
                    styles.bubbleText,
                    mine && styles.bubbleTextMine,
                    item.isDeleted && styles.bubbleTextDeleted,
                  ]}
                >
                  {item.isDeleted ? t("messages.deleted") : item.messageContent}
                </Text>
              )}
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaTime}>{timeAgo(item.createdAt)}</Text>
              {mine && !item.isDeleted ? (
                <MessageReceiptMark
                  status={item.messageId < 0 ? "sending" : item.receipt || (item.seen ? "read" : "sent")}
                  label={t(receiptLabel(item))}
                />
              ) : null}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
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
  bubbleDeleted: {
    backgroundColor: colors.sheet,
  },
  bubbleTextDeleted: {
    fontFamily: "Montserrat_500Medium",
    fontStyle: "italic",
    color: colors.textMuted,
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
  meta: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaTime: {
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
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 42,
  },
  recordSide: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sheet,
  },
  recordLive: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: colors.sheet,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.badge,
  },
  recordTime: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.text,
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
