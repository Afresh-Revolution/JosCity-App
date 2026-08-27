import { useCallback, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
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
        {!items.length ? (
          <Text style={s.empty}>No orders or payments yet.</Text>
        ) : (
          <View style={s.card}>
            {items.map((item, index) => (
              <View key={item.id} style={[s.row, index === items.length - 1 && s.rowLast]}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowMeta}>
                  {[item.status, money(item.amount), timeAgo(item.created_at)].filter(Boolean).join(" · ")}
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
              </View>
            ))}
          </View>
        )}
        {!enabled("rewards") && !enabled("cbc_points") ? (
          <Text style={s.rowMeta}>
            Rewards stay {label("rewards")} until CBC points launch.
          </Text>
        ) : null}
      </FadeIn>
    </SettingsPage>
  );
}
