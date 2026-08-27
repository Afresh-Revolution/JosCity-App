import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import DirectorySearch from "../components/explore/DirectorySearch";
import ForumCategoryRow from "../components/explore/ForumCategoryRow";
import ForumThreadRow from "../components/explore/ForumThreadRow";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  createForumCategory,
  getForumOverview,
  matchForumCategory,
  type ForumCategory,
  type ForumThread,
} from "../api/forum";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openForumCategory, openForumCreate, openForumThread } from "../utils/openForum";

export default function ForumsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const load = useCallback(async () => {
    const data = await getForumOverview(12);
    setCategories(data.categories);
    setThreads(data.threads);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const q = query.trim().toLowerCase();
  const filteredCategories = useMemo(
    () =>
      q
        ? categories.filter((item) =>
            `${item.name} ${item.description || ""}`.toLowerCase().includes(q)
          )
        : categories,
    [categories, q]
  );
  const filteredThreads = useMemo(
    () =>
      q
        ? threads.filter((item) =>
            `${item.title} ${item.category_name || ""} ${item.author?.name || ""}`
              .toLowerCase()
              .includes(q)
          )
        : threads,
    [threads, q]
  );

  const onAddCategory = async () => {
    const name = newCategory.trim();
    if (name.length < 2 || addingCategory) return;
    const existing = matchForumCategory(categories, name);
    if (existing) {
      setNewCategory("");
      openForumCategory(router, existing.slug);
      return;
    }
    setAddingCategory(true);
    const result = await createForumCategory(name);
    setAddingCategory(false);
    if (!result.success || !result.data) {
      Alert.alert(t("forums.addCategory"), result.message || t("forums.categoryFailed"));
      return;
    }
    setCategories((current) =>
      matchForumCategory(current, result.data!.name) ? current : [...current, result.data!]
    );
    setNewCategory("");
  };

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
            <Text style={styles.kicker}>{t("explore.forumsKicker")}</Text>
            <Text style={styles.title}>{t("explore.forumsTitle")}</Text>
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
            placeholder={t("forums.search")}
          />
          <Pressable
            onPress={() => openForumCreate(router)}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("forums.start")}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.ctaLabel}>{t("forums.start")}</Text>
          </Pressable>

          <Text style={styles.section}>{t("forums.categories")}</Text>
          <View style={styles.addRow}>
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder={t("forums.addCategory")}
              placeholderTextColor={colors.textMuted}
              style={styles.addInput}
              maxLength={48}
              returnKeyType="done"
              onSubmitEditing={() => void onAddCategory()}
            />
            <Pressable
              onPress={() => void onAddCategory()}
              disabled={addingCategory || newCategory.trim().length < 2}
              style={[
                styles.addBtn,
                (addingCategory || newCategory.trim().length < 2) && styles.addBtnOff,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("forums.addCategory")}
            >
              {addingCategory ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="add" size={20} color={colors.white} />
              )}
            </Pressable>
          </View>
          {filteredCategories.length ? (
            filteredCategories.map((category) => (
              <FadeIn key={category.slug}>
                <View style={styles.pad}>
                  <ForumCategoryRow
                    category={category}
                    onPress={() => openForumCategory(router, category.slug)}
                  />
                </View>
              </FadeIn>
            ))
          ) : (
            <Text style={styles.empty}>{t("forums.categoriesEmpty")}</Text>
          )}

          <Text style={[styles.section, styles.sectionSpaced]}>{t("forums.latest")}</Text>
          {filteredThreads.length ? (
            filteredThreads.map((thread) => (
              <FadeIn key={thread.id}>
                <View style={styles.pad}>
                  <ForumThreadRow
                    thread={thread}
                    showCategory
                    onPress={() => openForumThread(router, thread)}
                  />
                </View>
              </FadeIn>
            ))
          ) : (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("forums.threadsEmpty")}
            </Text>
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
    cta: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    ctaPressed: {
      backgroundColor: colors.primaryPressed,
    },
    ctaLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.white,
    },
    section: {
      marginHorizontal: 18,
      marginTop: 18,
      marginBottom: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    sectionSpaced: {
      marginTop: 28,
    },
    pad: {
      paddingHorizontal: 18,
    },
    addRow: {
      marginHorizontal: 18,
      marginTop: 8,
      marginBottom: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    addInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.text,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnOff: { opacity: 0.4 },
    empty: {
      marginHorizontal: 18,
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
