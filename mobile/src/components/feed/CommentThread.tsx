import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AvatarCircle from "./AvatarCircle";
import HashtagText from "./HashtagText";
import BusinessVerifiedBadge from "../BusinessVerifiedBadge";
import { reactToComment, type PostComment } from "../../api/comments";
import ReportSheet from "../ReportSheet";
import { useI18n } from "../../i18n/I18nProvider";
import { getCommentReaction, parseReactedFlag, setCommentReaction } from "../../state/commentReactions";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { openMemberProfile } from "../../utils/openProfile";

export function commentKey(row: PostComment): number {
  const value = Number(row.comment_id ?? row.id ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function commentText(row: PostComment): string {
  return String(row.text || row.comment || "").trim();
}

export function commentName(row: PostComment): string {
  return row.author?.name || row.user?.display_name || "JosCity member";
}

export function commentPicture(row: PostComment): string | null | undefined {
  return row.author?.picture || row.user?.profile_image_url;
}

export function commentTotal(rows: PostComment[]): number {
  return rows.reduce((sum, row) => sum + 1 + (row.replies?.length || 0), 0);
}

export function CommentThread({
  comment,
  hideReplies,
  compact,
  onReply,
}: {
  comment: PostComment;
  hideReplies?: boolean;
  compact?: boolean;
  onReply: (id: number, name: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCommentStyles(colors), [colors]);
  const name = commentName(comment);
  const replies = comment.replies || [];
  const id = commentKey(comment);

  return (
    <View style={[styles.thread, compact && styles.threadCompact]}>
      <CommentRow comment={comment} compact={compact} onReply={() => onReply(id, name)} />
      {!hideReplies && replies.length > 0 ? (
        <View style={styles.replies}>
          <View style={styles.threadLine} />
          <View style={styles.repliesList}>
            {replies.map((reply, index) => (
              <CommentRow
                key={commentKey(reply) || index}
                comment={reply}
                compact
                onReply={() => onReply(commentKey(reply), commentName(reply))}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CommentRow({
  comment,
  compact,
  onReply,
}: {
  comment: PostComment;
  compact?: boolean;
  onReply?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeCommentStyles(colors), [colors]);
  const router = useRouter();
  const name = commentName(comment);
  const body = commentText(comment);
  const time = comment.time_ago || "";
  const id = commentKey(comment);
  const authorId = Number(comment.author?.id || comment.user?.user_id || comment.user_id || 0);
  const [reportOpen, setReportOpen] = useState(false);
  const cached = getCommentReaction(id);
  const [liked, setLiked] = useState(
    cached?.user_reacted ?? parseReactedFlag(comment.user_reacted)
  );
  const [likes, setLikes] = useState(
    cached?.reactions_count ?? Math.max(0, Number(comment.reactions_count) || 0)
  );
  const likedRef = useRef(liked);
  const busyRef = useRef(false);
  likedRef.current = liked;

  useEffect(() => {
    const stored = getCommentReaction(id);
    const nextLiked = stored?.user_reacted ?? parseReactedFlag(comment.user_reacted);
    const nextCount = stored?.reactions_count ?? Math.max(0, Number(comment.reactions_count) || 0);
    setLiked(nextLiked);
    setLikes(nextCount);
    likedRef.current = nextLiked;
    busyRef.current = false;
  }, [id]);

  const toggleLike = () => {
    if (!id || busyRef.current) return;
    const next = !likedRef.current;
    const nextCount = Math.max(0, likes + (next ? 1 : -1));
    busyRef.current = true;
    likedRef.current = next;
    setLiked(next);
    setLikes(nextCount);
    setCommentReaction(id, { user_reacted: next, reactions_count: nextCount });
    void reactToComment(id, next)
      .then((result) => {
        if (!result) return;
        setLiked(result.user_reacted);
        likedRef.current = result.user_reacted;
        setLikes(Math.max(0, result.reactions_count));
        setCommentReaction(id, result);
      })
      .finally(() => {
        busyRef.current = false;
      });
  };

  const openAuthor = () => {
    openMemberProfile(
      router,
      comment.author?.id || comment.user?.user_id || comment.user_id,
      comment.author?.account_type,
      "push",
      { name, picture: commentPicture(comment) }
    );
  };

  return (
    <>
    <View style={styles.commentRow}>
      <Pressable onPress={openAuthor} accessibilityRole="button">
        <AvatarCircle name={name} uri={commentPicture(comment)} size={compact ? 28 : 36} />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Pressable onPress={openAuthor} style={{ flexShrink: 1 }} accessibilityRole="button">
            <Text style={styles.commentName} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          {comment.author ? (
            <BusinessVerifiedBadge
              color={comment.author.badge_color}
              hasCac={Boolean(comment.author.cac_verified ?? comment.author.has_cac)}
              verified={Boolean(comment.author.verified)}
              accountType={comment.author.account_type}
              size={13}
            />
          ) : null}
          {time ? <Text style={styles.commentTime}>{` · ${time}`}</Text> : null}
        </View>
        {body ? <HashtagText value={body} style={styles.commentText} /> : null}
        <View style={styles.commentActions}>
          <Pressable onPress={toggleLike} hitSlop={16} style={styles.reactHit}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={15}
              color={liked ? colors.badge : colors.textMuted}
            />
            {likes > 0 ? (
              <Text style={[styles.reactCount, liked && { color: colors.badge }]}>{likes}</Text>
            ) : null}
          </Pressable>
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={6} style={styles.replyHit}>
              <Text style={styles.replyLabel}>REPLY</Text>
            </Pressable>
          ) : null}
          {id ? (
            <Pressable
              onPress={() => setReportOpen(true)}
              hitSlop={6}
              style={styles.replyHit}
              accessibilityRole="button"
              accessibilityLabel={t("comments.report")}
            >
              <Text style={styles.replyLabel}>{t("comments.report").toUpperCase()}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="comment"
        contentId={id}
        reportedUserId={authorId || null}
      />
    </>
  );
}

function makeCommentStyles(colors: Palette) {
  return StyleSheet.create({
    thread: {
      paddingBottom: 18,
    },
    threadCompact: {
      paddingBottom: 12,
    },
    commentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    commentBody: {
      flex: 1,
    },
    commentMeta: {
      marginBottom: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    commentName: {
      flexShrink: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.text,
    },
    commentTime: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentActions: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      height: 20,
    },
    reactHit: {
      height: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    reactCount: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      lineHeight: 20,
      color: colors.textMuted,
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    replyHit: {
      height: 20,
      justifyContent: "center",
    },
    replyLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      lineHeight: 20,
      letterSpacing: 0.6,
      color: colors.textMuted,
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    replies: {
      marginTop: 14,
      marginLeft: 18,
      flexDirection: "row",
    },
    threadLine: {
      width: 1,
      backgroundColor: colors.border,
      marginRight: 12,
    },
    repliesList: {
      flex: 1,
      gap: 14,
    },
  });
}
