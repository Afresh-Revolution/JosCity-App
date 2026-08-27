import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../FadeIn";
import { showError, showNotice } from "../AppNotice";
import AvatarCircle from "./AvatarCircle";
import FeedImage from "./FeedImage";
import FeedVideo from "./FeedVideo";
import HashtagText from "./HashtagText";
import InlinePostComments from "./InlinePostComments";
import PostOptionsSheet, { type PostOption } from "./PostOptionsSheet";
import SaveBookmark from "./SaveBookmark";
import {
  deletePost,
  pinPost,
  reactToPost,
  removeReaction,
  savePost,
  unsavePost,
  updatePost,
  type FeedPost,
} from "../../api/feed";
import ReportSheet from "../ReportSheet";
import { checkFriendship, blockUser } from "../../api/social";
import { cacheOpenPost } from "../../state/openPost";
import { removeFriend } from "../../state/friendGraph";
import { resolveSaved, setSavedOverride } from "../../state/savedPosts";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/colors";
import { absoluteUrl, handleFromName, postShareUrl } from "../../utils/format";
import { isImageUrl, isVideoUrl } from "../../utils/media";
import { openMemberProfile } from "../../utils/openProfile";
import { resolveAccountBadgeColor } from "../../utils/badgeColor";
import { sharePostWithLink } from "../../utils/share";

type Props = {
  post: FeedPost;
  delay?: number;
  viewerId?: number;
  onDeleted?: (postId: number) => void;
  onSavedChange?: (postId: number, saved: boolean) => void;
};

function firstVideo(post: FeedPost): string | undefined {
  const typed = post.media?.find((item) => isVideoUrl(item.url, item.type))?.url;
  const fromUrls = post.media_urls?.find((url, index) =>
    isVideoUrl(url, post.media_types?.[index])
  );
  const fallback =
    String(post.post_type || "").toLowerCase() === "reel"
      ? post.media?.find((item) => item.url)?.url || post.media_urls?.[0]
      : undefined;
  return absoluteUrl(typed || fromUrls || fallback);
}

function firstImage(post: FeedPost): string | undefined {
  const typedImage = post.media?.find((item) => isImageUrl(item.url, item.type))?.url;
  const fallbackMedia = post.media?.find((item) => !isVideoUrl(item.url, item.type))?.url;
  const fromUrls = post.media_urls?.find((url, index) =>
    isImageUrl(url, post.media_types?.[index])
  );
  const candidate = typedImage || fromUrls || fallbackMedia;
  if (candidate && isVideoUrl(candidate)) return undefined;
  return absoluteUrl(candidate);
}

async function copyPostLink(postId: number): Promise<void> {
  const url = postShareUrl(postId);
  try {
    await Clipboard.setStringAsync(url);
    showNotice({ title: "Copied", message: "Post link copied.", tone: "success" });
  } catch {
    await sharePostWithLink(postId);
  }
}

export default function PostCard({ post, delay = 0, viewerId, onDeleted, onSavedChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makePostStyles(colors), [colors]);
  const router = useRouter();
  const postId = Number(post.post_id || post.id || 0);
  const authorId = Number(post.author?.id || post.user_id || 0);
  const isOwn = Boolean(viewerId && authorId && viewerId === authorId);
  const [liked, setLiked] = useState(Boolean(post.user_reacted));
  const [saved, setSaved] = useState(() => resolveSaved(postId, post.user_saved));
  const [saving, setSaving] = useState(false);
  const [pinned, setPinned] = useState(Boolean(post.is_pinned || post.pinned));
  const [caption, setCaption] = useState((post.text || post.caption || "").trim());
  const [likes, setLikes] = useState(Number(post.reactions_count || 0));
  const [shares, setShares] = useState(Number(post.shares_count || 0));
  const [imageFailed, setImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<"post" | "profile" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [commentCount, setCommentCount] = useState(Number(post.comments_count || 0));
  const [commentsOpen, setCommentsOpen] = useState(false);

  const name = post.author?.name || "JosCity member";
  const handle = post.author?.username
    ? `@${String(post.author.username).replace(/^@/, "")}`
    : handleFromName(name);
  const time = post.time_ago || "";
  const image = useMemo(() => firstImage(post), [post]);
  const video = useMemo(() => firstVideo(post), [post]);
  const badgeColor = resolveAccountBadgeColor(post.author);
  const hasVisibleImage = Boolean(video || (image && !imageFailed));

  useEffect(() => {
    setSaved(resolveSaved(Number(post.post_id || post.id || 0), post.user_saved));
  }, [post.post_id, post.id, post.user_saved]);

  const applySaved = (next: boolean) => {
    setSaved(next);
    setSavedOverride(postId, next);
    onSavedChange?.(postId, next);
  };

  const toggleSaved = () => {
    if (saving || !postId) return;
    const next = !saved;
    applySaved(next);
    setSaving(true);
    void (next ? savePost(postId) : unsavePost(postId)).then((ok) => {
      setSaving(false);
      if (!ok) {
        applySaved(!next);
        showError(next ? "Could not save this post." : "Could not unsave this post.");
      }
    });
  };

  const options: PostOption[] = isOwn
    ? [
        {
          key: "save",
          label: saved ? "Unsave post" : "Save post",
          onPress: () => {
            setMenuOpen(false);
            toggleSaved();
          },
        },
        {
          key: "copy",
          label: "Copy link",
          onPress: () => {
            setMenuOpen(false);
            void copyPostLink(postId);
          },
        },
        {
          key: "edit",
          label: "Edit post",
          onPress: () => {
            setMenuOpen(false);
            setDraft(caption);
            setEditOpen(true);
          },
        },
        {
          key: "pin",
          label: pinned ? "Unpin post" : "Pin post",
          onPress: () => {
            setMenuOpen(false);
            const next = !pinned;
            setPinned(next);
            void pinPost(postId, next).then((ok) => {
              if (!ok) {
                setPinned(!next);
                showError(next ? "Could not pin this post." : "Could not unpin this post.");
              }
            });
          },
        },
        {
          key: "delete",
          label: "Delete post",
          destructive: true,
          onPress: () => {
            setMenuOpen(false);
            Alert.alert("Delete post", "This post will be removed.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void deletePost(postId).then((ok) => {
                    if (ok) onDeleted?.(postId);
                    else showError("Could not delete this post.");
                  });
                },
              },
            ]);
          },
        },
      ]
    : [
        {
          key: "save",
          label: saved ? "Unsave post" : "Save post",
          onPress: () => {
            setMenuOpen(false);
            toggleSaved();
          },
        },
        {
          key: "copy",
          label: "Copy link",
          onPress: () => {
            setMenuOpen(false);
            void copyPostLink(postId);
          },
        },
        {
          key: "unfriend",
          label: `Unfriend ${name}`,
          onPress: () => {
            setMenuOpen(false);
            if (!authorId) return;
            Alert.alert("Unfriend", `Unfriend ${name}?`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Unfriend",
                style: "destructive",
                onPress: () => {
                    void checkFriendship(authorId).then((status) => {
                    if (!status.areFriends) {
                      showError("Not friends", `You are not friends with ${name}.`);
                      return;
                    }
                    void removeFriend(authorId).then((ok) => {
                      if (ok) showNotice({ title: "Unfriended", message: `You are no longer friends with ${name}.`, tone: "success" });
                      else showError("Could not unfriend this account.");
                    });
                  });
                },
              },
            ]);
          },
        },
        {
          key: "report",
          label: "Report post",
          destructive: true,
          onPress: () => {
            setMenuOpen(false);
            setReportTarget("post");
          },
        },
        {
          key: "report-profile",
          label: "Report profile",
          destructive: true,
          onPress: () => {
            setMenuOpen(false);
            setReportTarget("profile");
          },
        },
        {
          key: "block",
          label: "Block user",
          destructive: true,
          onPress: () => {
            setMenuOpen(false);
            if (!authorId) return;
            Alert.alert("Block user", `Block ${name}? They will not be able to contact you, and you will not see their posts.`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => {
                  void blockUser(authorId).then((result) => {
                    if (!result.success) {
                      showError(result.message || "Could not block this account.");
                      return;
                    }
                    onDeleted?.(postId);
                    showNotice({
                      title: "Blocked",
                      message: `You will no longer see posts from ${name}.`,
                      tone: "success",
                    });
                  });
                },
              },
            ]);
          },
        },
      ];

  return (
    <FadeIn delay={delay} duration={520} translateY={16}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (!authorId) return;
              openMemberProfile(router, authorId, post.author?.account_type, "push", {
                name: post.author?.name,
                picture: post.author?.picture,
                source: "feed",
              });
            }}
            style={styles.headerIdentity}
          >
            <AvatarCircle name={name} uri={post.author?.picture} size={42} />
            <View style={styles.meta}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {badgeColor ? (
                  <Ionicons name="checkmark-circle" size={15} color={badgeColor} />
                ) : null}
              </View>
              <Text style={styles.handle} numberOfLines={1}>
                {handle}
                {time ? ` · ${time}` : ""}
              </Text>
            </View>
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.more}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {caption ? <HashtagText value={caption} style={styles.caption} /> : null}

        {video ? (
          <FeedVideo uri={video} style={styles.photo} />
        ) : image && !imageFailed ? (
          <FeedImage
            uri={image}
            style={styles.photo}
            onError={() => setImageFailed(true)}
          />
        ) : null}

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
          <Pressable
            style={styles.action}
            onPress={() => {
              if (!hasVisibleImage) {
                setCommentsOpen((open) => !open);
                return;
              }
              cacheOpenPost({
                ...post,
                user_reacted: liked,
                user_saved: saved,
                reactions_count: likes,
                comments_count: commentCount,
                shares_count: shares,
                text: caption,
              });
              router.push({
                pathname: "/post/[id]",
                params: { id: String(postId) },
              });
            }}
          >
            <Ionicons
              name={commentsOpen && !hasVisibleImage ? "chatbubble" : "chatbubble-outline"}
              size={19}
              color={colors.text}
            />
            <Text style={styles.count}>{commentCount}</Text>
          </Pressable>
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
          <SaveBookmark saved={saved} disabled={saving} onPress={toggleSaved} />
        </View>

        {commentsOpen && !hasVisibleImage ? (
          <InlinePostComments postId={postId} onCountChange={setCommentCount} />
        ) : null}
      </View>

      <PostOptionsSheet
        visible={menuOpen}
        options={options}
        onClose={() => setMenuOpen(false)}
      />
      <ReportSheet
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        contentType={reportTarget === "profile" ? "profile" : "post"}
        contentId={reportTarget === "profile" ? authorId : postId}
        reportedUserId={authorId || null}
      />

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.editRoot}
        >
          <Pressable style={styles.editDim} onPress={() => setEditOpen(false)} />
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Edit post</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              style={styles.editInput}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.editActions}>
              <Pressable onPress={() => setEditOpen(false)} style={styles.editCancel}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const next = draft.trim();
                  setEditOpen(false);
                  const previous = caption;
                  setCaption(next);
                  void updatePost(postId, next).then((ok) => {
                    if (!ok) {
                      setCaption(previous);
                      showError("Could not update this post.");
                    }
                  });
                }}
                style={styles.editSave}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </FadeIn>
  );
}

function makePostStyles(colors: Palette) {
  return StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  meta: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    flexShrink: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  handle: {
    marginTop: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  more: {
    paddingLeft: 8,
  },
  caption: {
    marginBottom: 12,
  },
  photo: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    backgroundColor: colors.fieldBg,
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
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
  editRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  editDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  editSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  editTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
    marginBottom: 12,
  },
  editInput: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    padding: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  editCancel: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  editCancelText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.textMuted,
  },
  editSave: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  editSaveText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.white,
  },
  });
}
