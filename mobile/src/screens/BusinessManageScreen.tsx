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
import { ErrorBanner } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getBusinessManage, type BusinessManage } from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira } from "../utils/format";

type RowItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function mergeManage(data: BusinessManage, user: StoredUser | null): BusinessManage {
  if (!user) return data;
  const name =
    data.profile.name !== "Your business"
      ? data.profile.name
      : String(user.business_name || user.display_name || "").trim() || data.profile.name;
  return { ...data, profile: { ...data.profile, name } };
}

export default function BusinessManageScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [data, setData] = useState<BusinessManage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const [manage, user] = await Promise.all([getBusinessManage(), getUser()]);
        setData(mergeManage(manage, user));
        setError(null);
      } catch {
        setError(t("business.manageLoadError"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load();
    }, [allowed, load])
  );

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  const reviews = data?.selling.reviews;
  const reviewSubtitle =
    reviews && reviews.count > 0
      ? t("business.manageReviewsMeta", {
          rating: reviews.average.toFixed(1),
          count: reviews.count,
        })
      : t("business.manageReviewsEmpty");
  const staffCount = data?.account.staff_count || 0;

  const selling: RowItem[] = [
    {
      key: "catalog",
      icon: "cube-outline",
      title: t("business.manageCatalog"),
      subtitle: t("business.manageCatalogMeta", { count: data?.selling.catalog_count || 0 }),
      onPress: () => router.push("/business/catalog"),
    },
    {
      key: "add",
      icon: "add",
      title: t("business.manageAddListing"),
      subtitle: t("business.manageAddListingMeta"),
      onPress: () => router.push("/business/new-listing"),
    },
    {
      key: "orders",
      icon: "clipboard-outline",
      title: t("business.manageOrders"),
      subtitle:
        data?.selling.orders_awaiting
          ? t("business.manageOrdersMeta", { count: data.selling.orders_awaiting })
          : t("business.manageOrdersEmpty"),
      onPress: () => router.push("/business/orders"),
    },
    {
      key: "reviews",
      icon: "star-outline",
      title: t("business.reviews"),
      subtitle: reviewSubtitle,
      onPress: () => router.push("/business/reviews"),
    },
  ];

  const money: RowItem[] = [
    {
      key: "wallet",
      icon: "cash-outline",
      title: t("business.manageWallet"),
      subtitle: t("business.manageWalletMeta", {
        amount: formatNaira(data?.money.wallet_available || 0),
      }),
      onPress: () => router.push("/business/wallet"),
    },
    {
      key: "insights",
      icon: "stats-chart-outline",
      title: t("business.insights"),
      subtitle: t("business.manageInsightsMeta"),
      onPress: () => router.push("/business/insights"),
    },
    {
      key: "membership",
      icon: "ribbon-outline",
      title: t("business.manageMembership"),
      subtitle: data?.money.membership.label || t("business.manageMembershipEmpty"),
      onPress: () => router.push("/profile/membership"),
    },
  ];

  const community: RowItem[] = [
    {
      key: "posts",
      icon: "create-outline",
      title: t("business.managePosts"),
      subtitle: t("business.managePostsMeta", {
        count: data?.community.published_posts || 0,
      }),
      onPress: () => router.push("/home"),
    },
    {
      key: "scheduled",
      icon: "calendar-outline",
      title: t("business.manageScheduled"),
      subtitle:
        data?.community.scheduled_posts
          ? t("business.manageScheduledMeta", { count: data.community.scheduled_posts })
          : t("business.manageScheduledEmpty"),
      onPress: () => router.push("/business/scheduled"),
    },
    {
      key: "messages",
      icon: "chatbubble-outline",
      title: t("business.manageMessages"),
      subtitle: t("business.manageMessagesMeta"),
      onPress: () => router.push("/messages"),
    },
  ];

  const account: RowItem[] = [
    {
      key: "details",
      icon: "document-text-outline",
      title: t("business.manageDetails"),
      subtitle: data?.account.details_label || t("business.manageDetailsMeta"),
      onPress: () => router.push("/profile/personal-details"),
    },
    {
      key: "verification",
      icon: "shield-checkmark-outline",
      title: t("business.manageVerification"),
      subtitle: data?.account.verification_label || t("business.unverified"),
      onPress: () => router.push("/profile/verification"),
    },
    {
      key: "team",
      icon: "people-outline",
      title: t("business.manageTeam"),
      subtitle: staffCount
        ? t("business.manageTeamMeta", { count: staffCount })
        : t("business.manageTeamEmpty"),
      onPress: () => router.push("/profile/personal-details"),
    },
    {
      key: "settings",
      icon: "settings-outline",
      title: t("business.manageSettings"),
      subtitle: t("business.manageSettingsMeta"),
      onPress: () => router.push("/profile/account-settings"),
    },
  ];

  return (
    <FeedShell tab="manage" header={<View />}>
      {loading && !data ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />
          }
        >
          <FadeIn>
            <Text numberOfLines={1} style={styles.kicker}>
              {data?.profile.name || t("business.fallbackName")}
            </Text>
            <Text style={styles.title}>{t("business.manageTitle")}</Text>
            <View style={styles.rule} />
          </FadeIn>

          {error ? <ErrorBanner message={error} /> : null}

          <FadeIn delay={40}>
            <View style={styles.stats}>
              <Stat
                value={String(data?.stats.live_listings ?? 0)}
                label={t("business.manageLive")}
                sub={t("business.manageLiveSub")}
                styles={styles}
              />
              <View style={styles.statDivider} />
              <Stat
                value={String(data?.stats.to_approve ?? 0)}
                label={t("business.manageApprove")}
                sub={t("business.manageApproveSub")}
                styles={styles}
              />
              <View style={styles.statDivider} />
              <Stat
                value={formatNaira(data?.stats.payout_ready || 0)}
                label={t("business.managePayout")}
                sub={t("business.nextPayout", {
                  day: data?.stats.next_payout_label || "Friday",
                })}
                styles={styles}
                compact
              />
            </View>
          </FadeIn>

          <Section title={t("business.manageSelling")} rows={selling} styles={styles} colors={colors} />
          <Section title={t("business.manageMoney")} rows={money} styles={styles} colors={colors} />
          <Section title={t("business.manageCommunity")} rows={community} styles={styles} colors={colors} />
          <Section title={t("business.manageAccount")} rows={account} styles={styles} colors={colors} />
        </ScrollView>
      )}
    </FeedShell>
  );
}

function Stat({
  value,
  label,
  sub,
  styles,
  compact,
}: {
  value: string;
  label: string;
  sub: string;
  styles: ReturnType<typeof makeStyles>;
  compact?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function Section({
  title,
  rows,
  styles,
  colors,
}: {
  title: string;
  rows: RowItem[];
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <FadeIn delay={80}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowBorder,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconBox}>
              <Ionicons name={row.icon} size={18} color={colors.text} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text numberOfLines={1} style={styles.rowSub}>
                {row.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </FadeIn>
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
    content: {
      paddingHorizontal: 20,
      paddingBottom: TAB_BAR_SPACE + 16,
    },
    kicker: {
      marginTop: 6,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 34,
      color: colors.text,
    },
    rule: {
      marginTop: 14,
      marginBottom: 18,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    error: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.error,
      marginBottom: 12,
    },
    stats: {
      flexDirection: "row",
      marginBottom: 28,
    },
    stat: {
      flex: 1,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginHorizontal: 10,
    },
    statValue: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
    },
    statValueCompact: {
      fontSize: 18,
      marginTop: 6,
    },
    statLabel: {
      marginTop: 6,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.text,
    },
    statSub: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    sectionTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
      marginBottom: 10,
    },
    list: {
      backgroundColor: colors.card,
      borderRadius: 18,
      marginBottom: 26,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: colors.sheet,
    },
    rowCopy: {
      flex: 1,
      paddingRight: 8,
    },
    rowTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    rowSub: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
