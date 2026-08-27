import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import TextField from "../components/TextField";
import {
  createForumCategory,
  createForumThread,
  getForumCategories,
  matchForumCategory,
  type ForumCategory,
} from "../api/forum";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openForumThread } from "../utils/openForum";

const DRAFT_SLUG = "__new__";

export default function ForumCreateScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ category?: string }>();
  const presetSlug = String(params.category || "");
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [slug, setSlug] = useState(presetSlug);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void getForumCategories()
        .then((rows) => {
          setCategories(rows);
          setSlug((current) =>
            current && current !== DRAFT_SLUG ? current : presetSlug || rows[0]?.slug || ""
          );
        })
        .finally(() => setLoading(false));
    }, [allowed, presetSlug])
  );

  const savedCategories = categories.filter((item) => item.slug !== DRAFT_SLUG);

  const commitCategory = async (name: string): Promise<ForumCategory | null> => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    const existing = matchForumCategory(savedCategories, trimmed);
    if (existing) {
      setCategories(savedCategories);
      setSlug(existing.slug);
      setNewCategory("");
      return existing;
    }
    setAddingCategory(true);
    const result = await createForumCategory(trimmed);
    setAddingCategory(false);
    if (!result.success || !result.data) {
      Alert.alert(t("forums.addCategory"), result.message || t("forums.categoryFailed"));
      return null;
    }
    setCategories((current) => {
      const withoutDraft = current.filter((item) => item.slug !== DRAFT_SLUG);
      return matchForumCategory(withoutDraft, result.data!.name)
        ? withoutDraft
        : [...withoutDraft, result.data!];
    });
    setSlug(result.data.slug);
    setNewCategory("");
    return result.data;
  };

  const onCategoryText = (value: string) => {
    setNewCategory(value);
    const trimmed = value.trim();
    const existing = matchForumCategory(savedCategories, trimmed);
    if (existing) {
      setCategories(savedCategories);
      setSlug(existing.slug);
      return;
    }
    if (trimmed.length < 2) {
      setCategories(savedCategories);
      if (slug === DRAFT_SLUG) setSlug(presetSlug || savedCategories[0]?.slug || "");
      return;
    }
    setCategories([
      ...savedCategories,
      {
        id: 0,
        slug: DRAFT_SLUG,
        name: trimmed,
        description: "",
        icon: "chatbubbles-outline",
        thread_count: 0,
      },
    ]);
    setSlug(DRAFT_SLUG);
  };

  const onPost = async () => {
    if (saving) return;
    let next = savedCategories.find((item) => item.slug === slug);
    const typed = newCategory.trim();
    if (typed.length >= 2) {
      const committed = await commitCategory(typed);
      if (committed) next = committed;
    }
    if (!next?.slug) {
      Alert.alert(t("forums.start"), t("forums.chooseCategory"));
      return;
    }
    setSaving(true);
    const result = await createForumThread({
      category_slug: next.slug,
      category_name: next.name,
      title: title.trim(),
      body: body.trim(),
    });
    setSaving(false);
    if (!result.success || !result.data) {
      Alert.alert(t("forums.start"), result.message || t("forums.postFailed"));
      return;
    }
    openForumThread(router, result.data, "replace");
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/forums" as never))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("forums.start")}</Text>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>{t("forums.createIntro")}</Text>
            <Text style={styles.label}>{t("forums.chooseCategory")}</Text>
            <View style={styles.chips}>
              {categories.map((category) => {
                const active = category.slug === slug;
                return (
                  <Pressable
                    key={category.slug}
                    onPress={() => {
                      setSlug(category.slug);
                      if (category.slug !== DRAFT_SLUG) setNewCategory("");
                    }}
                    style={[styles.chip, active && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={category.name}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.addRow}>
              <TextInput
                value={newCategory}
                onChangeText={onCategoryText}
                placeholder={t("forums.addCategory")}
                placeholderTextColor={colors.textMuted}
                style={styles.addInput}
                maxLength={48}
                returnKeyType="done"
                onSubmitEditing={() => void commitCategory(newCategory)}
              />
              <Pressable
                onPress={() => void commitCategory(newCategory)}
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
            <Text style={styles.hint}>{t("forums.addCategoryHint")}</Text>
            <TextField
              label={t("forums.threadTitle")}
              value={title}
              onChangeText={setTitle}
              placeholder={t("forums.titlePlaceholder")}
              maxLength={140}
            />
            <Text style={styles.label}>{t("forums.openingPost")}</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("forums.bodyPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={styles.area}
              multiline
              textAlignVertical="top"
              maxLength={5000}
            />
            <AppButton
              label={t("forums.publish")}
              onPress={() => void onPost()}
              loading={saving}
              disabled={
                (!slug && newCategory.trim().length < 2) ||
                title.trim().length < 8 ||
                body.trim().length < 12
              }
            />
          </ScrollView>
        </KeyboardAvoidingView>
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
      marginBottom: 18,
    },
    label: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.card,
    },
    chipOn: {
      backgroundColor: colors.navActive,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
    },
    chipTextOn: {
      color: colors.primary,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
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
    hint: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 16,
    },
    area: {
      minHeight: 140,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      marginBottom: 18,
    },
  });
}
