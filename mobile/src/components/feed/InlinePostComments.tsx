import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../JosCityLoader";
import Ionicons from "@expo/vector-icons/Ionicons";
import AvatarCircle from "./AvatarCircle";
import { CommentThread, commentKey, commentTotal } from "./CommentThread";
import {
  commentOnPost,
  getPostComments,
  replyToComment,
  type PostComment,
} from "../../api/comments";
import { getUser, type StoredUser } from "../../storage/session";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { handleFromName } from "../../utils/format";

type Props = {
  postId: number;
  onCountChange?: (count: number) => void;
  fill?: boolean;
  bottomInset?: number;
  onComposerActive?: (active: boolean) => void;
};

export default function InlinePostComments({
  postId,
  onCountChange,
  fill = false,
  bottomInset = 0,
  onComposerActive,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const inputRef = useRef<TextInput>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;
  const onComposerActiveRef = useRef(onComposerActive);
  onComposerActiveRef.current = onComposerActive;
  const [user, setUser] = useState<StoredUser | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideReplies, setHideReplies] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [sending, setSending] = useState(false);

  const loadGen = useRef(0);
  const loadComments = useCallback(async (silent = false) => {
    if (!postId) return;
    const request = ++loadGen.current;
    if (!silent) setLoading(true);
    try {
      const rows = await getPostComments(postId);
      if (request !== loadGen.current) return;
      setComments(rows);
      onCountChangeRef.current?.(commentTotal(rows));
    } finally {
      if (request === loadGen.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void getUser().then(setUser);
  }, []);

  useEffect(() => {
    setComments([]);
    setLoading(true);
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (fill) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [fill]);

  const displayName =
    user?.display_name ||
    [user?.first_name || user?.user_firstname, user?.last_name || user?.user_lastname]
      .filter(Boolean)
      .join(" ") ||
    "You";
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;
  const replyCount = comments.reduce((sum, row) => sum + (row.replies?.length || 0), 0);
  const totalComments = comments.length + replyCount;

  const send = async () => {
    const text = draft.trim();
    if (!text || !postId || sending) return;
    setSending(true);
    const created = replyTo
      ? await replyToComment(replyTo.id, text)
      : await commentOnPost(postId, text);
    setSending(false);
    if (!created) return;
    setDraft("");
    setReplyTo(null);
    await loadComments(true);
  };

  const body = (
    <>
      <View style={[styles.head, fill && styles.headFill]}>
        <Text style={[styles.title, fill && styles.titleCenter]}>
          {fill ? "Comments" : `${totalComments} ${totalComments === 1 ? "comment" : "comments"}`}
        </Text>
        {!fill && replyCount > 0 ? (
          <Pressable onPress={() => setHideReplies((value) => !value)} hitSlop={6}>
            <Text style={styles.muted}>{hideReplies ? "Show replies" : "Hide replies"}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={fill ? styles.listFill : undefined}>
        {loading && comments.length === 0 ? (
          <View style={fill ? styles.emptyFill : undefined}>
            <JosCityLoader color={colors.primary} style={fill ? undefined : styles.loader} />
          </View>
        ) : comments.length === 0 ? (
          <View style={fill ? styles.emptyFill : undefined}>
            <Text style={[styles.empty, fill && styles.emptyTextFill]}>
              No comments yet. Write the first one.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={fill ? styles.listFill : undefined}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {comments.map((item, index) => (
              <CommentThread
                key={commentKey(item) || index}
                comment={item}
                hideReplies={hideReplies}
                compact
                onReply={(id, name) => {
                  setReplyTo({ id, name });
                  setDraft(`@${handleFromName(name).replace("@", "")} `);
                  inputRef.current?.focus();
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View
        style={[
          styles.composer,
          fill && styles.composerPinned,
          fill && { paddingBottom: Math.max(bottomInset, 8) },
        ]}
      >
        <AvatarCircle name={displayName} uri={picture} size={32} />
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={replyTo ? `Reply to ${replyTo.name}` : "Write a comment"}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => void send()}
            onFocus={() => onComposerActiveRef.current?.(true)}
            onBlur={() => onComposerActiveRef.current?.(false)}
          />
          {replyTo ? (
            <Pressable onPress={() => setReplyTo(null)} hitSlop={6}>
              <Text style={styles.muted}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => void send()}
          disabled={sending || !draft.trim()}
          style={styles.sendBtn}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
        >
          {sending ? (
            <JosCityLoader color={colors.primary} size="small" />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={draft.trim() ? colors.primary : colors.textMuted}
            />
          )}
        </Pressable>
      </View>
    </>
  );

  if (fill) {
    return <View style={[styles.root, styles.rootFill]}>{body}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  root: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  rootFill: {
    flex: 1,
    minHeight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  listFill: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headFill: {
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  titleCenter: {
    fontSize: 16,
    textAlign: "center",
  },
  muted: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  loader: {
    marginVertical: 12,
  },
  empty: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  emptyFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTextFill: {
    marginBottom: 0,
    textAlign: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  composerPinned: {
    marginTop: 0,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  field: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  input: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
}
