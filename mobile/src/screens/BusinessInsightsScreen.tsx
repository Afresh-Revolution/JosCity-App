import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  getBusinessInsights,
  type BusinessInsights,
  type InsightsPeriodDays,
  type InsightsTrafficKey,
} from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira } from "../utils/format";

const PERIODS: InsightsPeriodDays[] = [7, 30, 90];

const TRAFFIC_LABELS: Record<InsightsTrafficKey, string> = {
  discover: "insights.traffic.discover",
  marketplace: "insights.traffic.marketplace",
  direct: "insights.traffic.direct",
  feed: "insights.traffic.feed",
};

function signedDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString("en-NG")}`;
  if (value < 0) return value.toLocaleString("en-NG");
  return "0";
}

function signedPercent(value: number): string {
  const n = Number(value || 0);
  if (n > 0) return `+${n.toFixed(1)}%`;
  if (n < 0) return `${n.toFixed(1)}%`;
  return "0.0%";
}

export default function BusinessInsightsScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [days, setDays] = useState<InsightsPeriodDays>(30);
  const [data, setData] = useState<BusinessInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (period: InsightsPeriodDays, mode: "replace" | "refresh" | "period" = "replace") => {
      const id = ++requestId.current;
      if (mode === "refresh" || mode === "period") setRefreshing(true);
      try {
        const next = await getBusinessInsights(period);
        if (id !== requestId.current) return;
        setData(next);
        setError(null);
      } catch {
        if (id !== requestId.current) return;
        setError(t("insights.loadError"));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load(days, requestId.current === 0 ? "replace" : "refresh");
    }, [allowed, days, load])
  );

  const snapshot = data;
  const trendUp = (snapshot?.revenue.change_percent || 0) >= 0;
  const ordersUp = (snapshot?.orders.delta || 0) >= 0;
  const maxBar = Math.max(1, ...(snapshot?.revenue.days.map((day) => day.amount) || [1]));
  const nextText = snapshot?.next_step?.text || "";

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab="profile" header={<View />}>
      {loading && !snapshot ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(days, "refresh")} />
          }
        >
          {error ? <ErrorBanner message={error} /> : null}

          <FadeIn>
            <Text style={styles.kicker}>{t("insights.kicker")}</Text>
            <Text style={styles.title}>{t("insights.title")}</Text>
            <View style={styles.periodTrack}>
              {PERIODS.map((period) => {
                const active = period === days;
                return (
                  <Pressable
                    key={period}
                    onPress={() => {
                      if (period === days) return;
                      setDays(period);
                    }}
                    style={[styles.periodChip, active && styles.periodChipActive]}
                  >
                    <Text style={[styles.periodText, active && styles.periodTextActive]}>
                      {t(`insights.days${period}` as "insights.days7")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          <FadeIn delay={70}>
            <View style={styles.revenueCard}>
              <Text style={styles.metricKicker}>{t("insights.revenueTrend")}</Text>
              <Text style={styles.revenueValue}>{formatNaira(snapshot?.revenue.total || 0)}</Text>
              <Text style={[styles.trendLine, !trendUp && styles.trendDown]}>
                {t("insights.vsPeriod", {
                  value: signedPercent(snapshot?.revenue.change_percent || 0),
                  days,
                })}
              </Text>
              <View style={styles.chart}>
                {(snapshot?.revenue.days || []).map((day) => (
                  <View key={day.key} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          day.is_today && styles.barToday,
                          { height: Math.max(8, Math.round((day.amount / maxBar) * 84)) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, day.is_today && styles.barLabelToday]}>
                      {day.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.note}>{t("insights.releasedNote")}</Text>
            </View>
          </FadeIn>

          <FadeIn delay={110}>
            <View style={styles.grid}>
              <MetricCard
                icon="bag-handle-outline"
                label={t("insights.orders")}
                value={String(snapshot?.orders.count ?? 0)}
                sub={t("insights.vsPeriod", {
                  value: signedDelta(snapshot?.orders.delta || 0),
                  days,
                })}
                up={ordersUp}
                styles={styles}
                colors={colors}
              />
              <MetricCard
                icon="eye-outline"
                label={t("insights.listingViews")}
                value={Number(snapshot?.listing_views.count || 0).toLocaleString("en-NG")}
                sub={t("insights.thisWeek", {
                  count: Number(snapshot?.listing_views.week_count || 0).toLocaleString("en-NG"),
                })}
                up
                styles={styles}
                colors={colors}
              />
              <MetricCard
                icon="people-outline"
                label={t("insights.customers")}
                value={String(snapshot?.customers.count ?? 0)}
                sub={t("insights.repeatBuyers", {
                  count: snapshot?.customers.repeat_buyers ?? 0,
                })}
                muted
                styles={styles}
                colors={colors}
              />
              <MetricCard
                icon="trending-up-outline"
                label={t("insights.conversion")}
                value={`${Number(snapshot?.conversion.percent || 0).toFixed(1)}%`}
                sub={t("insights.conversionHint")}
                accent
                styles={styles}
                colors={colors}
              />
            </View>
          </FadeIn>

          <FadeIn delay={150}>
            <Text style={styles.sectionTitle}>{t("insights.bestListings")}</Text>
            {snapshot?.listings.length ? (
              <View style={styles.listCard}>
                {snapshot.listings.map((listing) => (
                  <View key={listing.id} style={styles.listingRow}>
                    <View style={styles.listingHead}>
                      <Text style={styles.listingTitle}>{listing.title}</Text>
                      <Text style={styles.listingMeta}>
                        {t("insights.listingMeta", {
                          views: Number(listing.views || 0).toLocaleString("en-NG"),
                          orders: listing.orders,
                        })}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(Math.min(1, listing.progress || 0) * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t("insights.listingsEmpty")}</Text>
              </View>
            )}
          </FadeIn>

          <FadeIn delay={180}>
            <Text style={styles.sectionTitle}>{t("insights.trafficTitle")}</Text>
            <View style={styles.listCard}>
              {(snapshot?.traffic || []).map((row) => (
                <View key={row.key} style={styles.trafficRow}>
                  <View style={styles.trafficHead}>
                    <Text style={styles.trafficLabel}>
                      {t(TRAFFIC_LABELS[row.key] || "insights.traffic.direct")}
                    </Text>
                    <Text style={styles.trafficPercent}>{row.percent}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(row.percent > 0 ? 6 : 0, row.percent)}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </FadeIn>

          {nextText ? (
            <FadeIn delay={210}>
              <Text style={styles.sectionTitle}>{t("insights.nextTitle")}</Text>
              <View style={styles.adviceCard}>
                <Text style={styles.adviceText}>{nextText}</Text>
              </View>
            </FadeIn>
          ) : null}
        </ScrollView>
      )}
    </FeedShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  up = true,
  muted = false,
  accent = false,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  up?: boolean;
  muted?: boolean;
  accent?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricKicker}>{label}</Text>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text
        style={[
          styles.metricSub,
          muted && styles.metricSubMuted,
          accent && styles.metricSubAccent,
          !muted && !accent && !up && styles.trendDown,
        ]}
      >
        {sub}
      </Text>
    </View>
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
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    kicker: {
      marginTop: 8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 34,
      color: colors.text,
    },
    periodTrack: {
      flexDirection: "row",
      backgroundColor: colors.sheet,
      borderRadius: 14,
      padding: 4,
      marginTop: 16,
      marginBottom: 18,
    },
    periodChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 11,
    },
    periodChipActive: {
      backgroundColor: colors.card,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    periodText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    periodTextActive: {
      fontFamily: "Montserrat_700Bold",
      color: colors.text,
    },
    revenueCard: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    metricKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      letterSpacing: 0.7,
      color: colors.textMuted,
    },
    revenueValue: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 32,
      color: colors.text,
    },
    trendLine: {
      marginTop: 4,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: "#166534",
    },
    trendDown: {
      color: colors.error,
    },
    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 112,
      marginTop: 16,
    },
    barCol: {
      flex: 1,
      alignItems: "center",
    },
    barTrack: {
      height: 88,
      justifyContent: "flex-end",
    },
    bar: {
      width: 16,
      borderRadius: 6,
      backgroundColor: "#C5D4C4",
    },
    barToday: {
      backgroundColor: colors.primary,
    },
    barLabel: {
      marginTop: 8,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.textMuted,
    },
    barLabelToday: {
      color: colors.text,
    },
    note: {
      marginTop: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 8,
    },
    metricCard: {
      width: "47.8%",
      flexGrow: 1,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
    },
    metricTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    metricValue: {
      marginTop: 10,
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      color: colors.text,
    },
    metricSub: {
      marginTop: 4,
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: "#166534",
    },
    metricSubMuted: {
      color: colors.textMuted,
      fontFamily: "Montserrat_400Regular",
    },
    metricSubAccent: {
      color: colors.success,
    },
    sectionTitle: {
      marginTop: 18,
      marginBottom: 10,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    listCard: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    listingRow: {
      paddingVertical: 12,
    },
    listingHead: {
      marginBottom: 8,
    },
    listingTitle: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    listingMeta: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.sheet,
      overflow: "hidden",
    },
    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.success,
    },
    emptyCard: {
      backgroundColor: colors.sheet,
      borderRadius: 16,
      padding: 16,
    },
    emptyText: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    trafficRow: {
      paddingVertical: 12,
    },
    trafficHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    trafficLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.text,
    },
    trafficPercent: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
    },
    adviceCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 8,
    },
    adviceText: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 21,
      color: colors.text,
    },
  });
}
