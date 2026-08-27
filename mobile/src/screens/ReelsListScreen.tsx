import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video } from "expo-av";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import HashtagText from "../components/feed/HashtagText";
import PostOptionsSheet from "../components/feed/PostOptionsSheet";
import ReelCommentsSheet from "../components/feed/ReelCommentsSheet";
import ReportSheet from "../components/ReportSheet";
import { deletePost, reactToPost, removeReaction, updatePost } from "../api/feed";
import {
  getReels,
  recordReelView,
  toggleSavedReel,
  type ReelItem,
} from "../api/reels";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl } from "../utils/format";
import { playableVideoUrl } from "../utils/media";
import { openMemberProfile } from "../utils/openProfile";
import { resolveAccountBadgeColor } from "../utils/badgeColor";
import { sharePostWithLink } from "../utils/share";

function compactCount(value?: number): string {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`.replace(".0M", "M");
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`.replace(".0K", "K");
  return String(n);
}

function reelCaption(reel: ReelItem): string {
  return String(reel.text || reel.caption || "").trim();
}

function reelImage(reel: ReelItem): string | undefined {
  return absoluteUrl(
    reel.thumbnail_url ||
      reel.media?.find((item) => String(item.type || "").toLowerCase().includes("image"))?.url
  );
}

function reelVideo(reel: ReelItem): string | undefined {
  const url = absoluteUrl(
    reel.video_url ||
      reel.media?.find((item) => String(item.type || "").toLowerCase().includes("video"))?.url
  );
  return url ? playableVideoUrl(url) : undefined;
}

export default function ReelsListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pageHeight, setPageHeight] = useState(
    Math.max(Dimensions.get("window").height - TAB_BAR_SPACE, 400)
  );
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  const [viewerId, setViewerId] = useState(0);
  const commentsForRef = useRef<number | null>(null);
  commentsForRef.current = commentsFor;
  const viewed = useRef<Set<number>>(new Set());

  const onCommentsCountChange = useCallback((count: number) => {
    const id = commentsForRef.current;
    if (!id) return;
    setReels((current) =>
      current.map((row) => (row.post_id === id ? { ...row, comments_count: count } : row))
    );
  }, []);

  useEffect(() => {
    void getUser().then((user) => setViewerId(Number(user?.user_id || 0)));
  }, []);

  const load = useCallback(async () => {
    setReels(await getReels(40));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      setFocused(true);
      void load().finally(() => setLoading(false));
      return () => setFocused(false);
    }, [allowed, load])
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next = viewableItems.find((item) => item.isViewable)?.index;
      if (typeof next === "number") setActiveIndex(next);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const visibleReels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reels;
    return reels.filter((reel) => {
      const name = String(reel.author?.name || "").toLowerCase();
      const caption = reelCaption(reel).toLowerCase();
      return name.includes(needle) || caption.includes(needle);
    });
  }, [query, reels]);

  useEffect(() => {
    const reel = visibleReels[activeIndex];
    const id = reel?.post_id;
    if (!id || viewed.current.has(id)) return;
    viewed.current.add(id);
    void recordReelView(id);
  }, [activeIndex, visibleReels]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

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
      hideHeader
      statusBarStyle="light"
      showTabBar={commentsFor == null}
    >
      <View
        style={styles.stage}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) setPageHeight(height);
        }}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.white} size="large" />
          </View>
        ) : visibleReels.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>
              {query.trim() ? t("reels.searchEmpty") : t("explore.reelsEmpty")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={visibleReels}
            keyExtractor={(item) => String(item.post_id)}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            extraData={`${pageHeight}-${muted}-${commentsFor ?? ""}`}
            renderItem={({ item, index }) => (
              <ReelPage
                reel={item}
                height={pageHeight}
                active={focused && index === activeIndex && commentsFor == null}
                muted={muted}
                topInset={insets.top}
                viewerId={viewerId}
                onBack={() =>
                  router.canGoBack() ? router.back() : router.replace("/explore")
                }
                onComment={() => setCommentsFor(item.post_id)}
                onDeleted={(postId) =>
                  setReels((current) => current.filter((row) => row.post_id !== postId))
                }
                onChange={(next) =>
                  setReels((current) =>
                    current.map((row) => (row.post_id === next.post_id ? next : row))
                  )
                }
              />
            )}
          />
        )}
        <View style={[styles.topRight, { top: insets.top + 8 }]}>
          <Pressable
            onPress={() => setMuted((value) => !value)}
            style={styles.roundBtn}
            accessibilityRole="button"
            accessibilityLabel={muted ? t("reels.unmute") : t("reels.mute")}
          >
            <Ionicons name={muted ? "volume-mute" : "volume-high"} size={20} color={colors.white} />
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen((value) => !value)}
            style={styles.roundBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.search")}
          >
            <Ionicons name="search" size={20} color={colors.white} />
          </Pressable>
        </View>
        {searchOpen ? (
          <View style={[styles.searchBar, { top: insets.top + 56 }]}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("reels.searchPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <ReelCommentsSheet
        postId={commentsFor}
        onClose={() => setCommentsFor(null)}
        onCountChange={onCommentsCountChange}
      />
    </FeedShell>
  );
}

function ReelPage({
  reel,
  height,
  active,
  muted,
  topInset,
  viewerId,
  onBack,
  onComment,
  onChange,
  onDeleted,
}: {
  reel: ReelItem;
  height: number;
  active: boolean;
  muted: boolean;
  topInset: number;
  viewerId: number;
  onBack: () => void;
  onComment: () => void;
  onChange: (reel: ReelItem) => void;
  onDeleted: (postId: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const videoUrl = reelVideo(reel);
  const imageUrl = reelImage(reel);
  const name = reel.author?.name || "JosCity member";
  const caption = reelCaption(reel);
  const liked = Boolean(reel.user_reacted);
  const saved = Boolean(reel.user_saved);
  const badgeColor = resolveAccountBadgeColor(reel.author);
  const showBadge = Boolean(badgeColor);
  const authorId = Number(reel.author?.id || reel.user_id || 0);
  const isOwn = Boolean(viewerId && authorId && viewerId === authorId);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(caption);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active, reel.post_id]);

  const toggleLike = () => {
    const next = !liked;
    onChange({
      ...reel,
      user_reacted: next,
      reactions_count: Math.max(0, Number(reel.reactions_count || 0) + (next ? 1 : -1)),
    });
    void (next ? reactToPost(reel.post_id) : removeReaction(reel.post_id)).catch(() => {
      onChange(reel);
    });
  };

  const toggleSave = () => {
    const next = !saved;
    onChange({ ...reel, user_saved: next });
    void toggleSavedReel(reel.post_id, next).then((ok) => {
      if (ok == null) onChange(reel);
      else onChange({ ...reel, user_saved: ok });
    });
  };

  const onShare = () => {
    void sharePostWithLink(reel.post_id, caption);
  };

  return (
    <View style={[styles.page, { height }]}>
      {videoUrl ? (
        <Video
          source={{ uri: videoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={active && !paused}
          isLooping
          isMuted={muted}
        />
      ) : imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (videoUrl) setPaused((value) => !value);
        }}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.72)"]}
        style={styles.fade}
        pointerEvents="none"
      />
      {paused && videoUrl ? (
        <View style={styles.pauseMark} pointerEvents="none">
          <Ionicons name="play" size={54} color={colors.white} />
        </View>
      ) : null}
      <Pressable
        onPress={onBack}
        style={[styles.backBtn, { top: topInset + 8 }]}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="chevron-back" size={22} color={colors.white} />
      </Pressable>
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.copy} pointerEvents="box-none">
          <View style={styles.authorRow}>
            <Pressable
              onPress={() =>
                openMemberProfile(router, authorId, reel.author?.account_type, "push", {
                  name,
                  picture: reel.author?.picture,
                  source: "feed",
                })
              }
              style={styles.authorName}
              accessibilityRole="button"
            >
              <AvatarCircle name={name} uri={reel.author?.picture} size={36} />
              <Text style={styles.author} numberOfLines={1}>
                {name}
              </Text>
              {showBadge ? (
                <View style={styles.badgeWrap}>
                  <Ionicons name="checkmark-circle" size={16} color={badgeColor as string} />
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              style={styles.moreBtn}
              accessibilityRole="button"
              accessibilityLabel={t("reels.menu")}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.white} />
            </Pressable>
          </View>
          {caption ? (
            <HashtagText value={caption} style={styles.caption} tagColor="#B7E4C7" />
          ) : null}
        </View>
        <View style={styles.actions}>
          <Action
            icon={liked ? "heart" : "heart-outline"}
            label={compactCount(reel.reactions_count)}
            color={liked ? "#FB7185" : colors.white}
            onPress={toggleLike}
            accessibilityLabel={t("reels.like")}
          />
          <Action
            icon="chatbubble-outline"
            label={compactCount(reel.comments_count)}
            onPress={onComment}
            accessibilityLabel={t("reels.comment")}
          />
          <Action
            icon={saved ? "bookmark" : "bookmark-outline"}
            onPress={toggleSave}
            accessibilityLabel={t("reels.save")}
          />
          <Action
            icon="arrow-redo-outline"
            onPress={onShare}
            accessibilityLabel={t("reels.share")}
          />
        </View>
      </View>
      <PostOptionsSheet
        visible={menuOpen}
        title={t("reels.menu")}
        onClose={() => setMenuOpen(false)}
        options={
          isOwn
            ? [
                {
                  key: "edit",
                  label: t("reels.editCaption"),
                  onPress: () => {
                    setMenuOpen(false);
                    setDraft(caption);
                    setEditOpen(true);
                  },
                },
                {
                  key: "delete",
                  label: t("reels.delete"),
                  destructive: true,
                  onPress: () => {
                    setMenuOpen(false);
                    Alert.alert(t("reels.delete"), t("reels.deleteConfirm"), [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: t("reels.delete"),
                        style: "destructive",
                        onPress: () => {
                          void deletePost(reel.post_id).then((ok) => {
                            if (ok) onDeleted(reel.post_id);
                            else Alert.alert(t("reels.deleteFailed"));
                          });
                        },
                      },
                    ]);
                  },
                },
              ]
            : [
                {
                  key: "report",
                  label: t("reels.report"),
                  destructive: true,
                  onPress: () => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  },
                },
              ]
        }
      />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="reel"
        contentId={reel.post_id}
        reportedUserId={authorId || null}
      />
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.editRoot}
        >
          <Pressable style={styles.editDim} onPress={() => setEditOpen(false)} />
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>{t("reels.editTitle")}</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              style={styles.editInput}
              placeholder={t("reels.captionPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.editActions}>
              <Pressable onPress={() => setEditOpen(false)} style={styles.editCancel}>
                <Text style={styles.editCancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const next = draft.trim();
                  setEditOpen(false);
                  onChange({ ...reel, text: next, caption: next });
                  void updatePost(reel.post_id, next).then((ok) => {
                    if (!ok) {
                      onChange(reel);
                      Alert.alert(t("reels.editFailed"));
                    }
                  });
                }}
                style={styles.editSave}
              >
                <Text style={styles.editSaveText}>{t("reels.saveEdit")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Action({
  icon,
  label,
  color = "#FFFFFF",
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  color?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable onPress={onPress} style={actionStyles.btn} accessibilityLabel={accessibilityLabel}>
      <Ionicons name={icon} size={28} color={color} />
      {label ? <Text style={actionStyles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const actionStyles = StyleSheet.create({
  btn: {
    alignItems: "center",
    marginBottom: 18,
  },
  label: {
    marginTop: 4,
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
  },
});

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#000",
    },
    stage: {
      flex: 1,
      backgroundColor: "#000",
      marginBottom: TAB_BAR_SPACE,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    empty: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: "rgba(255,255,255,0.8)",
      textAlign: "center",
    },
    page: {
      backgroundColor: "#000",
      overflow: "hidden",
    },
    fallback: {
      backgroundColor: colors.brand,
    },
    fade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 280,
    },
    backBtn: {
      position: "absolute",
      left: 14,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(80,80,80,0.55)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3,
    },
    topRight: {
      position: "absolute",
      right: 14,
      zIndex: 4,
      flexDirection: "row",
      gap: 8,
    },
    roundBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(80,80,80,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    searchBar: {
      position: "absolute",
      left: 14,
      right: 14,
      zIndex: 4,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(20,20,20,0.78)",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.white,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
    },
    pauseMark: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 14,
      paddingBottom: 18,
      gap: 12,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
      paddingBottom: 4,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
      minWidth: 0,
    },
    authorName: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    author: {
      flexShrink: 1,
      minWidth: 0,
      color: colors.white,
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
    },
    badgeWrap: {
      flexShrink: 0,
    },
    moreBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    caption: {
      color: colors.white,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    actions: {
      alignItems: "center",
      width: 52,
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
