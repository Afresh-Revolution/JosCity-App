import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import DirectorySearch from "../components/explore/DirectorySearch";
import NewsArticleRow from "../components/explore/NewsArticleRow";
import NewsCollage from "../components/explore/NewsCollage";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getPublishedNews, type NewsItem } from "../api/explore";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { mediaUrls, timeAgo } from "../utils/format";
import { newsMetaLabel, newsSnippet } from "../utils/news";
import { openNewsArticle } from "../utils/openNews";

export default function NewsListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await getPublishedNews(80));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? items.filter((item) =>
            `${item.title || ""} ${item.content || ""}`.toLowerCase().includes(q)
          )
        : items,
    [items, q]
  );
  const featured = !q && filtered[0] ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>{t("explore.newsKicker")}</Text>
            <Text style={styles.title}>{t("explore.newsTitle")}</Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
              tintColor={colors.primary}
            />
          }
        >
          <DirectorySearch
            value={query}
            onChangeText={setQuery}
            placeholder={t("explore.searchNews")}
          />
          {filtered.length === 0 ? (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("explore.newsEmpty")}
            </Text>
          ) : (
            <>
              {featured ? (
                <FadeIn>
                  <FeaturedNews item={featured} onPress={() => openNewsArticle(router, featured)} />
                </FadeIn>
              ) : null}
              {rest.map((item, index) => (
                <FadeIn key={item.id} delay={Math.min((index + 1) * 24, 140)}>
                  <View style={styles.listPad}>
                    <NewsArticleRow
                      item={item}
                      bordered={Boolean(featured) || index > 0}
                      onPress={() => openNewsArticle(router, item)}
                    />
                  </View>
                </FadeIn>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </FeedShell>
  );
}

function FeaturedNews({ item, onPress }: { item: NewsItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const snippet = newsSnippet(item.content);
  const meta = newsMetaLabel(timeAgo(item.created_at));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
      <NewsCollage urls={mediaUrls(item.image_urls)} />
      <Text style={styles.featuredMeta}>{meta}</Text>
      <Text style={styles.featuredTitle}>{item.title || "JOSCITY News"}</Text>
      {snippet ? <Text style={styles.featuredSnippet}>{snippet}</Text> : null}
    </Pressable>
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
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
      marginTop: -2,
    },
    content: {
      paddingTop: 4,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    empty: {
      marginHorizontal: 16,
      marginTop: 40,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    featured: {
      paddingHorizontal: 18,
      paddingBottom: 8,
    },
    pressed: { opacity: 0.86 },
    featuredMeta: {
      marginTop: 16,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.7,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    featuredTitle: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      lineHeight: 32,
      color: colors.text,
    },
    featuredSnippet: {
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
    },
    listPad: {
      paddingHorizontal: 18,
    },
  });
}
