import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import NewsCollage from "../components/explore/NewsCollage";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getNews, type NewsItem } from "../api/explore";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getCachedOpenNews } from "../state/openNews";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { mediaUrls, timeAgo } from "../utils/format";
import { newsBody, newsMetaLabel, newsSnippet } from "../utils/news";
import { shareNewsArticle } from "../utils/share";

export default function NewsDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id || 0);
  const [item, setItem] = useState<NewsItem | null>(() => getCachedOpenNews(id));
  const [loading, setLoading] = useState(!item);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const row = await getNews(id);
    if (row) setItem(row);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const onShare = async () => {
    if (!item?.id || sharing) return;
    setSharing(true);
    await shareNewsArticle(item.id, item.title, newsSnippet(item.content, 160));
    setSharing(false);
  };

  const body = newsBody(item?.content);
  const meta = newsMetaLabel(timeAgo(item?.created_at));
  const videos = mediaUrls(item?.video_urls);
  const sources = mediaUrls(item?.source_links);

  return (
    <FeedShell
      tab="explore"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/news"))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item?.title || t("explore.newsTitle")}
          </Text>
        </View>
      }
    >
      {loading && !item ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !item ? (
        <Text style={styles.empty}>{t("explore.newsMissing")}</Text>
      ) : (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <FadeIn>
              <NewsCollage urls={mediaUrls(item.image_urls)} />
              <Text style={styles.meta}>{meta}</Text>
              <Text style={styles.title}>{item.title || t("explore.newsTitle")}</Text>
              {body ? <Text style={styles.body}>{body}</Text> : null}
              {videos.map((url) => (
                <Pressable
                  key={url}
                  onPress={() => void Linking.openURL(url)}
                  style={styles.linkRow}
                >
                  <Ionicons name="play-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.linkText}>{t("explore.newsWatchVideo")}</Text>
                </Pressable>
              ))}
              {sources.length ? (
                <View style={styles.sources}>
                  <Text style={styles.sourceKicker}>{t("explore.newsSources")}</Text>
                  {sources.map((url) => (
                    <Pressable key={url} onPress={() => void Linking.openURL(url)}>
                      <Text style={styles.sourceLink}>{url}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </FadeIn>
          </ScrollView>
          <View style={styles.shareBar}>
            <AppButton
              label={t("explore.newsShare")}
              onPress={() => void onShare()}
              loading={sharing}
            />
          </View>
        </View>
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
      paddingRight: 12,
    },
    empty: {
      marginHorizontal: 24,
      marginTop: 40,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.textMuted,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 24,
    },
    meta: {
      marginTop: 16,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.7,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      lineHeight: 32,
      color: colors.text,
    },
    body: {
      marginTop: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: 26,
      color: colors.text,
    },
    linkRow: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    linkText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.primary,
    },
    sources: {
      marginTop: 22,
      gap: 8,
    },
    sourceKicker: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 12,
      letterSpacing: 0.5,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    sourceLink: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.primary,
    },
    shareBar: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: TAB_BAR_SPACE + 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
}
