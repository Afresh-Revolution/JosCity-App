import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedImage from "../components/feed/FeedImage";
import FeedVideo from "../components/feed/FeedVideo";
import { CommentThread, commentKey } from "../components/feed/CommentThread";
import FeedShell from "../components/feed/FeedShell";
import HashtagText from "../components/feed/HashtagText";
import SaveBookmark from "../components/feed/SaveBookmark";
import {
  commentOnPost,
  getPostComments,
  replyToComment,
  type PostComment,
} from "../api/comments";
import {
  getPost,
  reactToPost,
  removeReaction,
  savePost,
  unsavePost,
  type FeedPost,
} from "../api/feed";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { cacheOpenPost, getCachedOpenPost } from "../state/openPost";
import { resolveSaved, setSavedOverride } from "../state/savedPosts";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, handleFromName } from "../utils/format";
import { isImageUrl, isVideoUrl } from "../utils/media";
import { sharePostWithLink } from "../utils/share";
import { openMemberProfile } from "../utils/openProfile";

function firstVideo(post?: FeedPost | null): string | undefined {
  if (!post) return undefined;
  const typed = post.media?.find((item) => isVideoUrl(item.url, item.type))?.url;
  const fromUrls = post.media_urls?.find((url, index) =>
    isVideoUrl(url, post.media_types?.[index])
  );
  return absoluteUrl(typed || fromUrls);
}

function firstImage(post?: FeedPost | null): string | undefined {
  if (!post) return undefined;
  const typedImage = post.media?.find((item) => isImageUrl(item.url, item.type))?.url;
  const fallbackMedia = post.media?.find((item) => !isVideoUrl(item.url, item.type))?.url;
  const fromUrls = post.media_urls?.find((url, index) =>
    isImageUrl(url, post.media_types?.[index])
  );
  const candidate = typedImage || fromUrls || fallbackMedia;
  if (candidate && isVideoUrl(candidate)) return undefined;
  return absoluteUrl(candidate);
}

export default function PostCommentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = Number(params.id || 0);
  const inputRef = useRef<TextInput>(null);

  const [user, setUser] = useState<StoredUser | null>(null);
  const [post, setPost] = useState<FeedPost | null>(getCachedOpenPost(postId));
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideReplies, setHideReplies] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [liked, setLiked] = useState(Boolean(post?.user_reacted));
  const [saved, setSaved] = useState(() => resolveSaved(postId, post?.user_saved));
  const [saving, setSaving] = useState(false);
  const [likes, setLikes] = useState(Number(post?.reactions_count || 0));
  const [shares, setShares] = useState(Number(post?.shares_count || 0));
  const [sending, setSending] = useState(false);

  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void getUser().then(setUser);
  }, []);

  const applyPost = useCallback((row: FeedPost) => {
    const id = Number(row.post_id || row.id || 0);
    cacheOpenPost(row);
    setPost(row);
    setMissing(false);
    setLiked(Boolean(row.user_reacted));
    setSaved(resolveSaved(id, row.user_saved));
    setLikes(Number(row.reactions_count || 0));
    setShares(Number(row.shares_count || 0));
  }, []);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    const rows = await getPostComments(postId);
    setComments(rows);
  }, [postId]);

  useEffect(() => {
    if (!allowed || !postId) return;
    let cancelled = false;
    setLoading(true);
    const cached = getCachedOpenPost(postId);
    if (cached) applyPost(cached);

    void (async () => {
      const [row] = await Promise.all([getPost(postId), loadComments()]);
      if (cancelled) return;
      if (row) applyPost(row);
      else if (!cached) setMissing(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [allowed, applyPost, loadComments, postId]);

  const image = useMemo(() => firstImage(post), [post]);
  const video = useMemo(() => firstVideo(post), [post]);
  const caption = (post?.text || post?.caption || "").trim();
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
    inputRef.current?.blur();
    Keyboard.dismiss();
    await loadComments();
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} />
      </View>
    );
  }

  return (
    <FeedShell
      tab="home"
      header={
        <View style={styles.topBar}>
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Post</Text>
        </View>
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 3}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {loading && !post ? (
            <JosCityLoader color={colors.primary} style={styles.loader} />
          ) : missing && !post ? (
            <Text style={styles.empty}>This post is no longer available.</Text>
          ) : (
            <>
              {post?.author?.name ? (
                <Pressable
                  onPress={() =>
                    openMemberProfile(
                      router,
                      post.author?.id || post.user_id,
                      post.author?.account_type,
                      "push",
                      { name: post.author?.name, picture: post.author?.picture }
                    )
                  }
                  style={styles.authorRow}
                  accessibilityRole="button"
                >
                  <AvatarCircle
                    name={post.author.name}
                    uri={post.author.picture}
                    size={36}
                  />
                  <Text style={styles.authorName} numberOfLines={1}>
                    {post.author.name}
                  </Text>
                </Pressable>
              ) : null}
              {video ? (
                <FeedVideo uri={video} style={styles.video} />
              ) : image ? (
                <FeedImage uri={image} style={styles.photo} />
              ) : null}
              {caption ? <HashtagText value={caption} style={styles.caption} /> : null}

              <View style={styles.actions}>
                <Pressable
                  style={styles.action}
                  onPress={() => {
                    const next = !liked;
                    setLiked(next);
                    setLikes((count) => Math.max(0, count + (next ? 1 : -1)));
                    void (next ? reactToPost(postId) : removeReaction(postId)).catch(() => {
                      setLiked(!next);
                      setLikes((count) => Math.max(0, count + (next ? -1 : 1)));
                    });
                  }}
                >
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={20}
                    color={liked ? colors.badge : colors.text}
                  />
                  <Text style={styles.count}>{likes}</Text>
                </Pressable>
                <View style={styles.action}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.text} />
                  <Text style={styles.count}>{totalComments}</Text>
                </View>
                <Pressable
                  style={styles.action}
                  onPress={() => {
                    void sharePostWithLink(postId, caption).then((ok) => {
                      if (ok) setShares((count) => count + 1);
                    });
                  }}
                >
                  <Ionicons name="arrow-redo-outline" size={20} color={colors.text} />
                  <Text style={styles.count}>{shares}</Text>
                </Pressable>
                <View style={styles.spacer} />
                <SaveBookmark
                  saved={saved}
                  disabled={saving}
                  onPress={() => {
                    if (saving || !postId) return;
                    const next = !saved;
                    setSaved(next);
                    setSavedOverride(postId, next);
                    setSaving(true);
                    void (next ? savePost(postId) : unsavePost(postId)).then((ok) => {
                      setSaving(false);
                      if (!ok) {
                        setSaved(!next);
                        setSavedOverride(postId, !next);
                        Alert.alert(next ? "Could not save this post." : "Could not unsave this post.");
                      }
                    });
                  }}
                />
              </View>
            </>
          )}

          {missing || (loading && !post) ? null : (
            <>
          <View style={styles.commentsHead}>
            <Text style={styles.commentsTitle}>
              {totalComments} {totalComments === 1 ? "comment" : "comments"}
            </Text>
            {replyCount > 0 ? (
              <Pressable onPress={() => setHideReplies((value) => !value)} hitSlop={6}>
                <Text style={styles.hideReplies}>
                  {hideReplies ? "Show replies" : "Hide replies"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {loading && post ? (
            <JosCityLoader color={colors.primary} style={styles.loader} />
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>No comments yet.</Text>
          ) : (
            comments.map((item, index) => (
              <FadeIn key={commentKey(item) || index} delay={Math.min(index * 50, 200)}>
                <View style={styles.threadPad}>
                  <CommentThread
                    comment={item}
                    hideReplies={hideReplies}
                    onReply={(id, name) => {
                      setReplyTo({ id, name });
                      setDraft(`@${handleFromName(name).replace("@", "")} `);
                      inputRef.current?.focus();
                    }}
                  />
                </View>
              </FadeIn>
            ))
          )}
            </>
          )}
        </ScrollView>

        {missing ? null : (
        <View
          style={[
            styles.composer,
            { marginBottom: 68 + Math.max(insets.bottom, 10) + 12 },
          ]}
        >
          <AvatarCircle name={displayName} uri={picture} size={36} />
          <View style={styles.composerField}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={replyTo ? `Reply to ${replyTo.name}` : "Write a comment"}
              placeholderTextColor={colors.textMuted}
              style={styles.composerInput}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            {replyTo ? (
              <Pressable onPress={() => setReplyTo(null)} hitSlop={6}>
                <Text style={styles.hideReplies}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => void send()} disabled={sending || !draft.trim()}>
            <Text style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}>
              Send
            </Text>
          </Pressable>
        </View>
        )}
      </KeyboardAvoidingView>
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  topTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
  },
  content: {
    paddingBottom: 24,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  authorName: {
    flex: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  photo: {
    width: "100%",
    height: undefined,
    backgroundColor: "#EEEAE3",
  },
  video: {
    width: "100%",
    height: 220,
    backgroundColor: "#EEEAE3",
  },
  caption: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 18,
    gap: 6,
  },
  count: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
  spacer: {
    flex: 1,
  },
  commentsHead: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentsTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  hideReplies: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    paddingHorizontal: 16,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  threadPad: {
    paddingHorizontal: 16,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  composerField: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  composerInput: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
  },
  send: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  sendOff: {
    color: colors.textMuted,
  },
});
}
