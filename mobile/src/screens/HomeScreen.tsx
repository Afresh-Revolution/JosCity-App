import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import MarqueeText from "../components/MarqueeText";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedSearch, { type FeedSearchResult } from "../components/feed/FeedSearch";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PeopleRow from "../components/feed/PeopleRow";
import PostCard from "../components/feed/PostCard";
import StatusRow from "../components/feed/StatusRow";
import { getFeed, type FeedPost } from "../api/feed";
import { getAccount } from "../api/account";
import { getStories } from "../api/stories";
import { getApprovedUsers, getUnreadNotificationCount, type DirectoryUser } from "../api/social";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { onHomeRefresh } from "../state/homeRefresh";
import { nudgeRatingPrompt } from "../state/ratingPrompt";
import {
  cancelPendingPost,
  getPendingPost,
  onPendingPostChange,
} from "../state/pendingPost";
import {
  getPendingStatusStories,
  onPendingStatusChange,
} from "../state/pendingStatus";
import { getLoginGreeting, getUser, type StoredUser } from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import { formatGreetingLine, type TimeGreeting } from "../utils/format";
import { mapStoryGroups, mergePendingStatus, type StatusGroup } from "../utils/stories";
import { peopleInsertIndex } from "../utils/peopleSlot";
import { refreshFriendGraph } from "../state/friendGraph";
import { openMemberProfile } from "../utils/openProfile";
import { hydrateStoryCache, syncStoryCache } from "../storage/storyMediaCache";

export default function HomeScreen() {
  const allowed = useRequirePersonalAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeHomeStyles(colors), [colors]);
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(true);
  const [greetingData, setGreetingData] = useState<TimeGreeting | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [storyGroups, setStoryGroups] = useState<StatusGroup[]>([]);
  const [pendingPost, setPendingPost] = useState(getPendingPost());
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const postY = useRef<Record<number, number>>({});
  const peopleY = useRef(0);
  const lastUserId = useRef<number | undefined>(undefined);
  const serverStoriesRef = useRef<StatusGroup[]>([]);

  useEffect(() => {
    void getUser().then((next) => {
      setUser(next);
      if (typeof next?.user_id === "number") lastUserId.current = next.user_id;
    });
    void getLoginGreeting().then(setGreetingData);

    const timer = setInterval(() => {
      void getLoginGreeting().then(setGreetingData);
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const loadFeed = useCallback(async (nextPage: number, mode: "replace" | "append") => {
    const result = await getFeed(nextPage, 10);
    setPage(nextPage);
    setHasMore(Boolean(result.pagination?.hasMore));
    setPosts((current) => (mode === "append" ? [...current, ...result.data] : result.data));
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const [page, current] = await Promise.all([getStories(), getUser()]);
      const server = mapStoryGroups(page.data, current?.user_id);
      serverStoriesRef.current = server;
      setStoryGroups(mergePendingStatus(server, getPendingStatusStories()));
      await hydrateStoryCache();
      void syncStoryCache(server);
    } catch {
      setStoryGroups(mergePendingStatus(serverStoriesRef.current, getPendingStatusStories()));
    }
  }, []);

  const loadExtras = useCallback(async () => {
    const [directory, count, account] = await Promise.allSettled([
      getApprovedUsers({ limit: 40, accountType: "personal" }),
      getUnreadNotificationCount(),
      getAccount(),
      loadStories(),
      refreshFriendGraph(),
    ]);
    if (directory.status === "fulfilled") setPeople(directory.value);
    if (count.status === "fulfilled") setUnread(count.value);
    if (account.status === "fulfilled" && account.value.data) {
      const data = account.value.data;
      setUser((current) => ({
        ...(current || {}),
        account_status: data.account_status,
        banned: data.banned,
        account_type: data.account_type || current?.account_type,
        nin_number: current?.nin_number,
        user_verified: data.nin_verified || current?.user_verified,
      }));
    }
  }, [loadStories]);

  const bootstrap = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await Promise.all([loadFeed(1, "replace"), loadExtras()]);
    } catch {
      setError(t("home.loadError"));
    } finally {
      setLoading(false);
    }
  }, [loadExtras, loadFeed, t]);

  useEffect(() => {
    if (!allowed) return;
    void bootstrap();
  }, [allowed, bootstrap]);

  useEffect(() => {
    return onHomeRefresh(() => {
      void loadStories();
      void loadFeed(1, "replace");
    });
  }, [loadFeed, loadStories]);

  useEffect(() => {
    return onPendingStatusChange(() => {
      setStoryGroups(mergePendingStatus(serverStoriesRef.current, getPendingStatusStories()));
    });
  }, []);

  useEffect(() => {
    return onPendingPostChange(() => {
      setPendingPost(getPendingPost());
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void (async () => {
        const nextUser = await getUser();
        setUser(nextUser);
        const nextId =
          typeof nextUser?.user_id === "number" ? nextUser.user_id : undefined;
        if (nextId && lastUserId.current && lastUserId.current !== nextId) {
          await bootstrap();
        }
        lastUserId.current = nextId ?? lastUserId.current;
        const count = await getUnreadNotificationCount();
        setUnread(count);
        await loadStories();
        nudgeRatingPrompt();
      })();
    }, [allowed, bootstrap, loadStories])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFeed(1, "replace"), loadExtras()]);
      setError(null);
    } catch {
      setError(t("home.refreshError"));
    } finally {
      setRefreshing(false);
    }
  }, [loadExtras, loadFeed, t]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadFeed(page + 1, "append");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadFeed, loadingMore, page]);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery("");
      return next;
    });
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [searchOpen]);

  const scrollToY = (y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
  };

  const onSelectSearch = (result: FeedSearchResult) => {
    setSearchQuery("");
    setSearchOpen(false);
    if (result.type === "hashtag") {
      router.push({
        pathname: "/hashtag/[tag]",
        params: { tag: String(result.id).replace(/^#+/, "") },
      });
      return;
    }
    if (result.type === "person") {
      const userId = Number(result.id);
      if (userId > 0) {
        openMemberProfile(router, userId, result.accountType, "push", {
          name: result.title,
          picture: result.avatar,
        });
        return;
      }
      scrollToY(peopleY.current);
      return;
    }
    if (result.postId && postY.current[result.postId] != null) {
      scrollToY(postY.current[result.postId]);
    }
  };

  const displayName =
    user?.display_name ||
    user?.business_name ||
    [
      user?.first_name || user?.user_firstname,
      user?.last_name || user?.user_lastname,
    ]
      .filter(Boolean)
      .join(" ") ||
    "there";
  const firstName = String(displayName).trim().split(/\s+/)[0] || "there";
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;

  const greeting = greetingData
    ? formatGreetingLine(greetingData, firstName)
    : "";
  const peopleAfterIndex = peopleInsertIndex(posts.length);
  const previewPeople = useMemo(() => people.slice(0, 8), [people]);
  const openPeoplePage = () => router.push("/people");

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="home"
      unreadCount={unread}
      searchActive={searchOpen}
      onSearch={toggleSearch}
    >
      {loading && posts.length === 0 ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <View style={styles.feed}>
          {searchOpen ? (
            <FeedSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              posts={posts}
              people={people}
              onSelect={onSelectSearch}
              inputRef={searchInputRef}
            />
          ) : null}
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.primary}
              />
            }
          >
          {showGreeting && greeting ? (
            <FadeIn delay={40} duration={480} translateY={8}>
              <View style={styles.banner}>
                <Ionicons
                  name={greetingData?.icon || "sunny-outline"}
                  size={16}
                  color={colors.primary}
                />
                {greeting ? (
                  <MarqueeText style={styles.bannerText}>{greeting}</MarqueeText>
                ) : null}
                <Pressable hitSlop={8} onPress={() => setShowGreeting(false)}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </FadeIn>
          ) : null}

          <View style={!showGreeting ? styles.statusSolo : undefined}>
            <StatusRow
              groups={storyGroups}
              currentUserId={user?.user_id}
              currentUserName={displayName === "there" ? "You" : displayName}
              currentUserAvatar={picture}
            />
          </View>

          <FadeIn delay={90} duration={500}>
            <View>
              <View style={[styles.composer, pendingPost && styles.composerUploading]}>
                <AvatarCircle name={displayName} uri={picture} size={40} />
                <Pressable
                  onPress={() => router.push("/create")}
                  style={styles.composerField}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.createPost")}
                >
                  <Text style={styles.composerPlaceholder} numberOfLines={1}>
                    {t("home.composer", { name: firstName })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/create", params: { attach: "photo" } })
                  }
                  style={styles.composerAction}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.addPhoto")}
                  hitSlop={6}
                >
                  <Ionicons name="image-outline" size={22} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/create", params: { attach: "video" } })
                  }
                  style={styles.composerAction}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.addVideo")}
                  hitSlop={6}
                >
                  <Ionicons name="videocam-outline" size={22} color={colors.primary} />
                </Pressable>
              </View>
              {pendingPost ? (
                <View style={styles.uploadBar}>
                  <View style={styles.uploadMeta}>
                    <Text style={styles.uploadLabel} numberOfLines={1}>
                      {pendingPost.progress < 0.93
                        ? t("home.uploading")
                        : t("home.publishing")}
                    </Text>
                    <Pressable
                      onPress={cancelPendingPost}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("home.cancelUpload")}
                    >
                      <Text style={styles.uploadCancel}>{t("common.cancel")}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.uploadTrack}>
                    <View
                      style={[
                        styles.uploadFill,
                        { width: `${Math.round(pendingPost.progress * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </FadeIn>

          {error ? (
            <View style={{ marginHorizontal: 16 }}>
              <ErrorBanner message={error} />
            </View>
          ) : null}

          {posts.length === 0 && !error ? (
            <Text style={styles.empty}>{t("home.empty")}</Text>
          ) : null}

          {posts.map((post, index) => {
            const postId = Number(post.post_id || post.id || 0);
            return (
              <Fragment key={String(postId || index)}>
                <View
                  onLayout={(event) => {
                    postY.current[postId] = event.nativeEvent.layout.y;
                  }}
                >
                  <PostCard
                    post={post}
                    delay={Math.min(index * 70, 280)}
                    viewerId={user?.user_id}
                    onDeleted={(deletedId) =>
                      setPosts((current) =>
                        current.filter((item) => Number(item.post_id || item.id) !== deletedId)
                      )
                    }
                  />
                </View>
                {peopleAfterIndex != null && index === peopleAfterIndex ? (
                  <View
                    onLayout={(event) => {
                      peopleY.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <PeopleRow
                      people={previewPeople}
                      title={t("home.peopleTitle")}
                      subtitle={t("home.peopleSubtitle")}
                      seeAllLabel={t("common.seeAll")}
                      onSeeAll={openPeoplePage}
                    />
                  </View>
                ) : null}
              </Fragment>
            );
          })}

          {posts.length === 0 ? (
            <View
              onLayout={(event) => {
                peopleY.current = event.nativeEvent.layout.y;
              }}
            >
              <PeopleRow
                people={previewPeople}
                title={t("home.peopleTitle")}
                subtitle={t("home.peopleSubtitle")}
                seeAllLabel={t("common.seeAll")}
                onSeeAll={openPeoplePage}
              />
            </View>
          ) : null}

          {hasMore ? (
            <Pressable
              onPress={() => void onLoadMore()}
              style={styles.loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <JosCityLoader color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>{t("home.loadMore")}</Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
        </View>
      )}
    </FeedShell>
  );
}

function makeHomeStyles(colors: Palette) {
  return StyleSheet.create({
    feed: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: "visible",
    },
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    banner: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      backgroundColor: colors.greetingBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bannerText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.text,
    },
    statusSolo: {
      marginTop: 8,
    },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
    },
    composerUploading: {
      paddingBottom: 6,
    },
    uploadBar: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 4,
    },
    uploadMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    uploadLabel: {
      flex: 1,
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
    },
    uploadCancel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.primary,
    },
    uploadTrack: {
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
      backgroundColor: colors.border,
    },
    uploadFill: {
      height: "100%",
      borderRadius: 2,
      backgroundColor: colors.brand,
    },
    composerField: {
      flex: 1,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: colors.fieldBg,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    composerPlaceholder: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    composerAction: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    error: {
      marginHorizontal: 16,
      marginBottom: 12,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.error,
    },
    empty: {
      marginHorizontal: 16,
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    loadMore: {
      marginHorizontal: 16,
      marginTop: 16,
      minHeight: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    loadMoreText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
  });
}
