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
import { useFocusEffect } from "expo-router";
import FadeIn from "../components/FadeIn";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  fulfillBusinessOrder,
  getBusinessOrders,
  type SellerOrder,
} from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira, timeAgoLong } from "../utils/format";

function statusLabel(status: string, t: (key: string) => string) {
  const key = `orders.status.${status}` as "orders.status.pending";
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

export default function BusinessOrdersScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [awaiting, setAwaiting] = useState<SellerOrder[]>([]);
  const [recent, setRecent] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    async (mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const data = await getBusinessOrders();
        setAwaiting(data.awaiting);
        setRecent(data.recent);
        setError(null);
      } catch {
        setError(t("orders.loadError"));
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

  const onFulfill = async (order: SellerOrder) => {
    setBusyId(order.id);
    const result = await fulfillBusinessOrder(order.id);
    setBusyId(null);
    if (!result.success) {
      showError(result.message || t("orders.fulfillError"));
      return;
    }
    showNotice({
      title: result.message || t("orders.marked"),
      message: t("orders.buyerCanRate"),
      tone: "success",
    });
    void load("refresh");
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab="manage" header={<View />}>
      {loading && !awaiting.length && !recent.length ? (
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
          {error ? <ErrorBanner message={error} /> : null}
          <FadeIn>
            <Text style={styles.kicker}>{t("orders.kicker")}</Text>
            <Text style={styles.title}>{t("business.manageOrders")}</Text>
            <Text style={styles.intro}>{t("orders.intro")}</Text>
          </FadeIn>

          <Text style={styles.section}>{t("orders.awaiting")}</Text>
          {awaiting.length ? (
            awaiting.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                styles={styles}
                t={t}
                busy={busyId === order.id}
                onFulfill={() => void onFulfill(order)}
              />
            ))
          ) : (
            <Text style={styles.empty}>{t("orders.awaitingEmpty")}</Text>
          )}

          <Text style={[styles.section, styles.sectionLater]}>{t("orders.recent")}</Text>
          {recent.length ? (
            recent.map((order) => (
              <OrderCard key={order.id} order={order} styles={styles} t={t} />
            ))
          ) : (
            <Text style={styles.empty}>{t("orders.recentEmpty")}</Text>
          )}
        </ScrollView>
      )}
    </FeedShell>
  );
}

function OrderCard({
  order,
  styles,
  t,
  busy,
  onFulfill,
}: {
  order: SellerOrder;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  busy?: boolean;
  onFulfill?: () => void;
}) {
  const service = order.listing_kind === "service";
  return (
    <View style={styles.card}>
      <Text style={styles.code}>{order.code}</Text>
      <Text style={styles.itemTitle}>{order.title}</Text>
      <Text style={styles.meta}>
        {order.buyer_name} · {formatNaira(order.total_naira)} · {timeAgoLong(order.created_at)}
      </Text>
      <Text style={styles.status}>{statusLabel(order.status, t)}</Text>
      {onFulfill ? (
        <Pressable
          onPress={onFulfill}
          disabled={busy}
          style={({ pressed }) => [styles.fulfill, pressed && styles.pressed]}
        >
          {busy ? (
            <JosCityLoader color="#FFFFFF" />
          ) : (
            <Text style={styles.fulfillText}>
              {service ? t("orders.markCompleted") : t("orders.markDelivered")}
            </Text>
          )}
        </Pressable>
      ) : null}
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
    },
    intro: {
      marginTop: 8,
      marginBottom: 20,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    section: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      letterSpacing: 0.6,
      color: colors.textMuted,
      marginBottom: 10,
    },
    sectionLater: {
      marginTop: 18,
    },
    empty: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    code: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
    },
    itemTitle: {
      marginTop: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    meta: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    status: {
      marginTop: 8,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.primary,
      textTransform: "capitalize",
    },
    fulfill: {
      marginTop: 12,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    fulfillText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.white,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
