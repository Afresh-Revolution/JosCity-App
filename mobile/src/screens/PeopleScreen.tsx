import { useCallback, useEffect, useMemo, useState } from "react";
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
import { PersonListRow } from "../components/feed/PeopleRow";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getApprovedUsers, type DirectoryUser } from "../api/social";
import { refreshFriendGraph } from "../state/friendGraph";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

export default function PeopleScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (search = "") => {
    const q = search.trim();
    const rows = await getApprovedUsers({
      limit: 80,
      accountType: "personal",
      q: q || undefined,
    });
    setPeople(rows);
    await refreshFriendGraph();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load(query).finally(() => setLoading(false));
    }, [allowed, load])
  );

  useEffect(() => {
    if (!allowed) return;
    const timer = setTimeout(() => {
      void load(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [allowed, load, query]);

  const q = query.trim();
  const filtered = people;

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
          <View style={styles.heading}>
            <Text style={styles.kicker}>{t("people.kicker")}</Text>
            <Text style={styles.title}>{t("people.title")}</Text>
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
                void load(query).finally(() => setRefreshing(false));
              }}
              tintColor={colors.primary}
            />
          }
        >
          <DirectorySearch
            value={query}
            onChangeText={setQuery}
            placeholder={t("people.search")}
          />
          <Text style={styles.intro}>{t("people.intro")}</Text>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>{q ? t("explore.searchEmpty") : t("people.empty")}</Text>
          ) : (
            filtered.map((person, index) => (
              <FadeIn key={person.user_id} delay={Math.min(index * 30, 160)}>
                <PersonListRow person={person} />
              </FadeIn>
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
    heading: {
      flex: 1,
      paddingRight: 12,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
    },
    content: {
      paddingTop: 8,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    intro: {
      marginHorizontal: 16,
      marginBottom: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    empty: {
      marginHorizontal: 16,
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
