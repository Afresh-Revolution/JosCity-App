import { useMemo, useCallback, useState } from "react";
import { RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import { getPoints, type PointsInfo } from "../api/account";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

function formatCbc(value?: number) {
  return Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CbcPointsScreen() {
  const s = useSettingsStyles();

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [info, setInfo] = useState<PointsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getPoints();
    if (!result.success || !result.data) {
      setError(result.message || "Could not load CBC Coin.");
      return;
    }
    setError(null);
    setInfo(result.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  if (!allowed) return null;

  const rate = info?.conversion?.points_per_cbc || 100;

  return (
    <SettingsPage
      kicker="Account"
      title="CBC Coin"
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
        {error ? <Text style={s.error}>{error}</Text> : null}
        <View style={styles.hero}>
          <Text style={styles.kicker}>CBC BALANCE</Text>
          <Text style={styles.balance}>{formatCbc(info?.cbc)}</Text>
          <Text style={s.rowMeta}>
            {Number(info?.points || 0).toLocaleString("en-NG")} coins · {rate} coins = 1 CBC Coin
          </Text>
        </View>

        <Text style={s.section}>HOW YOU EARN</Text>
        <View style={s.card}>
          {(info?.breakdown || []).map((item, index, list) => (
            <View key={item.key} style={[s.row, index === list.length - 1 && s.rowLast]}>
              <Text style={s.rowTitle}>{item.label}</Text>
              <Text style={s.rowMeta}>
                {item.count} · {item.points.toLocaleString("en-NG")} coins
              </Text>
            </View>
          ))}
        </View>
      </FadeIn>
    </SettingsPage>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  kicker: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.textMuted,
  },
  balance: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: colors.text,
  },
});
}
