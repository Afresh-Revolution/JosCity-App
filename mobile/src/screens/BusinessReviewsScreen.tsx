import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  getBusinessReviews,
  replyToBusinessReview,
  type BusinessReviewFilter,
  type BusinessReviewItem,
  type BusinessReviewsPage,
} from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { reviewWhen } from "../utils/format";
import { openMemberProfile } from "../utils/openProfile";

const STAR_GOLD = "#E8B923";
const BAR_GREEN = "#3D8C4A";
const FILTERS: BusinessReviewFilter[] = ["all", "needs_reply", "high", "low"];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= filled ? "star" : "star-outline"}
          size={size}
          color={STAR_GOLD}
        />
      ))}
    </View>
  );
}

export default function BusinessReviewsScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [filter, setFilter] = useState<BusinessReviewFilter>("all");
  const [data, setData] = useState<BusinessReviewsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(
    async (nextFilter: BusinessReviewFilter, mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const page = await getBusinessReviews(nextFilter);
        setData(page);
        setError(null);
      } catch {
        setError(t("reviews.loadError"));
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
      void load(filter);
    }, [allowed, filter, load])
  );

  const onReply = async (item: BusinessReviewItem) => {
    const text = replyDraft.trim();
    if (!text) {
      showError(t("reviews.replyRequired"));
      return;
    }
    setSavingId(item.id);
    const result = await replyToBusinessReview(item.id, text);
    setSavingId(null);
    if (!result.success) {
      showError(result.message || t("reviews.replyError"));
      return;
    }
    showNotice({ title: t("reviews.replySaved"), tone: "success" });
    setReplyingId(null);
    setReplyDraft("");
    void load(filter, "refresh");
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  const summary = data?.summary;
  const maxBar = Math.max(1, ...(summary?.stars.map((row) => row.count) || [1]));
  const count = summary?.count || 0;

  return (
    <FeedShell tab="profile" header={<View />}>
      {loading && !data ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(filter, "refresh")} />
          }
        >
          {error ? <ErrorBanner message={error} /> : null}

          <FadeIn>
            <Text style={styles.kicker}>
              {t("reviews.countLabel", { count })}
            </Text>
            <Text style={styles.title}>{t("business.reviews")}</Text>
          </FadeIn>

          <FadeIn delay={50}>
            <View style={styles.summary}>
              <View style={styles.scoreCol}>
                <Text style={styles.score}>{count ? summary?.average.toFixed(1) : "—"}</Text>
                <Stars value={summary?.average || 0} size={16} />
                <Text style={styles.scoreMeta}>
                  {t("reviews.countCaps", { count })}
                </Text>
              </View>
              <View style={styles.bars}>
                {(summary?.stars || []).map((row) => (
                  <View key={row.stars} style={styles.barRow}>
                    <Text style={styles.barLabel}>{row.stars} star</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(row.count ? 6 : 0, Math.round((row.count / maxBar) * 100))}%`,
                            opacity: row.stars >= 4 ? 1 : 0.55,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{row.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((key) => {
                const active = filter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>
                      {t(`reviews.filter.${key}` as "reviews.filter.all")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </FadeIn>

          {data?.items.length ? (
            data.items.map((item, index) => (
              <FadeIn key={item.id} delay={Math.min(90 + index * 30, 180)}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Pressable
                      onPress={() => {
                        if (item.reviewer_user_id) {
                          openMemberProfile(router, item.reviewer_user_id);
                        }
                      }}
                      style={styles.cardCopy}
                    >
                      <Text style={styles.reviewer}>{item.reviewer_name}</Text>
                      <Text style={styles.when}>{reviewWhen(item.created_at)}</Text>
                    </Pressable>
                    <Stars value={item.rating} />
                  </View>
                  {item.listing_title ? (
                    <Text style={styles.listing}>{item.listing_title}</Text>
                  ) : null}
                  {item.comment ? <Text selectable style={styles.comment}>{item.comment}</Text> : null}
                  {item.reply_text ? (
                    <View style={styles.replyBox}>
                      <Text style={styles.replyLabel}>{t("reviews.yourReply")}</Text>
                      <Text selectable style={styles.replyText}>{item.reply_text}</Text>
                    </View>
                  ) : replyingId === item.id ? (
                    <View style={styles.replyEditor}>
                      <TextInput
                        value={replyDraft}
                        onChangeText={setReplyDraft}
                        placeholder={t("reviews.replyPlaceholder")}
                        placeholderTextColor={colors.textMuted}
                        multiline
                        autoFocus
                        style={styles.replyInput}
                      />
                      <View style={styles.replyActions}>
                        <Pressable
                          onPress={() => {
                            setReplyingId(null);
                            setReplyDraft("");
                          }}
                        >
                          <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void onReply(item)}
                          disabled={savingId === item.id}
                          style={styles.sendReply}
                        >
                          {savingId === item.id ? (
                            <JosCityLoader color={colors.white} size="small" />
                          ) : (
                            <Text style={styles.sendReplyText}>{t("reviews.sendReply")}</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setReplyingId(item.id);
                        setReplyDraft("");
                      }}
                      style={styles.replyBtn}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                      <Text style={styles.replyBtnText}>{t("reviews.reply")}</Text>
                    </Pressable>
                  )}
                </View>
              </FadeIn>
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("reviews.empty")}</Text>
            </View>
          )}

          <FadeIn delay={120}>
            <View style={styles.tip}>
              <Ionicons name="star" size={18} color={STAR_GOLD} />
              <Text style={styles.tipText}>{t("reviews.tip")}</Text>
            </View>
          </FadeIn>
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
    content: {
      paddingHorizontal: 20,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 34,
      color: colors.text,
      marginBottom: 18,
    },
    summary: {
      flexDirection: "row",
      gap: 18,
      marginBottom: 18,
    },
    scoreCol: {
      width: 92,
      alignItems: "flex-start",
    },
    score: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 40,
      color: colors.text,
      lineHeight: 44,
    },
    scoreMeta: {
      marginTop: 8,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    bars: {
      flex: 1,
      justifyContent: "center",
      gap: 6,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    barLabel: {
      width: 48,
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
    },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.cream,
      overflow: "hidden",
    },
    barFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: BAR_GREEN,
    },
    barCount: {
      width: 22,
      textAlign: "right",
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
    },
    filters: {
      gap: 8,
      paddingBottom: 16,
    },
    chip: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.card,
    },
    chipOn: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    chipTextOn: {
      color: colors.white,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    cardCopy: {
      flex: 1,
    },
    reviewer: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    when: {
      marginTop: 2,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    listing: {
      marginTop: 8,
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
    },
    comment: {
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    replyBtn: {
      marginTop: 14,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    replyBtnText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.primary,
    },
    replyBox: {
      marginTop: 14,
      borderRadius: 14,
      backgroundColor: colors.cream,
      padding: 12,
    },
    replyLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
      marginBottom: 4,
    },
    replyText: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    replyEditor: {
      marginTop: 14,
    },
    replyInput: {
      minHeight: 72,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 12,
      paddingTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.text,
      textAlignVertical: "top",
    },
    replyActions: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 14,
    },
    cancelText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
    },
    sendReply: {
      borderRadius: 16,
      backgroundColor: colors.brand,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 72,
      alignItems: "center",
    },
    sendReplyText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.white,
    },
    empty: {
      borderRadius: 18,
      backgroundColor: colors.cream,
      padding: 20,
      marginBottom: 12,
    },
    emptyText: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    tip: {
      marginTop: 8,
      flexDirection: "row",
      gap: 10,
      borderRadius: 18,
      backgroundColor: colors.cream,
      padding: 16,
      alignItems: "flex-start",
    },
    tipText: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: colors.text,
    },
  });
}
