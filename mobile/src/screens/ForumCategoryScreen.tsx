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
import FadeIn from "../components/FadeIn";
import ForumThreadRow from "../components/explore/ForumThreadRow";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  getForumCategory,
  getForumThreads,
  type ForumCategory,
  type ForumThread,
} from "../api/forum";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openForumCreate, openForumThread } from "../utils/openForum";

export default function ForumCategoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = String(params.slug || "");
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    const [nextCategory, nextThreads] = await Promise.all([
      getForumCategory(slug),
      getForumThreads({ category: slug, limit: 60 }),
    ]);
    setCategory(nextCategory);
    setThreads(nextThreads);
  }, [slug]);

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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/forums" as never))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>{t("explore.forumsTitle")}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {category?.name || t("explore.forumsTitle")}
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
          {category?.description ? (
            <Text style={styles.intro}>{category.description}</Text>
          ) : null}
          <Pressable
            onPress={() => openForumCreate(router, slug)}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("forums.start")}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.ctaLabel}>{t("forums.start")}</Text>
          </Pressable>
          <Text style={styles.section}>{t("forums.latest")}</Text>
          {threads.length ? (
            threads.map((thread) => (
              <FadeIn key={thread.id}>
                <ForumThreadRow thread={thread} onPress={() => openForumThread(router, thread)} />
              </FadeIn>
            ))
          ) : (
            <Text style={styles.empty}>{t("forums.categoryEmpty")}</Text>
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
    headerCopy: { flex: 1, paddingRight: 12 },
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 24,
      color: colors.text,
      marginTop: -2,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 14,
    },
    cta: {
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 18,
    },
    ctaPressed: { backgroundColor: colors.primaryPressed },
    ctaLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.white,
    },
    section: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
      marginBottom: 4,
    },
    empty: {
      marginTop: 16,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
