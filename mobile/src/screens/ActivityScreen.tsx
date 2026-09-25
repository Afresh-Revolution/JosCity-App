import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import { getActivity, type ActivityItem } from "../api/account";
import { openRatingPrompt } from "../state/ratingPrompt";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";

function money(value?: string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `₦${amount.toLocaleString("en-NG")}`;
}

function historyState(status?: string | null): "success" | "pending" | "hidden" {
  const raw = String(status || "").trim().toLowerCase();
  if (
    [
      "rejected",
      "2",
      "failed",
      "cancelled",
      "canceled",
      "declined",
      "expired",
      "unpaid",
      "awaiting_payment",
      "void",
      "refunded",
    ].includes(raw)
  ) {
    return "hidden";
  }
  if (
    [
      "approved",
      "1",
      "paid",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "completed",
      "success",
      "successful",
    ].includes(raw)
  ) {
    return "success";
  }
  if (["pending", "0", "3", "", "awaiting_proof"].includes(raw)) return "pending";
  if (raw.includes("reject") || raw.includes("fail") || raw.includes("cancel")) return "hidden";
  if (raw.includes("await") && raw.includes("pay")) return "hidden";
  return "pending";
}

function historyLabel(status?: string | null) {
  return historyState(status) === "pending" ? "Pending" : "Successful";
}

function sourceLabel(item: ActivityItem) {
  if (item.source === "event") return "Event payment";
  if (item.source === "listing") return "Marketplace order";
  if (item.source === "marketplace") return "Marketplace order";
  return "Transaction";
}

export default function ActivityScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();

  const s = useSettingsStyles();

  const allowed = useRequirePersonalAccount();
  const { enabled, label } = useAppFeatures();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const load = useCallback(async () => {
    const result = await getActivity();
    if (!result.success) {
      setError(result.message || "Could not load activity.");
      return;
    }
    setError(null);
    setItems(result.data || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const visible = useMemo(
    () => items.filter((item) => historyState(item.status) !== "hidden"),
    [items]
  );

  if (!allowed) return null;

  return (
    <SettingsPage
      kicker="Account"
      title="Activity"
      loading={loading}
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
      <FadeIn>
        <Text style={s.section}>ORDERS & TRANSACTIONS</Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {!visible.length ? (
          <Text style={s.empty}>No successful or pending payments yet.</Text>
        ) : (
          <View style={s.card}>
            {visible.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item)}
                style={[s.row, index === visible.length - 1 && s.rowLast]}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowMeta}>
                  {[historyLabel(item.status), money(item.amount), timeAgo(item.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {item.can_rate && item.order_id ? (
                  <Pressable
                    onPress={() => openRatingPrompt(item.order_id || undefined)}
                    style={{ marginTop: 8 }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.rowTitle, { fontSize: 13 }]}>{t("rating.rateCta")}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
        {!enabled("rewards") && !enabled("cbc_points") ? (
          <Text style={s.rowMeta}>
            Rewards stay {label("rewards")} until CBC Coin launch.
          </Text>
        ) : null}
      </FadeIn>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
          onPress={() => setSelected(null)}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              marginHorizontal: 8,
              marginBottom: 12,
              borderRadius: 18,
              backgroundColor: colors.card,
              padding: 18,
            }}
          >
            <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: colors.text }}>
              {selected?.title}
            </Text>
            <Text style={{ marginTop: 6, fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textMuted }}>
              {selected ? sourceLabel(selected) : ""}
            </Text>
            <Text style={{ marginTop: 16, fontFamily: "Montserrat_700Bold", fontSize: 28, color: colors.text }}>
              {money(selected?.amount) || "—"}
            </Text>
            <Text style={{ marginTop: 12, fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>
              Status: {historyLabel(selected?.status)}
            </Text>
            <Text style={{ marginTop: 8, fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textMuted }}>
              {selected?.created_at ? timeAgo(selected.created_at) : ""}
            </Text>
            {selected?.can_rate && selected.order_id ? (
              <Pressable
                onPress={() => {
                  const orderId = selected.order_id;
                  setSelected(null);
                  openRatingPrompt(orderId || undefined);
                }}
                style={{ marginTop: 16, minHeight: 44, justifyContent: "center" }}
                accessibilityRole="button"
              >
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.primary }}>
                  {t("rating.rateCta")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setSelected(null)}
              style={{ marginTop: 8, minHeight: 40, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.textMuted }}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SettingsPage>
  );
}
