import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  forumReplyLabel,
  getForumThread,
  deleteForumThread,
  replyToForumThread,
  type ForumReply,
  type ForumThread,
} from "../api/forum";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getCachedOpenThread } from "../state/openThread";
import { getUser } from "../storage/session";
import { openMemberProfile } from "../utils/openProfile";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";

export default function ForumThreadScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id || 0);
  const [thread, setThread] = useState<ForumThread | null>(() => getCachedOpenThread(id));
  const [replies, setReplies] = useState<ForumReply[]>(() => getCachedOpenThread(id)?.replies || []);
  const [loading, setLoading] = useState(!thread);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerId, setViewerId] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const row = await getForumThread(id);
    if (row) {
      setThread(row);
      setReplies(row.replies || []);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void getUser().then((user) => setViewerId(Number(user?.user_id || 0)));
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const canDelete =
    Boolean(thread?.can_delete || thread?.is_owner) ||
    (viewerId > 0 && Number(thread?.user_id || thread?.author?.id || 0) === viewerId);

  const onDelete = () => {
    if (!id || deleting) return;
    Alert.alert(t("forums.deleteTitle"), t("forums.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("forums.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeleting(true);
            const result = await deleteForumThread(id);
            setDeleting(false);
            if (!result.success) {
              Alert.alert(t("forums.delete"), result.message || t("forums.deleteFailed"));
              return;
            }
            if (router.canGoBack()) router.back();
            else router.replace("/forums" as never);
          })();
        },
      },
    ]);
  };

  const onReply = async () => {
    const text = draft.trim();
    if (!id || !text || sending) return;
    setSending(true);
    const result = await replyToForumThread(id, text);
    setSending(false);
    if (!result.success || !result.data) {
      Alert.alert(t("forums.reply"), result.message || t("forums.replyFailed"));
      return;
    }
    setDraft("");
    setReplies((current) => [...current, result.data as ForumReply]);
    setThread((current) =>
      current
        ? {
            ...current,
            reply_count: Number(current.reply_count || 0) + 1,
            last_reply_at: result.data?.created_at || current.last_reply_at,
          }
        : current
    );
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
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
      tab="explore"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/forums" as never))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {thread?.category_name || t("explore.forumsTitle")}
          </Text>
          {canDelete ? (
            <Pressable
              onPress={onDelete}
              disabled={deleting}
              hitSlop={8}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel={t("forums.delete")}
            >
              {deleting ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              )}
            </Pressable>
          ) : null}
        </View>
      }
    >
      {loading && !thread ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !thread ? (
        <Text style={styles.empty}>{t("forums.threadMissing")}</Text>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <FadeIn>
              <Text style={styles.kicker}>{thread.category_name}</Text>
              <Text style={styles.title}>{thread.title}</Text>
              <Pressable
                onPress={() =>
                  openMemberProfile(
                    router,
                    thread.user_id || thread.author?.id,
                    thread.author?.account_type,
                    "push",
                    { name: thread.author?.name, picture: thread.author?.picture }
                  )
                }
                style={styles.authorRow}
                accessibilityRole="button"
              >
                <AvatarCircle name={thread.author?.name} uri={thread.author?.picture} size={32} />
                <Text style={styles.authorMeta}>
                  {thread.author?.name || "JosCity member"}
                  {timeAgo(thread.created_at) ? ` · ${timeAgo(thread.created_at)}` : ""}
                </Text>
              </Pressable>
              {thread.body ? <Text style={styles.body}>{thread.body}</Text> : null}
              <Text style={styles.repliesHead}>
                {forumReplyLabel(replies.length || thread.reply_count)}
              </Text>
            </FadeIn>
            {replies.length ? (
              replies.map((reply) => (
                <Pressable
                  key={reply.id}
                  onPress={() =>
                    openMemberProfile(router, reply.author?.id, reply.author?.account_type, "push", {
                      name: reply.author?.name,
                      picture: reply.author?.picture,
                    })
                  }
                  style={styles.reply}
                  accessibilityRole="button"
                >
                  <AvatarCircle name={reply.author?.name} uri={reply.author?.picture} size={32} />
                  <View style={styles.replyCopy}>
                    <Text style={styles.replyName}>
                      {reply.author?.name || "JosCity member"}
                      <Text style={styles.replyTime}>
                        {timeAgo(reply.created_at) ? ` · ${timeAgo(reply.created_at)}` : ""}
                      </Text>
                    </Text>
                    <Text style={styles.replyBody}>{reply.body}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyReplies}>{t("forums.repliesEmpty")}</Text>
            )}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t("forums.replyPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
            />
            <Pressable
              onPress={() => void onReply()}
              disabled={sending || !draft.trim()}
              style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}
              accessibilityRole="button"
              accessibilityLabel={t("forums.reply")}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="send" size={16} color={colors.white} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingBottom: 10,
      gap: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
      paddingRight: 8,
    },
    deleteBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      marginHorizontal: 24,
      marginTop: 40,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.textMuted,
    },
    emptyReplies: {
      marginTop: 8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 24,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 24,
      lineHeight: 30,
      color: colors.text,
    },
    authorRow: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    authorMeta: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    body: {
      marginTop: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
    },
    repliesHead: {
      marginTop: 28,
      marginBottom: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    reply: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    replyCopy: { flex: 1 },
    replyName: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    replyTime: {
      fontFamily: "Montserrat_400Regular",
      color: colors.textMuted,
    },
    replyBody: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: TAB_BAR_SPACE + 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    sendOff: { opacity: 0.45 },
  });
}
