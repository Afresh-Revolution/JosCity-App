import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ComponentProps } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import EventCard from "../components/explore/EventCard";
import ExploreHeader from "../components/explore/ExploreHeader";
import BusinessRow from "../components/explore/BusinessRow";
import NewsArticleRow from "../components/explore/NewsArticleRow";
import ForumThreadRow from "../components/explore/ForumThreadRow";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PeopleRow from "../components/feed/PeopleRow";
import {
  eventListKey,
  eventLocation,
  eventTitle,
  uniqueExploreEvents,
  getExploreEvents,
  getCachedExploreEvents,
  getPublishedNews,
  getTrendingHashtags,
  type ExploreEvent,
  type NewsItem,
  type TrendingHashtag,
} from "../api/explore";
import { getForumOverview, type ForumThread } from "../api/forum";
import {
  getApprovedUsers,
  getUnreadNotificationCount,
  type DirectoryUser,
} from "../api/social";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openExploreEvent } from "../utils/openExploreEvent";
import { openForumThread } from "../utils/openForum";
import { openNewsArticle } from "../utils/openNews";

type CategoryId = "people" | "reels" | "events" | "news" | "forums" | "businesses";

const categories: Array<{
  id: CategoryId;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}> = [
  { id: "people", label: "People", icon: "person-outline" },
  { id: "reels", label: "Reels", icon: "film-outline" },
  { id: "events", label: "Events", icon: "calendar-outline" },
  { id: "news", label: "News", icon: "newspaper-outline" },
  { id: "forums", label: "Forums", icon: "chatbubbles-outline" },
  { id: "businesses", label: "Businesses", icon: "storefront-outline" },
];

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

function hashtagLabel(tag: TrendingHashtag): string {
  const raw = tag.hashtag || tag.label || tag.name || "";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const { t } = useI18n();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const searchRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [matchedPeople, setMatchedPeople] = useState<DirectoryUser[]>([]);
  const [businesses, setBusinesses] = useState<DirectoryUser[]>([]);
  const [matchedBusinesses, setMatchedBusinesses] = useState<DirectoryUser[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<ExploreEvent[]>(() => getCachedExploreEvents().slice(0, 6));
  const [forumThreads, setForumThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [tags, members, shops, articles, forums, count] =
      await Promise.allSettled([
        getTrendingHashtags(3),
        getApprovedUsers({ limit: 12, accountType: "personal" }),
        getApprovedUsers({ accountType: "business", allPages: true }),
        getPublishedNews(6),
        getForumOverview(4),
        getUnreadNotificationCount(),
      ]);
    if (tags.status === "fulfilled") setHashtags(tags.value);
    if (members.status === "fulfilled") setPeople(members.value);
    if (shops.status === "fulfilled") setBusinesses(shops.value);
    if (articles.status === "fulfilled") setNews(articles.value);
    if (forums.status === "fulfilled") setForumThreads(forums.value.threads || []);
    if (count.status === "fulfilled") setUnread(count.value);
  }, []);

  const loadEvents = useCallback(async () => {
    const cached = getCachedExploreEvents();
    if (cached.length) {
      setEvents(cached.slice(0, 6));
      setEventsLoading(false);
    } else {
      setEventsLoading(true);
    }
    await getExploreEvents(6, (rows) => {
      setEvents(rows);
      if (rows.length) setEventsLoading(false);
    });
    setEventsLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [allowed, load]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void getUnreadNotificationCount().then(setUnread);
      void loadEvents();
    }, [allowed, loadEvents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadEvents()]);
    setRefreshing(false);
  }, [load, loadEvents]);

  const q = query.trim().toLowerCase();
  useEffect(() => {
    if (!allowed) return;
    const search = query.trim();
    if (!search) {
      setMatchedPeople([]);
      setMatchedBusinesses([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void Promise.all([
        getApprovedUsers({ limit: 40, accountType: "personal", q: search }),
        getApprovedUsers({ limit: 40, accountType: "business", q: search }),
      ]).then(([members, shops]) => {
        if (cancelled) return;
        setMatchedPeople(members);
        setMatchedBusinesses(shops);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowed, query]);

  const filteredHashtags = useMemo(
    () =>
      (q
        ? hashtags.filter((tag) => matchesQuery(hashtagLabel(tag), q))
        : hashtags
      ).slice(0, 3),
    [hashtags, q]
  );
  const filteredPeople = useMemo(
    () => (q ? matchedPeople : people),
    [matchedPeople, people, q]
  );
  const filteredBusinesses = useMemo(
    () => (q ? matchedBusinesses : businesses),
    [matchedBusinesses, businesses, q]
  );
  const filteredNews = useMemo(
    () => (q ? news.filter((item) => matchesQuery(item.title || "", q)) : news),
    [news, q]
  );
  const filteredEvents = useMemo(
    () =>
      uniqueExploreEvents(
        q
          ? events.filter((event) =>
              matchesQuery(`${eventTitle(event)} ${eventLocation(event)}`, q)
            )
          : events
      ),
    [events, q]
  );
  const filteredForumThreads = useMemo(
    () =>
      (q
        ? forumThreads.filter((thread) =>
            matchesQuery(
              `${thread.title} ${thread.category_name || ""} ${thread.author?.name || ""}`,
              q
            )
          )
        : forumThreads
      ).slice(0, 4),
    [forumThreads, q]
  );

  const featuredEvents = filteredEvents.slice(0, 3);
  const newsPreview = filteredNews.slice(0, 3);
  const businessPreview = filteredBusinesses.slice(0, 8);

  const openCategory = (id: CategoryId) => {
    const routes: Record<CategoryId, "/people" | "/reels" | "/events" | "/news" | "/forums" | "/businesses"> = {
      people: "/people",
      reels: "/reels",
      events: "/events",
      news: "/news",
      forums: "/forums",
      businesses: "/businesses",
    };
    router.push(routes[id] as never);
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="explore"
      unreadCount={unread}
      header={
        <ExploreHeader
          unreadCount={unread}
          onSearch={() => searchRef.current?.focus()}
          onNotifications={() => router.push("/notifications")}
        />
      }
    >
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
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
          <FadeIn delay={40}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search people, posts and hashtags"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </FadeIn>

          <FadeIn delay={90}>
            <View style={styles.grid}>
              {categories.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openCategory(item.id)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    pressed ? styles.gridItemPressed : null,
                  ]}
                >
                  <View style={styles.gridInner} pointerEvents="none">
                    <Ionicons name={item.icon} size={22} color={colors.textMuted} />
                    <Text
                      style={styles.gridLabel}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {t(`explore.${item.id}`)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </FadeIn>

            <FadeIn delay={130}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trending on JOSCITY</Text>
                <Text style={styles.sectionSub}>From what the community is posting</Text>
                {filteredHashtags.length ? (
                  filteredHashtags.map((tag, index) => {
                    const count = Number(tag.posts_count || tag.count || 0);
                    const label = hashtagLabel(tag);
                    return (
                      <Pressable
                        key={`${label}-${index}`}
                        onPress={() =>
                          router.push({
                            pathname: "/hashtag/[tag]",
                            params: { tag: label.replace(/^#+/, "") },
                          })
                        }
                        style={styles.trendRow}
                      >
                        <Text style={styles.trendIndex}>{index + 1}</Text>
                        <View>
                          <Text style={styles.trendTag}>{label}</Text>
                          <Text style={styles.trendMeta}>
                            {count} {count === 1 ? "post" : "posts"} in Jos
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.eventEmpty}>No trending hashtags yet.</Text>
                )}
              </View>
            </FadeIn>

            <FadeIn delay={160}>
              <View style={styles.section}>
                <SectionHeading
                  title={t("explore.happening")}
                  action={t("explore.allEvents")}
                  onPress={() => openCategory("events")}
                />
                {featuredEvents.length ? (
                  featuredEvents.map((item) => (
                    <View
                      key={eventListKey(item)}
                      style={styles.eventPreview}
                    >
                      <EventCard
                        event={item}
                        onPress={() => void openExploreEvent(router, item)}
                      />
                    </View>
                  ))
                ) : eventsLoading ? (
                  <JosCityLoader color={colors.primary} style={{ marginVertical: 18 }} />
                ) : (
                  <Text style={styles.eventEmpty}>{t("explore.eventsEmpty")}</Text>
                )}
              </View>
            </FadeIn>

            {newsPreview.length ? (
              <FadeIn delay={190}>
                <View style={styles.section}>
                  <SectionHeading title="Local news" action="See all" onPress={() => openCategory("news")} />
                  {newsPreview.map((item, index) => (
                    <NewsArticleRow
                      key={item.id}
                      item={item}
                      bordered={index > 0}
                      onPress={() => openNewsArticle(router, item)}
                    />
                  ))}
                </View>
              </FadeIn>
            ) : null}

            <FadeIn delay={220}>
              <View style={styles.section}>
                <SectionHeading
                  title={t("explore.forumsKicker")}
                  action={t("explore.allForums")}
                  onPress={() => openCategory("forums")}
                />
                {filteredForumThreads.length ? (
                  filteredForumThreads.map((thread) => (
                    <ForumThreadRow
                      key={thread.id}
                      thread={thread}
                      showCategory
                      onPress={() => openForumThread(router, thread)}
                    />
                  ))
                ) : (
                  <Text style={styles.eventEmpty}>{t("explore.forumsEmpty")}</Text>
                )}
              </View>
            </FadeIn>

            <PeopleRow
              people={filteredPeople}
              title="People in Jos"
              subtitle="Members you may know"
              onSeeAll={() => openCategory("people")}
            />

            {filteredBusinesses.length || !q ? (
              <FadeIn delay={260}>
                <View style={styles.section}>
                  <SectionHeading
                    title={t("explore.businessesTitle")}
                    action={t("explore.directory")}
                    onPress={() => openCategory("businesses")}
                  />
                  <Text style={[styles.sectionSub, styles.bizSub]}>
                    {t("explore.businessesIntro")}
                  </Text>
                  {businessPreview.length ? null : (
                    <Text style={styles.eventEmpty}>{t("explore.businessesEmpty")}</Text>
                  )}
                </View>
                {businessPreview.map((shop) => (
                  <BusinessRow key={shop.user_id} shop={shop} />
                ))}
              </FadeIn>
            ) : null}
        </ScrollView>
      )}
    </FeedShell>
  );
}

function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.headingRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} disabled={!onPress} hitSlop={8}>
        <Text style={styles.link}>{action}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: TAB_BAR_SPACE + 28,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sheet,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginBottom: 8,
  },
  gridItem: {
    width: "31.5%",
    minHeight: 108,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  gridItemPressed: {
    opacity: 0.82,
  },
  gridInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gridLabel: {
    width: "100%",
    marginTop: 6,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    textAlign: "center",
    includeFontPadding: false,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  sectionSub: {
    marginTop: 2,
    marginBottom: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  bizSub: {
    marginTop: 0,
  },
  link: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  trendIndex: {
    width: 18,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  trendTag: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  trendMeta: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  eventPreview: {
    marginBottom: 18,
  },
  eventEmpty: {
    marginTop: 10,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  imageFallback: {
    backgroundColor: colors.border,
  },
  newsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  newsCopy: {
    flex: 1,
  },
  newsTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  newsMeta: {
    marginTop: 6,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  newsThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#EEEAE3",
  },
  forumRow: {
    paddingVertical: 14,
  },
  forumBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E2DA",
  },
  forumTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  forumBody: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
});
}
