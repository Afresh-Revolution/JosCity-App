import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PostCard from "../components/feed/PostCard";
import { getPostsByHashtag, normalizeHashtagName, type FeedPost } from "../api/feed";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

export default function HashtagPostsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tag = normalizeHashtagName(raw);
  const label = tag ? `#${tag}` : "#";

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [viewerId, setViewerId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!tag) {
      setPosts([]);
      return;
    }
    const me = await getUser();
    setViewerId(Number(me?.user_id || 0) || undefined);
    const result = await getPostsByHashtag(tag, 1, 40);
    setPosts(result.data);
  }, [tag]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

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
          <View style={styles.titleWrap}>
            <Text style={styles.kicker}>{t("explore.hashtagKicker")}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
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
          {!posts.length ? (
            <Text style={styles.empty}>{t("explore.hashtagEmpty")}</Text>
          ) : (
            posts.map((post, index) => (
              <PostCard
                key={String(post.post_id)}
                post={post}
                delay={Math.min(index * 40, 160)}
                viewerId={viewerId}
                onDeleted={(id) =>
                  setPosts((current) => current.filter((item) => Number(item.post_id) !== id))
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </FeedShell>
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
    titleWrap: {
      flex: 1,
      paddingRight: 16,
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
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    empty: {
      textAlign: "center",
      marginTop: 48,
      paddingHorizontal: 24,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
