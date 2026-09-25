import { Component, memo, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { showError, showNotice } from "../AppNotice";
import AvatarCircle from "./AvatarCircle";
import HashtagText from "./HashtagText";
import PostMediaGallery from "./PostMediaGallery";
import PostOptionsSheet, { type PostOption } from "./PostOptionsSheet";
import ReelCommentsSheet from "./ReelCommentsSheet";
import SaveBookmark from "./SaveBookmark";
import {
  deletePost,
  pinPost,
  reactToPost,
  removeReaction,
  savePost,
  unsavePost,
  updatePost,
  resharePost,
  type FeedPost,
} from "../../api/feed";
import ReportSheet from "../ReportSheet";
import { checkFriendship, blockUser, unblockUser } from "../../api/social";
import { removeFriend } from "../../state/friendGraph";
import { resolveSaved, setSavedOverride } from "../../state/savedPosts";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/colors";
import { handleFromName, postShareUrl } from "../../utils/format";
import { isSystemUsername, publicUsername } from "../../utils/accountNames";
import { openMemberProfile } from "../../utils/openProfile";
import { resolveAccountBadgeColor } from "../../utils/badgeColor";
import { sharePostWithLink } from "../../utils/share";
import { requestHomeRefresh } from "../../state/homeRefresh";
import { isDedicatedAgentAccount } from "../../storage/session";
import { ensureBlockedUsers, isUserBlocked, subscribeBlockedUsers } from "../../storage/blockedUsers";

type Props = {
  post: FeedPost;
  viewerId?: number;
  onDeleted?: (postId: number) => void;
  onSavedChange?: (postId: number, saved: boolean) => void;
};

async function copyPostLink(postId: number): Promise<void> {
  const url = postShareUrl(postId);
  try {
    await Clipboard.setStringAsync(url);
    showNotice({ title: "Copied", message: "Post link copied.", tone: "success" });
  } catch {
    await sharePostWithLink(postId);
  }
}

function PostCard(props: Props) {
  return (
    <PostSafe>
      <PostCardBody {...props} />
    </PostSafe>
  );
}

export default memo(PostCard);

class PostSafe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <View style={{ minHeight: 120 }} />;
    return this.props.children;
  }
}

function PostCardBody({ post, viewerId, onDeleted, onSavedChange }: Props) {
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
  const [resharing, setResharing] = useState(false);
  const [reshared, setReshared] = useState(Boolean(post.user_shared));
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<"post" | "profile" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [commentCount, setCommentCount] = useState(Number(post.comments_count || 0));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [blockedAuthor, setBlockedAuthor] = useState(false);

  const name = post.author?.name || "JosCity member";
  const chosenUsername = publicUsername(post.author?.username);
  const businessEmail = String(post.author?.email || "").trim();
  const authorIsBusiness =
    String(post.author?.account_type || "").toLowerCase() === "business";
  const handle = chosenUsername
    ? `@${chosenUsername}`
    : authorIsBusiness && businessEmail
      ? businessEmail
      : authorIsBusiness && isSystemUsername(post.author?.username)
        ? ""
        : handleFromName(name);
  const time = post.time_ago || "";
  const isSharePost =
    String(post.post_type || "").toLowerCase() === "share" || Boolean(post.original_post);
  const quoted = post.original_post && !post.original_post.unavailable ? post.original_post : null;
  const quotedAuthorId = Number(quoted?.author?.id || quoted?.user_id || 0);
  const quotedName = quoted?.author?.name || "JosCity member";
  const quotedUsername = publicUsername(quoted?.author?.username);
  const quotedIsBusiness =
    String(quoted?.author?.account_type || "").toLowerCase() === "business";
  const quotedEmail = String(quoted?.author?.email || "").trim();
  const quotedHandle = quotedUsername
    ? `@${quotedUsername}`
    : quotedIsBusiness && quotedEmail
      ? quotedEmail
      : handleFromName(quotedName);
  const quotedBadge = resolveAccountBadgeColor(quoted?.author);
  const badgeColor = resolveAccountBadgeColor(post.author);
  const authorIsAgent = isDedicatedAgentAccount({
    account_type: post.author?.account_type,
  }, post.author?.account_type);

  useEffect(() => {
    void ensureBlockedUsers().then(() => setBlockedAuthor(isUserBlocked(authorId)));
    return subscribeBlockedUsers(() => setBlockedAuthor(isUserBlocked(authorId)));
  }, [authorId]);

  useEffect(() => {
    setSaved(resolveSaved(Number(post.post_id || post.id || 0), post.user_saved));
  }, [post.post_id, post.id, post.user_saved]);

  useEffect(() => {
    setLiked(Boolean(post.user_reacted));
    setLikes(Math.max(0, Number(post.reactions_count || 0)));
    setReshared(Boolean(post.user_shared) || (isOwn && isSharePost));
    setShares(Math.max(0, Number(post.shares_count || 0)));
  }, [post.post_id, post.id, post.user_reacted, post.reactions_count, post.user_shared, post.shares_count, isOwn, isSharePost]);

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
        ...(authorIsAgent
          ? []
          : [
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
                      style: "destructive" as const,
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
            ]),
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
          label: blockedAuthor ? "Unblock user" : "Block user",
          destructive: true,
          onPress: () => {
            setMenuOpen(false);
            if (!authorId) return;
            if (blockedAuthor) {
              Alert.alert("Unblock user", `Unblock ${name}?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Unblock",
                  onPress: () => {
                    void unblockUser(authorId).then((result) => {
                      if (!result.success) {
                        showError(result.message || "Could not unblock this account.");
                        return;
                      }
                      setBlockedAuthor(false);
                      showNotice({
                        title: "Unblocked",
                        message: `${name} can contact you again.`,
                        tone: "success",
                      });
                    });
                  },
                },
              ]);
              return;
            }
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
                    setBlockedAuthor(true);
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
    <>
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
                {handle ? `${handle}${time ? ` · ${time}` : ""}` : time}
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
        {isSharePost ? (
          <View style={styles.quoteCard}>
            {!quoted ? (
              <Text style={styles.quoteMissing}>Original post is no longer available.</Text>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    if (!quotedAuthorId) return;
                    openMemberProfile(router, quotedAuthorId, quoted.author?.account_type, "push", {
                      name: quoted.author?.name,
                      picture: quoted.author?.picture,
                      source: "feed",
                    });
                  }}
                  style={styles.quoteHeader}
                >
                  <AvatarCircle name={quoted.author?.name} uri={quoted.author?.picture} size={32} />
                  <View style={styles.quoteMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.quoteName} numberOfLines={1}>
                        {quotedName}
                      </Text>
                      {quotedBadge ? (
                        <Ionicons name="checkmark-circle" size={14} color={quotedBadge} />
                      ) : null}
                    </View>
                    <Text style={styles.quoteTime} numberOfLines={1}>
                      {quoted.time_ago ? `${quotedHandle} · ${quoted.time_ago}` : quotedHandle}
                    </Text>
                  </View>
                </Pressable>
                {quoted.text || quoted.caption ? (
                  <HashtagText value={quoted.text || quoted.caption || ""} style={styles.quoteCaption} />
                ) : null}
                <PostSafe>
                  <PostMediaGallery post={quoted} compact />
                </PostSafe>
              </>
            )}
          </View>
        ) : null}

        {!isSharePost ? (
          <PostSafe>
            <PostMediaGallery post={post} />
          </PostSafe>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => {
              const next = !liked;
              setLiked(next);
              setLikes((count) => Math.max(0, count + (next ? 1 : -1)));
              void (next ? reactToPost(postId) : removeReaction(postId))
                .then((state) => {
                  setLiked(state.liked);
                  setLikes(state.reactionsCount);
                })
                .catch(() => {
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
            onPress={() => setCommentsOpen(true)}
          >
            <Ionicons
              name={commentsOpen ? "chatbubble" : "chatbubble-outline"}
              size={19}
              color={colors.text}
            />
            <Text style={styles.count}>{commentCount}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => {
              void sharePostWithLink(postId, caption);
            }}
          >
            <Ionicons name="arrow-redo-outline" size={20} color={colors.text} />
          </Pressable>
          {post.post_type !== "reel" ? <Pressable
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={reshared ? "Undo reshare" : isOwn && !isSharePost ? "Your post" : "Reshare post"}
            disabled={resharing || (isOwn && !isSharePost)}
            onPress={() => {
              const undo = reshared || (isOwn && isSharePost);
              Alert.alert(
                undo ? "Remove reshare?" : "Reshare post?",
                undo
                  ? "This post will be removed from your profile and the feed."
                  : "This post will appear on your profile and in the feed, credited to the original author underneath your name.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: undo ? "Remove" : "Reshare",
                    style: undo ? "destructive" : "default",
                    onPress: () => {
                      setResharing(true);
                      void resharePost(postId).then((result) => {
                        if (result.unshared) {
                          setReshared(false);
                          setShares((value) => Math.max(0, Number(result.post.shares_count ?? value - 1)));
                          if ((isOwn && isSharePost) || result.removedPostIds.includes(postId)) {
                            onDeleted?.(postId);
                          }
                          requestHomeRefresh();
                          showNotice({ title: "Reshare removed", message: "Taken off your posts and the feed.", tone: "success" });
                          return;
                        }
                        setReshared(true);
                        setShares((value) => value + 1);
                        requestHomeRefresh();
                        showNotice({ title: "Reshared", message: "Added to your posts and the feed.", tone: "success" });
                      }).catch(error => showError(error instanceof Error ? error.message : "Could not reshare post.")).finally(() => setResharing(false));
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="repeat-outline" size={22} color={reshared ? colors.primary : colors.text} />
            <Text style={styles.count}>{shares}</Text>
          </Pressable> : null}
          <View style={styles.spacer} />
          <SaveBookmark saved={saved} disabled={saving} onPress={toggleSaved} />
        </View>

      </View>

      {commentsOpen ? (
        <ReelCommentsSheet
          postId={postId}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentCount}
        />
      ) : null}

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
    </>
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
  quoteCard: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    backgroundColor: colors.fieldBg,
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  quoteMeta: {
    flex: 1,
    minWidth: 0,
  },
  quoteName: {
    flexShrink: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: colors.text,
  },
  quoteTime: {
    marginTop: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  quoteCaption: {
    marginBottom: 8,
  },
  quoteMissing: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
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
    ...StyleSheet.absoluteFill,
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
