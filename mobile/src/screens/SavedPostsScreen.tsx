import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import PostCard from "../components/feed/PostCard";
import { getPost, getSavedPosts, type FeedPost } from "../api/feed";
import { useI18n } from "../i18n/I18nProvider";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { resolveSaved } from "../state/savedPosts";
import { getUser } from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

function isCompletePost(post: FeedPost) {
  const text = String(post.text || post.caption || "").trim();
  const hasMedia = Boolean(post.media?.length || post.media_urls?.length);
  const hasAuthor = Boolean(post.author?.name || post.author?.id || post.user_id);
  return Boolean(text || hasMedia) && hasAuthor;
}

export default function SavedPostsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const s = useSettingsStyles();
  const { t } = useI18n();
  const router = useRouter();
  const allowed = useRequirePersonalAccount();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [viewerId, setViewerId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await getUser();
    setViewerId(Number(me?.user_id || 0) || undefined);
    const result = await getSavedPosts(1, 50);
    if (!result.success) {
      setError(result.message || t("saved.loadError"));
      return;
    }
    const visible = result.data.filter((post) => resolveSaved(post.post_id, true));
    const hydrated = await Promise.all(
      visible.map(async (post) => {
        if (isCompletePost(post)) return post;
        const full = await getPost(post.post_id);
        return full ? { ...post, ...full, user_saved: true } : post;
      })
    );
    setError(null);
    setPosts(hydrated);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  if (!allowed) return null;

  const kicker =
    posts.length === 1 ? t("saved.kickerOne") : t("saved.kickerMany", { count: posts.length });

  return (
    <SettingsPage
      kicker={kicker}
      title={t("saved.title")}
      loading={loading}
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
      {error ? <Text style={s.error}>{error}</Text> : null}
      {!posts.length ? (
        <FadeIn>
          <View style={styles.empty}>
            <View style={styles.iconWrap}>
              <Ionicons name="bookmark-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t("saved.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("saved.emptyBody")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("saved.discover")}
              onPress={() => router.replace("/explore")}
              style={({ pressed }) => [styles.discover, pressed && styles.discoverPressed]}
            >
              <Ionicons name="compass-outline" size={18} color={colors.white} />
              <Text style={styles.discoverLabel}>{t("saved.discover")}</Text>
            </Pressable>
          </View>
        </FadeIn>
      ) : (
        posts.map((post) => (
          <View key={String(post.post_id)} style={styles.postWrap}>
            <PostCard
              post={post}
              viewerId={viewerId}
              onDeleted={(id) =>
                setPosts((current) => current.filter((item) => Number(item.post_id) !== id))
              }
              onSavedChange={(id, saved) => {
                if (!saved) {
                  setPosts((current) => current.filter((item) => Number(item.post_id) !== id));
                }
              }}
            />
          </View>
        ))
      )}
    </SettingsPage>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    empty: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 72,
      paddingBottom: 40,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: colors.navActive,
      borderWidth: 1.5,
      borderColor: "rgba(15, 61, 38, 0.22)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },
    emptyTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    emptyBody: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 300,
      marginBottom: 28,
    },
    discover: {
      minHeight: 52,
      paddingHorizontal: 22,
      borderRadius: 999,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    discoverPressed: {
      backgroundColor: colors.primaryPressed,
    },
    discoverLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.white,
    },
    postWrap: {
      marginHorizontal: -16,
    },
  });
}
