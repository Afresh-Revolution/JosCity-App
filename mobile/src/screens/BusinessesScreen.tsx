import { useCallback, useEffect, useMemo, useState } from "react";
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
import BusinessRow from "../components/explore/BusinessRow";
import DirectorySearch from "../components/explore/DirectorySearch";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getApprovedUsers, type DirectoryUser } from "../api/social";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

export default function BusinessesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [shops, setShops] = useState<DirectoryUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (search = "") => {
    const q = search.trim();
    setShops(
      await getApprovedUsers({
        accountType: "business",
        q: q || undefined,
        allPages: !q,
        limit: q ? 80 : undefined,
      })
    );
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

  const filtered = shops;
  const q = query.trim();

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
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>{t("explore.businessesKicker")}</Text>
            <Text style={styles.title}>{t("explore.businessesTitle")}</Text>
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
                void load(query).finally(() => setRefreshing(false));
              }}
              tintColor={colors.primary}
            />
          }
        >
          <DirectorySearch
            value={query}
            onChangeText={setQuery}
            placeholder={t("explore.searchBusinesses")}
          />
          <Text style={styles.intro}>{t("explore.businessesIntro")}</Text>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("explore.businessesEmpty")}
            </Text>
          ) : (
            filtered.map((shop, index) => (
              <FadeIn key={shop.user_id} delay={Math.min(index * 24, 140)}>
                <BusinessRow shop={shop} />
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
      marginBottom: 8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    empty: {
      marginHorizontal: 16,
      marginTop: 40,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
