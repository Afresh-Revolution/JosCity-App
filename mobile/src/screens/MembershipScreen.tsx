import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import {
  getMembership,
  subscribeMembership,
  type MembershipInfo,
} from "../api/account";
import { formatMembershipAmount, type MembershipPlanItem } from "../api/membership";
import { useMembershipSettings } from "../hooks/useMembershipSettings";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const BILLING_COPY = "Billed monthly · pause or cancel anytime";
const STORE_DIGITAL_IAP_REQUIRED =
  Platform.OS === "ios" || Platform.OS === "android";

function featuresFor(item: MembershipPlanItem): string[] {
  if (Array.isArray(item.features) && item.features.length) {
    return item.features.map((line) => String(line).trim()).filter(Boolean);
  }
  return String(item.description || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);
}

function packageTitle(item: MembershipPlanItem, index: number) {
  const title = String(item.title || "").trim();
  if (title) return title;
  return `Membership Package${index > 0 ? ` ${index + 1}` : ""}`;
}

export default function MembershipScreen() {
  const s = useSettingsStyles();

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { personalEnabled, personalPlan, ready } = useMembershipSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [info, setInfo] = useState<MembershipInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getMembership();
    if (result.success && result.data) {
      setError(null);
      setInfo(result.data);
      return;
    }
    setError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      if (!ready) return;
      if (!personalEnabled) {
        router.replace("/profile");
        return;
      }
      void load().finally(() => setLoading(false));
    }, [allowed, load, personalEnabled, ready, router])
  );

  const packages: MembershipPlanItem[] = useMemo(() => {
    if (info?.packages?.length) return info.packages;
    if (info?.items?.length) return info.items;
    if (personalPlan.items?.length) return personalPlan.items;
    return [];
  }, [info, personalPlan.items]);

  const visiblePackages = packages.filter(
    (item) =>
      Number(item.amount || 0) > 0 ||
      String(item.title || "").trim() ||
      String(item.description || "").trim()
  );

  if (!allowed || (ready && !personalEnabled)) return null;

  const current = info?.current || null;
  const memberId = info?.member_id || "";
  const billingCopy = info?.billing_copy || BILLING_COPY;

  const copyId = async () => {
    if (!memberId) {
      Alert.alert("Membership ID", "Your member ID is not available yet.");
      return;
    }
    await Clipboard.setStringAsync(memberId);
    Alert.alert("Membership ID", memberId, [
      { text: "Close", style: "cancel" },
      { text: "Copy ID", onPress: () => void Clipboard.setStringAsync(memberId) },
    ]);
  };

  const onSubscribe = async (item: MembershipPlanItem, renewing: boolean) => {
    const id = String(item.id || "");
    if (!id) return;
    setSubscribingId(id);
    const result = await subscribeMembership(id);
    setSubscribingId(null);
    if (!result.success) {
      Alert.alert(renewing ? "Could not renew" : "Could not subscribe", result.message || "Try again.");
      return;
    }
    if (result.data?.current) {
      setInfo((currentInfo) =>
        currentInfo ? { ...currentInfo, current: result.data?.current || currentInfo.current } : currentInfo
      );
    }
    await load();
  };

  return (
    <SettingsPage
      kicker="Your plan & packages"
      title="Membership"
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

        {current ? (
          <>
            <View style={styles.currentCard}>
              <Text style={styles.currentKicker}>CURRENT MEMBERSHIP</Text>
              <Text style={styles.currentTitle}>{current.title}</Text>
              <Text style={styles.currentMeta}>
                {formatMembershipAmount(current)} monthly
                {current.renews_at ? ` · renews ${current.renews_at}` : ""}
              </Text>
              <Pressable
                onPress={() => void copyId()}
                style={({ pressed }) => [styles.idBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Membership ID"
              >
                <Ionicons name="qr-code-outline" size={16} color={colors.white} />
                <Text style={styles.idBtnText}>Membership ID</Text>
              </Pressable>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{current.status || "ACTIVE"}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Billing</Text>
                <Text style={styles.detailValue}>{current.billing || "Billed monthly"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Member ID</Text>
                <Text style={styles.detailValue}>{memberId || "—"}</Text>
              </View>
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Renews</Text>
                <Text style={styles.detailValue}>{current.renews_at || "—"}</Text>
              </View>
            </View>

            <Text style={styles.packagesHeading}>Packages</Text>
          </>
        ) : null}

        {visiblePackages.map((item, index) => {
          const id = String(item.id || `${index}`);
          const isCurrent = Boolean(current && current.package_id === id);
          const perkList = featuresFor(item);
          const busy = subscribingId === id;
          return (
            <View
              key={id}
              style={[styles.packageCard, isCurrent && styles.packageCardCurrent]}
            >
              <View style={styles.packageTitleRow}>
                <Text style={styles.packageTitle}>{packageTitle(item, index)}</Text>
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <View style={styles.currentDot} />
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.packagePrice}>{formatMembershipAmount(item)}</Text>
              <Text style={styles.packageBilling}>{billingCopy}</Text>
              {perkList.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
              {STORE_DIGITAL_IAP_REQUIRED ? (
                <Text style={styles.iosNote}>
                  {isCurrent
                    ? "In-app renewal is not available in the mobile app."
                    : "In-app purchase is not available in the mobile app."}
                </Text>
              ) : isCurrent ? (
                <Pressable
                  onPress={() => void onSubscribe(item, true)}
                  disabled={busy}
                  style={({ pressed }) => [styles.renewBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Renew this package"
                >
                  <Text style={styles.renewBtnText}>
                    {busy ? "Renewing..." : "Renew this package"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void onSubscribe(item, false)}
                  disabled={busy}
                  style={({ pressed }) => [styles.subscribeBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Subscribe"
                >
                  <Text style={styles.subscribeBtnText}>
                    {busy ? "Please wait..." : "Subscribe"}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {!visiblePackages.length ? (
          <Text style={s.empty}>No membership packages have been published yet.</Text>
        ) : null}

        <Text style={styles.footnote}>
          {STORE_DIGITAL_IAP_REQUIRED
            ? "Apple and Google require their own in-app billing for digital memberships. Status of an existing membership still appears here. Marketplace checkout for physical goods and local services is unchanged."
            : "Membership payments are taken from your JOSCITY wallet. Package features are exactly as published by JOSCITY."}
        </Text>
        {STORE_DIGITAL_IAP_REQUIRED ? null : (
          <Pressable
            onPress={() => router.push("/profile/wallet")}
            style={({ pressed }) => [styles.walletBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to wallet"
          >
            <Text style={styles.walletBtnText}>Back to wallet</Text>
          </Pressable>
        )}
      </FadeIn>
    </SettingsPage>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  currentCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  currentKicker: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.navActive,
  },
  currentTitle: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.white,
  },
  currentMeta: {
    marginTop: 6,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.navActive,
  },
  idBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#164d30",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idBtnText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.white,
  },
  detailCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  detailRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: colors.navActive,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  packagesHeading: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
    marginBottom: 12,
  },
  packageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    backgroundColor: colors.background,
  },
  packageCardCurrent: {
    borderColor: colors.success,
  },
  packageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  packageTitle: {
    flex: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 17,
    color: colors.text,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.navActive,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  currentBadgeText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  packagePrice: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: colors.text,
  },
  packageBilling: {
    marginTop: 4,
    marginBottom: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  perkText: {
    flex: 1,
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: colors.text,
  },
  subscribeBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeBtnText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.white,
  },
  renewBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0DCD3",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  renewBtnText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  footnote: {
    marginTop: 8,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  iosNote: {
    marginTop: 10,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  walletBtn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0DCD3",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  walletBtnText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  pressed: {
    opacity: 0.72,
  },
});
}
