import { useCallback, useMemo, useRef, useState } from "react";
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
import { ErrorBanner } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  getBusinessOverview,
  type BusinessActivityItem,
  type BusinessAttentionItem,
  type BusinessOverview,
} from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import { businessCategoryLabel } from "../constants/businessCategories";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira } from "../utils/format";

const ATTENTION_ICONS: Record<
  BusinessAttentionItem["type"],
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  payments: { icon: "shield-checkmark", bg: "#F4E4C8", fg: "#C2410C" },
  delivery: { icon: "clipboard", bg: "#DCEBFE", fg: "#1D4ED8" },
  restock: { icon: "cube", bg: "#E8E8E8", fg: "#525252" },
  profile: { icon: "star", bg: "#E8E8E8", fg: "#525252" },
};

const ACTIVITY_ICONS: Record<
  BusinessActivityItem["type"],
  keyof typeof Ionicons.glyphMap
> = {
  payment: "shield-checkmark-outline",
  review: "star-outline",
  delivery: "clipboard-outline",
  withdrawal: "wallet-outline",
  view: "storefront-outline",
  order: "receipt-outline",
};

function mergeOverviewUser(overview: BusinessOverview, user: StoredUser | null): BusinessOverview {
  if (!user) return overview;
  const name =
    overview.profile.name !== "Your business"
      ? overview.profile.name
      : String(user.business_name || user.display_name || "").trim() || overview.profile.name;
  const picture =
    overview.profile.picture ||
    (typeof user.user_picture === "string" ? user.user_picture : null) ||
    (typeof user.picture === "string" ? user.picture : null);
  const category =
    overview.profile.category !== "Business"
      ? businessCategoryLabel(overview.profile.category)
      : businessCategoryLabel(String(user.business_type || "").trim() || overview.profile.category);
  return {
    ...overview,
    profile: { ...overview.profile, name, picture, category },
  };
}

export default function BusinessOverviewScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const shopY = useRef(0);
  const activityY = useRef(0);
  const [data, setData] = useState<BusinessOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "replace" | "refresh" = "replace") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      const [overview, user] = await Promise.all([getBusinessOverview(), getUser()]);
      setData(mergeOverviewUser(overview, user));
      setError(null);
    } catch {
      setError(t("business.loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load("replace");
    }, [allowed, load])
  );

  const trendUp = (data?.revenue.change_percent || 0) >= 0;
  const maxBar = Math.max(1, ...(data?.revenue.days.map((day) => day.amount) || [1]));
  const unread = data?.unread_notifications || 0;
  const badge = unread > 99 ? "99+" : String(unread);

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="overview"
      unreadCount={unread}
      header={
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AvatarCircle
              name={data?.profile.name}
              uri={data?.profile.picture}
              size={40}
            />
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t("business.kicker")}</Text>
              <Text numberOfLines={1} style={styles.headerName}>
                {data?.profile.name || t("business.fallbackName")}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.notifications")}
            onPress={() => router.push("/notifications")}
            style={styles.bell}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      }
    >
      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />
          }
        >
          {error ? <ErrorBanner message={error} /> : null}

          <FadeIn>
            <View style={styles.profileCard}>
              <AvatarCircle
                name={data?.profile.name}
                uri={data?.profile.picture}
                size={72}
                preview
              />
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.profileName}>
                  {data?.profile.name}
                </Text>
                <Text numberOfLines={1} style={styles.profileCategory}>
                  {data?.profile.category}
                </Text>
                <View
                  style={[
                    styles.verified,
                    {
                      backgroundColor: data?.profile.cac_verified
                        ? colors.success
                        : data?.profile.has_cac
                          ? colors.warning
                          : colors.warning,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                  <Text style={styles.verifiedText}>
                    {data?.profile.cac_verified
                      ? t("business.verified")
                      : data?.profile.has_cac
                        ? t("business.cacPending")
                        : t("business.noCac")}
                  </Text>
                </View>
              </View>
            </View>
          </FadeIn>

          {data?.attention.length ? (
            <FadeIn delay={60}>
              <Text style={styles.sectionTitle}>{t("business.attention")}</Text>
              <View style={styles.listCard}>
                {data.attention.map((item, index) => {
                  const look = ATTENTION_ICONS[item.type];
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        if (item.type === "restock") router.push("/business/catalog");
                        else if (item.type === "profile") router.push("/profile/personal-details");
                        else if (item.type === "delivery") router.push("/business/orders");
                        else router.push("/business/orders");
                      }}
                      style={[styles.attentionRow, index > 0 && styles.rowBorder]}
                    >
                      <View style={[styles.attentionIcon, { backgroundColor: look.bg }]}>
                        <Ionicons name={look.icon} size={16} color={look.fg} />
                      </View>
                      <View style={styles.attentionCopy}>
                        <Text style={styles.attentionTitle}>{item.title}</Text>
                        <Text numberOfLines={1} style={styles.attentionSub}>
                          {item.subtitle}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </FadeIn>
          ) : null}

          <FadeIn delay={90}>
            <View
              onLayout={(event) => {
                shopY.current = event.nativeEvent.layout.y;
              }}
              style={styles.sectionHead}
            >
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t("business.shopTitle")}</Text>
              <Pressable onPress={() => router.push("/business/insights")}>
                <Text style={styles.link}>{t("business.insights")}</Text>
              </Pressable>
            </View>
            <View style={styles.revenueCard}>
              <Text style={styles.metricKicker}>{t("business.revenueKicker")}</Text>
              <View style={styles.revenueRow}>
                <Text style={styles.revenueValue}>
                  {formatNaira(data?.revenue.last_7_days || 0)}
                </Text>
                <View style={[styles.trend, trendUp ? styles.trendUp : styles.trendDown]}>
                  <Ionicons
                    name={trendUp ? "arrow-up" : "arrow-down"}
                    size={12}
                    color={trendUp ? "#166534" : colors.error}
                  />
                  <Text style={[styles.trendText, !trendUp && styles.trendTextDown]}>
                    {trendUp ? "+" : ""}
                    {Number(data?.revenue.change_percent || 0).toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.chart}>
                {(data?.revenue.days || []).map((day) => (
                  <View key={day.key} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          day.is_today && styles.barToday,
                          { height: Math.max(8, Math.round((day.amount / maxBar) * 72)) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, day.is_today && styles.barLabelToday]}>
                      {day.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricKicker}>{t("business.openOrders")}</Text>
                <Text style={styles.metricValue}>{data?.metrics.open_orders ?? 0}</Text>
                <Text style={styles.metricSub}>
                  {data?.metrics.awaiting_proof
                    ? t("business.awaitingProof", { count: data.metrics.awaiting_proof })
                    : t("business.noOpenOrders")}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricKicker}>{t("business.listingViews")}</Text>
                <Text style={styles.metricValue}>
                  {Number(data?.metrics.listing_views || 0).toLocaleString("en-NG")}
                </Text>
                <Text style={styles.metricSub}>
                  {t("business.viewsWeek", {
                    count: Number(data?.metrics.listing_views_week || 0).toLocaleString("en-NG"),
                  })}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricKicker}>{t("business.payoutReady")}</Text>
                <Text style={styles.metricValue}>
                  {formatNaira(data?.metrics.payout_ready || 0)}
                </Text>
                <Text style={styles.metricSub}>
                  {t("business.nextPayout", {
                    day: data?.metrics.next_payout_label || "Friday",
                  })}
                </Text>
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={150}>
            <View
              onLayout={(event) => {
                activityY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>{t("business.activity")}</Text>
            </View>
            {data?.activity.length ? (
              <View style={styles.listCard}>
                {data.activity.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.activityRow, index > 0 && styles.rowBorder]}
                  >
                    <View style={styles.activityIcon}>
                      <Ionicons
                        name={ACTIVITY_ICONS[item.type]}
                        size={16}
                        color={colors.text}
                      />
                    </View>
                    <View style={styles.attentionCopy}>
                      <Text style={styles.attentionTitle}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.attentionSub}>
                        {item.details}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t("business.activityEmpty")}</Text>
              </View>
            )}
          </FadeIn>

          <FadeIn delay={180}>
            <View style={styles.actions}>
              <QuickAction
                icon="add"
                label={t("business.addListing")}
                styles={styles}
                colors={colors}
                onPress={() => router.push("/business/new-listing")}
              />
              <QuickAction
                icon="cash-outline"
                label={t("business.withdraw")}
                styles={styles}
                colors={colors}
                onPress={() => router.push("/business/wallet")}
              />
              <QuickAction
                icon="bar-chart-outline"
                label={t("business.insights")}
                styles={styles}
                colors={colors}
                onPress={() => router.push("/business/insights")}
              />
              <QuickAction
                icon="star-outline"
                label={t("business.reviews")}
                styles={styles}
                colors={colors}
                onPress={() => router.push("/business/reviews")}
              />
            </View>
            <Pressable
              onPress={() => router.push("/business/new-listing")}
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.addBtnText}>{t("business.addListingCta")}</Text>
            </Pressable>
          </FadeIn>
        </ScrollView>
      )}
    </FeedShell>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingRight: 12,
    },
    headerCopy: {
      marginLeft: 10,
      flex: 1,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    headerName: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    bell: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.badge,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      color: colors.white,
      fontFamily: "Montserrat_700Bold",
      fontSize: 9,
      lineHeight: 12,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE + 16,
    },
    error: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.error,
      marginBottom: 12,
    },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      marginBottom: 18,
    },
    profileCopy: {
      marginLeft: 14,
      flex: 1,
    },
    profileName: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    profileCategory: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    verified: {
      marginTop: 8,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    verifiedText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.white,
    },
    unverified: {
      marginTop: 8,
      alignSelf: "flex-start",
      backgroundColor: colors.iconSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    unverifiedText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
      marginBottom: 10,
    },
    sectionTitleInline: {
      marginBottom: 0,
    },
    link: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.success,
    },
    listCard: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      marginBottom: 22,
      overflow: "hidden",
    },
    attentionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    attentionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    attentionCopy: {
      flex: 1,
      paddingRight: 8,
    },
    attentionTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.text,
    },
    attentionSub: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    revenueCard: {
      backgroundColor: colors.sheet,
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
    },
    revenueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
      marginBottom: 14,
    },
    revenueValue: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
    },
    trend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    trendUp: {
      backgroundColor: "#DCEEE3",
    },
    trendDown: {
      backgroundColor: "#FDE8E6",
    },
    trendText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 12,
      color: "#166534",
    },
    trendTextDown: {
      color: colors.error,
    },
    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 96,
    },
    barCol: {
      flex: 1,
      alignItems: "center",
    },
    barTrack: {
      height: 76,
      justifyContent: "flex-end",
    },
    bar: {
      width: 14,
      borderRadius: 6,
      backgroundColor: "#C5D4C4",
    },
    barToday: {
      backgroundColor: colors.primary,
    },
    barLabel: {
      marginTop: 6,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      color: colors.textMuted,
    },
    barLabelToday: {
      color: colors.text,
    },
    metrics: {
      flexDirection: "row",
      marginBottom: 22,
      paddingVertical: 8,
    },
    metric: {
      flex: 1,
    },
    metricDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginHorizontal: 10,
    },
    metricKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    metricValue: {
      marginTop: 6,
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
    },
    metricSub: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 11,
      color: colors.textMuted,
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    activityIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    emptyCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 22,
    },
    emptyText: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    action: {
      flex: 1,
      alignItems: "center",
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    actionLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.text,
      textAlign: "center",
    },
    addBtn: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    addBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
