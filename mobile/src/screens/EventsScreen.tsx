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
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import DirectorySearch from "../components/explore/DirectorySearch";
import EventCard from "../components/explore/EventCard";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  eventListKey,
  eventLocation,
  eventTitle,
  uniqueExploreEvents,
  getCachedExploreEvents,
  getExploreEvents,
  type ExploreEvent,
} from "../api/explore";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openExploreEvent } from "../utils/openExploreEvent";

export default function EventsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [events, setEvents] = useState<ExploreEvent[]>(() => getCachedExploreEvents());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => getCachedExploreEvents().length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const cached = getCachedExploreEvents();
    if (cached.length) {
      setEvents(cached);
      setLoading(false);
    }
    await getExploreEvents(100, (rows) => {
      setEvents(rows);
      if (rows.length) setLoading(false);
    });
    setLoading(false);
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
      uniqueExploreEvents(
        q
          ? events.filter((event) =>
              `${eventTitle(event)} ${eventLocation(event)}`.toLowerCase().includes(q)
            )
          : events
      ),
    [events, q]
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
          <View>
            <Text style={styles.kicker}>{t("explore.eventsKicker")}</Text>
            <Text style={styles.title}>{t("explore.eventsTitle")}</Text>
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
            placeholder={t("explore.searchEvents")}
          />
          <Text style={styles.intro}>{t("explore.eventsIntro")}</Text>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("explore.eventsEmpty")}
            </Text>
          ) : (
            filtered.map((event, index) => (
              <FadeIn key={eventListKey(event, index)} delay={Math.min(index * 40, 160)}>
                <View style={styles.card}>
                  <EventCard
                    event={event}
                    compact
                    onPress={() => void openExploreEvent(router, event)}
                  />
                </View>
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
      paddingTop: 8,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    intro: {
      marginHorizontal: 16,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 16,
    },
    empty: {
      textAlign: "center",
      marginTop: 48,
      marginHorizontal: 16,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    card: {
      marginHorizontal: 16,
      marginBottom: 22,
    },
  });
}
