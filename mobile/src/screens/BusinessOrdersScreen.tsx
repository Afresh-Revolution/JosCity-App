import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Modal,
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
import { ErrorBanner, showNotice } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
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
import { openMemberProfile } from "../utils/openProfile";

function statusLabel(status: string, t: (key: string) => string) {
  const key = `orders.status.${status}` as "orders.status.pending";
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

function paymentLabel(provider: string | null | undefined, t: (key: string) => string) {
  const raw = String(provider || "").toLowerCase();
  if (!raw) return "";
  if (raw.includes("cbc")) return t("orders.payCbc");
  if (raw.includes("wallet")) return t("orders.payWallet");
  if (raw.includes("paystack")) return "Paystack";
  if (raw.includes("safehaven") || raw.includes("safe")) return "Safe Haven";
  if (raw.includes("manual") || raw === "bank") return t("orders.payBank");
  return provider || "";
}

function formatOrderWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return timeAgoLong(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${hours}:${minutes}`;
}

function accountName(order: SellerOrder) {
  return String(order.buyer_account_name || order.buyer_name || "").trim() || "JosCity member";
}

export default function BusinessOrdersScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [awaiting, setAwaiting] = useState<SellerOrder[]>([]);
  const [recent, setRecent] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<SellerOrder | null>(null);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const data = await getBusinessOrders();
        setAwaiting(data.awaiting);
        setRecent(data.recent);
        setSelected((current) => {
          if (!current) return null;
          return (
            data.awaiting.find((row) => row.id === current.id) ||
            data.recent.find((row) => row.id === current.id) ||
            current
          );
        });
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
    setFulfillError(null);
    try {
      const result = await fulfillBusinessOrder(order.id);
      if (!result.success) {
        setFulfillError(result.message || t("orders.fulfillError"));
        return;
      }
      setSelected(null);
      showNotice({
        title: result.message || t("orders.marked"),
        message: t("orders.buyerCanRate"),
        tone: "success",
      });
      void load("refresh");
    } catch {
      setFulfillError(t("orders.fulfillError"));
    } finally {
      setBusyId(null);
    }
  };

  const openAccount = (order: SellerOrder) => {
    if (!order.buyer_user_id) return;
    setSelected(null);
    openMemberProfile(router, order.buyer_user_id, order.buyer_account_type, "push", {
      name: accountName(order),
      picture: order.buyer_picture,
    });
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
                active={selected?.id === order.id}
                onOpen={() => {
                  setFulfillError(null);
                  setSelected(order);
                }}
              />
            ))
          ) : (
            <Text style={styles.empty}>{t("orders.awaitingEmpty")}</Text>
          )}

          <Text style={[styles.section, styles.sectionLater]}>{t("orders.recent")}</Text>
          {recent.length ? (
            recent.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                styles={styles}
                t={t}
                active={selected?.id === order.id}
                onOpen={() => {
                  setFulfillError(null);
                  setSelected(order);
                }}
              />
            ))
          ) : (
            <Text style={styles.empty}>{t("orders.recentEmpty")}</Text>
          )}
        </ScrollView>
      )}

      <OrderDetailSheet
        order={selected}
        styles={styles}
        t={t}
        busy={selected ? busyId === selected.id : false}
        error={fulfillError}
        onClose={() => {
          setFulfillError(null);
          setSelected(null);
        }}
        onFulfill={selected?.can_fulfill ? () => void onFulfill(selected) : undefined}
        onOpenAccount={() => selected && openAccount(selected)}
      />
    </FeedShell>
  );
}

function OrderCard({
  order,
  styles,
  t,
  active,
  onOpen,
}: {
  order: SellerOrder;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  active?: boolean;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, (pressed || active) && styles.cardActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={`${order.code}, ${order.title}`}
      accessibilityHint={t("orders.openHint")}
    >
      <Text style={styles.code}>{order.code}</Text>
      <Text style={styles.itemTitle}>{order.title}</Text>
      <Text style={styles.meta}>
        {order.buyer_name} · {formatNaira(order.total_naira)} · {timeAgoLong(order.created_at)}
      </Text>
      <Text style={styles.status}>{statusLabel(order.status, t)}</Text>
    </Pressable>
  );
}

function OrderDetailSheet({
  order,
  styles,
  t,
  busy,
  error,
  onClose,
  onFulfill,
  onOpenAccount,
}: {
  order: SellerOrder | null;
  styles: ReturnType<typeof makeStyles>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onFulfill?: () => void;
  onOpenAccount: () => void;
}) {
  const { colors } = useTheme();
  const items = order?.items?.length ? order.items : order ? [{ title: order.title, quantity: 1, unit_price_naira: order.total_naira }] : [];
  const paidWith = order ? paymentLabel(order.payment_provider, t) : "";
  const canOpenAccount = Boolean(order?.buyer_user_id);

  return (
    <Modal visible={Boolean(order)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={styles.modalKicker}>{order?.code}</Text>
            <Text style={styles.modalTitle}>{t("orders.detailTitle")}</Text>
            <Text style={styles.modalAmount}>{formatNaira(order?.total_naira)}</Text>
            <Text style={styles.status}>{statusLabel(order?.status || "", t)}</Text>

            {order ? (
              <Pressable
                onPress={canOpenAccount ? onOpenAccount : undefined}
                disabled={!canOpenAccount}
                style={({ pressed }) => [
                  styles.accountRow,
                  canOpenAccount && pressed && styles.pressed,
                ]}
                accessibilityRole={canOpenAccount ? "button" : undefined}
                accessibilityLabel={`${t("orders.account")}, ${accountName(order)}`}
              >
                <AvatarCircle name={accountName(order)} uri={order.buyer_picture} size={44} />
                <View style={styles.accountCopy}>
                  <Text style={styles.accountKicker}>{t("orders.account")}</Text>
                  <Text style={styles.accountName}>{accountName(order)}</Text>
                  {canOpenAccount ? (
                    <Text style={styles.accountHint}>{t("orders.viewAccount")}</Text>
                  ) : null}
                </View>
                {canOpenAccount ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            ) : null}

            {items.length ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>{t("orders.items")}</Text>
                {items.map((item, index) => (
                  <View key={`${item.listing_id || item.title}-${index}`} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {item.quantity > 1 ? `${item.quantity} × ${item.title}` : item.title}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {formatNaira(item.unit_price_naira * Math.max(1, item.quantity || 1))}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <DetailLine
              styles={styles}
              label={t("orders.phone")}
              value={order?.buyer_phone}
              onPress={
                order?.buyer_phone
                  ? () => void Linking.openURL(`tel:${order.buyer_phone}`)
                  : undefined
              }
            />
            <DetailLine
              styles={styles}
              label={t("orders.email")}
              value={order?.buyer_email}
              onPress={
                order?.buyer_email
                  ? () => void Linking.openURL(`mailto:${order.buyer_email}`)
                  : undefined
              }
            />
            <DetailLine styles={styles} label={t("orders.delivery")} value={order?.buyer_address} />
            <DetailLine styles={styles} label={t("orders.notes")} value={order?.buyer_notes} />
            <DetailLine styles={styles} label={t("orders.placed")} value={formatOrderWhen(order?.created_at)} />
            <DetailLine
              styles={styles}
              label={t("orders.fulfilled")}
              value={formatOrderWhen(order?.fulfilled_at)}
            />
            <DetailLine styles={styles} label={t("orders.payment")} value={paidWith} />

            {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} /></View> : null}

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
                    {order?.listing_kind === "service"
                      ? t("orders.markCompleted")
                      : t("orders.markDelivered")}
                  </Text>
                )}
              </Pressable>
            ) : null}

            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
              <Text style={styles.closeText}>{t("common.close")}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailLine({
  styles,
  label,
  value,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value?: string | null;
  onPress?: () => void;
}) {
  if (!value) return null;
  const body = (
    <>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress ? styles.detailLink : null]}>{value}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.detailRow} accessibilityRole="link">
        {body}
      </Pressable>
    );
  }
  return <View style={styles.detailRow}>{body}</View>;
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
    cardActive: {
      backgroundColor: "rgba(29, 155, 240, 0.16)",
      borderColor: colors.verified,
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalCard: {
      marginHorizontal: 8,
      marginBottom: 12,
      maxHeight: "86%",
      borderRadius: 18,
      backgroundColor: colors.card,
      padding: 18,
    },
    modalKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
    },
    modalTitle: {
      marginTop: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    modalAmount: {
      marginTop: 10,
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
    },
    accountRow: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 12,
    },
    accountCopy: {
      flex: 1,
    },
    accountKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    accountName: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    accountHint: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.primary,
    },
    block: {
      marginTop: 16,
    },
    blockLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 6,
    },
    itemName: {
      flex: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    itemPrice: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    detailRow: {
      marginTop: 12,
    },
    detailLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
    },
    detailValue: {
      marginTop: 4,
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.text,
    },
    detailLink: {
      color: colors.primary,
    },
    closeBtn: {
      marginTop: 8,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    closeText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
