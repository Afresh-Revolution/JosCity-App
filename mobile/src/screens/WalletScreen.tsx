import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import SoonBadge from "../components/SoonBadge";
import TextField from "../components/TextField";
import {
  getMembership,
  getPoints,
  getWallet,
  lookupWalletMember,
  shareWallet,
  startPaystackFunding,
  startSafehavenFunding,
  submitManualFunding,
  updatePayoutAccount,
  verifyPaystackFunding,
  verifySafehavenFunding,
  withdrawWallet,
  type MembershipInfo,
  type PointsInfo,
  type WalletInfo,
  type WalletMember,
  type WalletTransaction,
} from "../api/account";
import { agentApi } from "../api/agent";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useI18n } from "../i18n/I18nProvider";
import { useMembershipSettings } from "../hooks/useMembershipSettings";
import { membershipCatalogSubtitle } from "../api/membership";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { getUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatMemberDisplayId, readNumericUserId } from "../utils/memberDisplayId";
import { isPaystackFundingEnabled, isWithdrawMethodEnabled } from "../utils/paystackFunding";

type DisplayTx = {
  id: string;
  kind: "funding" | "order" | "payout" | "points";
  title: string;
  subtitle: string;
  party?: string | null;
  typeLabel: string;
  amount: number;
  status: string;
  created_at?: string | null;
};

type Sheet = "fund" | "fundMethod" | "fundManual" | "payout" | "choose" | "bank" | "share" | "tx" | null;

function formatNaira(value?: number, signed = false) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const formatted = `₦${abs.toLocaleString("en-NG", {
    maximumFractionDigits: abs % 1 ? 2 : 0,
  })}`;
  if (!signed) return formatted;
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

function formatCount(value?: number) {
  const n = Number(value || 0);
  return n.toLocaleString("en-NG", {
    maximumFractionDigits: n % 1 ? 2 : 0,
  });
}

function formatTxWhen(value?: string | null) {
  if (!value) return "";
  const numeric = Number(value);
  const date =
    Number.isFinite(numeric) && String(value).trim() !== ""
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${hours}:${minutes}`;
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

function isVisibleHistory(status?: string | null) {
  return historyState(status) !== "hidden";
}

function historyLabel(status?: string | null) {
  return historyState(status) === "pending" ? "Pending" : "Successful";
}

function membershipBadgeLabel(title?: string | null) {
  const word = String(title || "")
    .replace(/membership|package|plan/gi, " ")
    .trim()
    .split(/\s+/)[0];
  return word ? word.toUpperCase() : "";
}

function isActiveMembership(current?: MembershipInfo["current"] | null) {
  if (!current) return false;
  const status = String(current.status || "").toUpperCase();
  return status === "ACTIVE" || status === "1";
}

function shouldShowMembershipBadge(
  accountType?: string | null,
  current?: MembershipInfo["current"] | null
) {
  if (String(accountType || "").toLowerCase() !== "business") return false;
  return isActiveMembership(current);
}

function isPending(status?: string | null) {
  const raw = String(status || "").trim().toLowerCase();
  return raw === "pending" || raw === "0" || raw === "";
}

function kindFromMethod(method?: string | null): DisplayTx["kind"] | null {
  const raw = String(method || "").toLowerCase();
  if (!raw) return null;
  if (raw === "share" || raw.includes("payout") || raw.includes("withdraw")) return "payout";
  if (raw === "points" || raw === "cbc") return "points";
  if (
    raw === "membership" ||
    raw === "shop_order" ||
    raw === "listing_purchase" ||
    raw.includes("escrow_hold")
  ) {
    return "order";
  }
  if (raw === "share_in") return "funding";
  return null;
}

function looksLikeMembership(item: WalletTransaction) {
  const blob = `${item.method || ""} ${item.title || ""} ${item.subtitle || ""} ${item.kind || ""}`.toLowerCase();
  return blob.includes("membership") && !blob.includes("cashback");
}

function typeLabelFor(item: WalletTransaction, kind: DisplayTx["kind"]) {
  const raw = String(item.method || "").toLowerCase();
  if (looksLikeMembership(item)) return item.title || "Membership";
  if (raw === "share") return "Shared";
  if (raw === "share_in") return "Received";
  if (raw === "shop_order" || raw === "listing_purchase") return "Marketplace purchase";
  if (raw.includes("escrow_hold")) return "Help Me Buy escrow";
  if (raw.startsWith("listing_")) return "Marketplace sale";
  if (kind === "payout") return "Withdrawal";
  if (kind === "points") return "Points redeemed";
  if (kind === "order") return "Membership";
  return "Wallet funding";
}

function toDisplayTx(item: WalletTransaction): DisplayTx {
  const kind =
    kindFromMethod(item.method) ||
    (looksLikeMembership(item) ? "order" : item.kind) ||
    "funding";
  const amount = Number(item.amount || 0);
  const debit = kind === "payout" || kind === "order" || looksLikeMembership(item);
  const signed = debit ? -Math.abs(amount) : Math.abs(amount);
  const typeLabel = typeLabelFor(item, kind);
  const party = String(item.party || "").trim();
  const backendTitle = String(item.title || "").trim();
  const backendSubtitle = String(item.subtitle || "").trim();
  return {
    id: item.id || `${kind}-${item.created_at || amount}`,
    kind,
    title: party || backendTitle || typeLabel,
    subtitle: backendSubtitle || typeLabel,
    party: party || null,
    typeLabel,
    amount: signed,
    status: item.status,
    created_at: item.created_at,
  };
}

function txIcon(kind: DisplayTx["kind"]): keyof typeof Ionicons.glyphMap {
  if (kind === "payout") return "checkmark-circle-outline";
  if (kind === "points") return "link-outline";
  if (kind === "order") return "receipt-outline";
  return "card-outline";
}

export default function WalletScreen() {
  const s = useSettingsStyles();

  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const pathname = usePathname();
  const agentWallet = pathname.startsWith("/agents");
  const { enabled, label } = useAppFeatures();
  const { t } = useI18n();
  const { personalPlan } = useMembershipSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [points, setPoints] = useState<PointsInfo | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedTx, setSelectedTx] = useState<DisplayTx | null>(null);
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localMemberId, setLocalMemberId] = useState("");
  const [afterPayout, setAfterPayout] = useState<"choose" | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [memberIdText, setMemberIdText] = useState("");
  const [recipient, setRecipient] = useState<WalletMember | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofType, setProofType] = useState<string | null>(null);
  const [paystackFailed, setPaystackFailed] = useState(false);
  const [heldFees, setHeldFees] = useState(0);

  const load = useCallback(async () => {
    const user = await getUser();
    const numericId = readNumericUserId(user as Record<string, unknown> | null);
    if (numericId) setLocalMemberId(formatMemberDisplayId(numericId));

    const [walletResult, pointsResult, membershipResult, agentStats] = await Promise.all([
      getWallet(),
      getPoints(),
      getMembership(),
      agentWallet ? agentApi.dashboard().catch(() => null) : Promise.resolve(null),
    ]);

    if (!walletResult.success || !walletResult.data) {
      setError(walletResult.message || "Could not load wallet.");
      return;
    }
    setError(null);
    setWallet(walletResult.data);
    if (walletResult.data.payout_account) {
      setBankName(walletResult.data.payout_account.bank_name);
      setAccountName(walletResult.data.payout_account.account_name);
      setAccountNumber(walletResult.data.payout_account.account_number);
    }
    if (pointsResult.success && pointsResult.data) setPoints(pointsResult.data);
    if (membershipResult.success && membershipResult.data) setMembership(membershipResult.data);
    setHeldFees(Number(agentStats?.held_agent_fees || 0));
  }, [agentWallet]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const accountType = String(
    wallet?.account_type || membership?.account_type || "personal"
  ).toLowerCase();
  const current = wallet?.current || membership?.current || null;
  const showBadge = shouldShowMembershipBadge(accountType, current);
  const badgeText =
    (wallet?.membership_badge || membershipBadgeLabel(current?.title)).trim();

  const cbcValue = Number(
    wallet?.cbc_points ?? points?.cbc ?? wallet?.points ?? points?.points ?? 0
  );
  const pendingCount = Number(
    wallet?.pending?.count ??
      (wallet?.transactions || []).filter((item) => isPending(item.status)).length
  );
  const pendingAmount = Number(
    wallet?.pending?.amount ??
      (wallet?.transactions || [])
        .filter((item) => isPending(item.status))
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0)
  );

  const transactions = useMemo(() => {
    const rows = (wallet?.transactions || [])
      .map(toDisplayTx)
      .filter((item) => isVisibleHistory(item.status));
    const membershipAmount = Number(current?.amount || 0);
    const hasMembershipDebit = rows.some((item) => /membership/i.test(item.title) && item.amount < 0);
    if (membershipAmount > 0 && current && !hasMembershipDebit) {
      rows.push({
        id: "membership-current",
        kind: "order",
        title: current.title || "Membership",
        subtitle: "Debit",
        typeLabel: "Membership",
        amount: -Math.abs(membershipAmount),
        status: "Approved",
        created_at: current.renews_at || null,
      });
    }
    return rows
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [current, wallet?.transactions]);

  const memberId =
    wallet?.member_id || membership?.member_id || localMemberId || "";

  const membershipSubtitle = current
    ? [current.title, current.renews_at ? `renews ${current.renews_at}` : ""]
        .filter(Boolean)
        .join(" · ")
    : membershipCatalogSubtitle(personalPlan, "Membership packages");

  const membershipLive = enabled("membership");
  const rewardsLive = enabled("rewards");
  const rewardsSoon = label("rewards");

  const closeSheet = () => {
    if (submitting) return;
    setSheet(null);
    setSelectedTx(null);
    setAmountText("");
    setMemberIdText("");
    setRecipient(null);
    setRecipientError(null);
    setAfterPayout(null);
    setProofUri(null);
    setProofType(null);
    setPaystackFailed(false);
  };

  const openWithdraw = () => {
    if (!wallet?.payout_account) {
      setAfterPayout("choose");
      setSheet("payout");
      return;
    }
    setSheet("choose");
  };

  const parseAmount = () => Number(String(amountText).replace(/,/g, ""));
  const available = Number(wallet?.balance || 0);

  const funding = wallet?.funding;
  const paystackOn = isPaystackFundingEnabled(funding);
  const safehavenOn = Boolean(funding?.safehaven?.enabled);
  const manualOn = Boolean(funding?.manual?.enabled);
  const minFund = Number(funding?.min_amount || 100);
  const withdrawPaystackOn = isWithdrawMethodEnabled(funding, "paystack");
  const withdrawManualOn = isWithdrawMethodEnabled(funding, "manual");
  const minWithdraw = Number(funding?.withdraw?.min_amount || 100);

  const openCheckout = async (url?: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url, { enableDefaultShareMenuItem: false });
    } catch {
      await Linking.openURL(url);
    }
  };

  const continueFunding = () => {
    const amount = parseAmount();
    if (!Number.isFinite(amount) || amount < minFund) {
      Alert.alert(t("wallet.amountTitle"), t("wallet.amountBody"));
      return;
    }
    setPaystackFailed(false);
    setSheet("fundMethod");
  };

  const payWithPaystack = async () => {
    const amount = parseAmount();
    setSubmitting(true);
    const started = await startPaystackFunding(amount);
    if (!started.success || !started.data?.authorization_url) {
      setSubmitting(false);
      setPaystackFailed(true);
      Alert.alert(t("wallet.fundError"), started.message || t("wallet.paystackFailed"));
      return;
    }
    await openCheckout(started.data.authorization_url);
    const verified = await verifyPaystackFunding(started.data.reference);
    setSubmitting(false);
    if (!verified.success) {
      setPaystackFailed(true);
      Alert.alert(t("wallet.fundError"), verified.message || t("wallet.paystackFailed"));
      return;
    }
    closeSheet();
    Alert.alert(
      t("wallet.fundSuccess"),
      t("wallet.fundSuccessBody", { amount: formatNaira(amount) })
    );
    await load();
  };

  const payWithSafehaven = async () => {
    const amount = parseAmount();
    setSubmitting(true);
    const started = await startSafehavenFunding(amount);
    if (!started.success || !started.data?.authorization_url) {
      setSubmitting(false);
      Alert.alert(t("wallet.fundError"), started.message || t("wallet.tryAgain"));
      return;
    }
    await openCheckout(started.data.authorization_url);
    const verified = await verifySafehavenFunding(started.data.reference);
    setSubmitting(false);
    if (!verified.success) {
      Alert.alert(t("wallet.fundError"), verified.message || t("wallet.tryAgain"));
      return;
    }
    closeSheet();
    Alert.alert(
      t("wallet.fundSuccess"),
      t("wallet.fundSuccessBody", { amount: formatNaira(amount) })
    );
    await load();
  };

  const pickProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    setProofUri(picked.assets[0].uri);
    setProofType(picked.assets[0].mimeType || null);
  };

  const submitManual = async () => {
    const amount = parseAmount();
    if (!proofUri) {
      Alert.alert(t("wallet.fundError"), t("wallet.proofNeeded"));
      return;
    }
    setSubmitting(true);
    const result = await submitManualFunding(amount, {
      uri: proofUri,
      type: proofType || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      Alert.alert(t("wallet.fundError"), result.message || t("wallet.tryAgain"));
      return;
    }
    closeSheet();
    Alert.alert(t("wallet.submitted"), t("wallet.submittedBody"));
    await load();
  };

  const submitFund = async () => {
    continueFunding();
  };

  const submitBankWithdraw = async (method: "paystack" | "manual") => {
    const amount = parseAmount();
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t("wallet.amountTitle"), t("wallet.amountBody"));
      return;
    }
    if (amount < minWithdraw) {
      Alert.alert(t("wallet.amountTitle"), t("wallet.withdrawMin", { amount: formatNaira(minWithdraw) }));
      return;
    }
    if (amount > available) {
      Alert.alert(t("wallet.insufficientTitle"), t("wallet.insufficientBody"));
      return;
    }
    setSubmitting(true);
    const result = await withdrawWallet(amount, method);
    setSubmitting(false);
    if (!result.success) {
      Alert.alert(t("wallet.withdrawError"), result.message || t("wallet.tryAgain"));
      return;
    }
    closeSheet();
    Alert.alert(
      method === "paystack" ? t("wallet.withdrawSent") : t("wallet.submitted"),
      method === "paystack" ? t("wallet.withdrawSentBody") : t("wallet.submittedBody")
    );
    await load();
  };

  const submitPayoutAccount = async () => {
    const name = bankName.trim();
    const holder = accountName.trim();
    const number = accountNumber.replace(/\s+/g, "");
    if (!name || !holder || number.length < 8) {
      Alert.alert(t("wallet.payoutNeeded"), t("wallet.payoutNeededBody"));
      return;
    }
    setSubmitting(true);
    const result = await updatePayoutAccount({
      bank_name: name,
      account_name: holder,
      account_number: number,
    });
    setSubmitting(false);
    if (!result.success || !result.data) {
      Alert.alert(t("wallet.payoutError"), result.message || t("wallet.tryAgain"));
      return;
    }
    setWallet((current) =>
      current ? { ...current, payout_account: result.data?.payout_account || current.payout_account } : current
    );
    if (afterPayout === "choose") {
      setAfterPayout(null);
      setSheet("choose");
    } else {
      setSheet(null);
    }
  };

  const submitShare = async () => {
    if (!recipient) {
      Alert.alert(t("wallet.share"), recipientError || t("wallet.memberNotFound"));
      return;
    }
    const amount = parseAmount();
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t("wallet.amountTitle"), t("wallet.amountBody"));
      return;
    }
    if (amount > available) {
      Alert.alert(t("wallet.insufficientTitle"), t("wallet.insufficientBody"));
      return;
    }
    setSubmitting(true);
    const result = await shareWallet(recipient.member_id, amount);
    setSubmitting(false);
    if (!result.success) {
      Alert.alert(t("wallet.shareError"), result.message || t("wallet.tryAgain"));
      return;
    }
    const sent = formatNaira(amount);
    closeSheet();
    Alert.alert(
      t("wallet.shareSuccess"),
      t("wallet.shareSuccessBody", { amount: sent, name: recipient.name })
    );
    await load();
  };

  useEffect(() => {
    if (sheet !== "share") return;
    const normalized = memberIdText.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length < 12) {
      setRecipient(null);
      setRecipientError(null);
      setLookingUp(false);
      return;
    }
    const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
    if (memberId && formatted === memberId) {
      setRecipient(null);
      setRecipientError(t("wallet.shareSelf"));
      setLookingUp(false);
      return;
    }
    let cancelled = false;
    setLookingUp(true);
    const timer = setTimeout(() => {
      void lookupWalletMember(formatted).then((result) => {
        if (cancelled) return;
        setLookingUp(false);
        if (!result.success || !result.data) {
          setRecipient(null);
          setRecipientError(result.message || t("wallet.memberNotFound"));
          return;
        }
        setRecipient(result.data);
        setRecipientError(null);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberId, memberIdText, sheet, t]);

  if (!allowed) return null;

  const copyMemberId = async () => {
    if (!memberId) {
      Alert.alert("Digital membership ID", "Your member ID is not available yet.");
      return;
    }
    await Clipboard.setStringAsync(memberId);
    Alert.alert("Digital membership ID", memberId, [
      { text: "Close", style: "cancel" },
      { text: "Copy ID", onPress: () => void Clipboard.setStringAsync(memberId) },
    ]);
  };

  return (
    <SettingsPage
      kicker={t("wallet.kicker")}
      title={t("wallet.title")}
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
          <View style={styles.heroTop}>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.heroKicker}>AVAILABLE BALANCE</Text>
              <Pressable
                onPress={() => setHidden((value) => !value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
              >
                <Ionicons
                  name={hidden ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  color="rgba(255,255,255,0.88)"
                />
              </Pressable>
            </View>
            {showBadge && badgeText ? (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{badgeText}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroBalance}>
            {hidden ? "₦••••••" : formatNaira(wallet?.balance)}
          </Text>
          <Text style={styles.heroPoints}>
            {rewardsLive ? `${formatCount(cbcValue)} CBC points` : rewardsSoon}
          </Text>

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => setSheet("fund")}
              style={({ pressed }) => [styles.fundBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Fund wallet"
            >
              <Ionicons name="arrow-down" size={16} color={colors.text} />
              <Text style={styles.fundText}>Fund</Text>
            </Pressable>
            <Pressable
              onPress={openWithdraw}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Withdraw"
            >
              <Ionicons name="arrow-up" size={16} color={colors.white} />
              <Text style={styles.ghostText}>Withdraw</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!rewardsLive || agentWallet) {
                  Alert.alert("CBC points", rewardsSoon);
                  return;
                }
                router.push("/profile/rewards");
              }}
              style={({ pressed }) => [
                styles.ghostBtn,
                !rewardsLive && styles.ghostBtnSoon,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={rewardsLive ? "Points" : rewardsSoon}
            >
              <Ionicons
                name="link-outline"
                size={16}
                color={rewardsLive ? colors.white : "rgba(255,255,255,0.55)"}
              />
              <Text style={[styles.ghostText, !rewardsLive && styles.ghostTextSoon]}>
                {rewardsLive ? "Points" : "Soon"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statKicker}>AWAITING APPROVAL</Text>
            <Text style={styles.statValue}>{formatNaira(pendingAmount)}</Text>
            <Text style={styles.statMeta}>
              {pendingCount} request{pendingCount === 1 ? "" : "s"} in review
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statKicker}>CBC POINTS</Text>
            {rewardsLive ? (
              <Text style={styles.statValue}>{formatCount(cbcValue)}</Text>
            ) : (
              <Text style={styles.statSoon}>{rewardsSoon}</Text>
            )}
            <Text style={styles.statMeta}>
              {rewardsLive ? "Redeemable into wallet" : "Turns on with Rewards"}
            </Text>
          </View>
        </View>

        {agentWallet ? (
          <View style={styles.escrowCard}>
            <Text style={styles.sectionTitle}>Protected in escrow</Text>
            <Text style={styles.escrowValue}>{formatNaira(heldFees)}</Text>
            <Text style={styles.sectionMeta}>
              Held agent fees stay protected until the customer confirms delivery.
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <Text style={styles.sectionMeta}>
              Successful and pending credits and debits
            </Text>
          </View>
          {agentWallet ? null : (
            <Pressable
              onPress={() => router.push("/profile/activity")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="See all transactions"
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          )}
        </View>

        {!transactions.length ? (
          <Text style={s.empty}>No wallet transactions yet.</Text>
        ) : (
          <View style={styles.txList}>
            {transactions.map((item) => {
              const pending = historyState(item.status) === "pending";
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelectedTx(item);
                    setSheet("tx");
                  }}
                  style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${formatNaira(item.amount, true)}`}
                >
                  <View style={styles.txIcon}>
                    <Ionicons name={txIcon(item.kind)} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.txCopy}>
                    <Text style={styles.txTitle}>{item.title}</Text>
                    <Text style={styles.txMeta}>{item.subtitle}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        item.amount > 0 ? styles.txAmountIn : styles.txAmountOut,
                      ]}
                    >
                      {formatNaira(item.amount, true)}
                    </Text>
                    {pending ? (
                      <Text style={styles.txDate}>Pending</Text>
                    ) : (
                      <View style={[styles.approvedPill, item.amount < 0 && styles.debitPill]}>
                        <Text style={[styles.approvedText, item.amount < 0 && styles.debitText]}>
                          {item.amount < 0 ? "DEBIT" : "CREDIT"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.accountHeading}>Account</Text>
        <View style={styles.accountList}>
          {!agentWallet ? (
            <AccountRow
              title="Membership"
              subtitle={membershipLive ? membershipSubtitle : membershipCatalogSubtitle(personalPlan, label("membership"))}
              comingSoon={!membershipLive}
              soonLabel={label("membership")}
              onPress={() => router.push("/profile/membership")}
            />
          ) : null}
          {!agentWallet ? (
            <AccountRow
              title="Digital membership ID"
              subtitle={memberId || "Your digital ID"}
              onPress={() => void copyMemberId()}
            />
          ) : null}
          <AccountRow
            title="Rewards & CBC points"
            subtitle={
              rewardsLive ? "How points are earned and redeemed" : rewardsSoon
            }
            comingSoon={!rewardsLive}
            soonLabel={rewardsSoon}
            last={agentWallet}
            onPress={rewardsLive && !agentWallet ? () => router.push("/profile/rewards") : undefined}
          />
          {agentWallet ? null : (
            <AccountRow
              title="Referrals"
              subtitle="Invite Jos residents and businesses"
              last
              onPress={() => router.push("/profile/referrals")}
            />
          )}
        </View>

        <Text style={styles.footnote}>
          JOSCITY reviews bank funding and payouts. Shares to another member move immediately.
        </Text>
      </FadeIn>

      <Modal
        visible={Boolean(sheet)}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeSheet} />
          <View style={styles.modalCard}>
            {sheet === "tx" && selectedTx ? (
              <>
                <Text style={styles.modalTitle}>{selectedTx.title}</Text>
                <Text style={styles.modalMeta}>{selectedTx.subtitle}</Text>
                <Text
                  style={[
                    styles.detailAmount,
                    selectedTx.amount > 0 ? styles.txAmountIn : styles.txAmountOut,
                  ]}
                >
                  {formatNaira(selectedTx.amount, true)}
                </Text>
                {selectedTx.party ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{selectedTx.party}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Direction</Text>
                  <Text style={styles.detailValue}>{selectedTx.amount < 0 ? "Debit" : "Credit"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{historyLabel(selectedTx.status)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatTxWhen(selectedTx.created_at) || "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedTx.typeLabel}</Text>
                </View>
                <Pressable onPress={closeSheet} style={styles.cancelBtn} accessibilityRole="button">
                  <Text style={styles.cancelText}>Close</Text>
                </Pressable>
              </>
            ) : null}
            {sheet === "payout" ? (
              <>
                <Text style={styles.modalTitle}>{t("wallet.payoutNeeded")}</Text>
                <Text style={styles.modalMeta}>{t("wallet.payoutHint")}</Text>
                <TextField
                  label={t("wallet.bankName")}
                  value={bankName}
                  onChangeText={setBankName}
                  editable={!submitting}
                />
                <TextField
                  label={t("wallet.accountName")}
                  value={accountName}
                  onChangeText={setAccountName}
                  editable={!submitting}
                />
                <TextField
                  label={t("wallet.accountNumber")}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  editable={!submitting}
                />
                <Pressable
                  onPress={() => void submitPayoutAccount()}
                  disabled={submitting}
                  style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.save")}
                >
                  {submitting ? (
                    <JosCityLoader color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>{t("common.save")}</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            {sheet === "choose" ? (
              <>
                <Text style={styles.modalTitle}>{t("wallet.withdraw")}</Text>
                <Text style={styles.modalMeta}>{t("wallet.chooseHint")}</Text>
                <View style={styles.choiceRow}>
                  <Pressable
                    onPress={() => {
                      setAmountText("");
                      setSheet("bank");
                    }}
                    style={({ pressed }) => [styles.choiceBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t("wallet.toBank")}
                  >
                    <Ionicons name="business-outline" size={18} color={colors.white} />
                    <Text style={styles.choiceText}>{t("wallet.toBank")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAmountText("");
                      setMemberIdText("");
                      setRecipient(null);
                      setRecipientError(null);
                      setSheet("share");
                    }}
                    style={({ pressed }) => [styles.choiceBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t("wallet.share")}
                  >
                    <Ionicons name="people-outline" size={18} color={colors.white} />
                    <Text style={styles.choiceText}>{t("wallet.share")}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {sheet === "fund" || sheet === "bank" ? (
              <>
                <Text style={styles.modalTitle}>
                  {sheet === "bank" ? t("wallet.withdraw") : t("wallet.fund")}
                </Text>
                <Text style={styles.modalMeta}>
                  {sheet === "bank" ? t("wallet.withdrawChooseHint") : t("wallet.fundHint")}
                </Text>
                {sheet === "bank" ? (
                  <Text style={styles.availableLine}>
                    {t("wallet.availableShort", { amount: formatNaira(available) })}
                  </Text>
                ) : null}
                <View style={styles.amountField}>
                  <Text style={styles.amountPrefix}>₦</Text>
                  <TextInput
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.amountInput}
                    editable={!submitting}
                  />
                </View>
                {sheet === "bank" ? (
                  <>
                    {withdrawPaystackOn ? (
                      <Pressable
                        onPress={() => void submitBankWithdraw("paystack")}
                        disabled={submitting}
                        style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t("wallet.withdrawPaystack")}
                      >
                        {submitting ? (
                          <JosCityLoader color={colors.white} />
                        ) : (
                          <Text style={styles.submitText}>{t("wallet.withdrawPaystack")}</Text>
                        )}
                      </Pressable>
                    ) : null}
                    {withdrawManualOn ? (
                      <Pressable
                        onPress={() => void submitBankWithdraw("manual")}
                        disabled={submitting}
                        style={({ pressed }) => [styles.methodBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t("wallet.withdrawManual")}
                      >
                        <Text style={styles.methodBtnText}>{t("wallet.withdrawManual")}</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <Pressable
                    onPress={() => void continueFunding()}
                    disabled={submitting}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t("wallet.fund")}
                  >
                    {submitting ? (
                      <JosCityLoader color={colors.white} />
                    ) : (
                      <Text style={styles.submitText}>{t("wallet.fund")}</Text>
                    )}
                  </Pressable>
                )}
              </>
            ) : null}

            {sheet === "fundMethod" ? (
              <>
                <Text style={styles.modalTitle}>{t("wallet.fundMethods")}</Text>
                <Text style={styles.modalMeta}>
                  {formatNaira(parseAmount())}. {paystackFailed ? t("wallet.paystackFailed") : t("wallet.fundHint")}
                </Text>
                {paystackOn ? (
                  <Pressable
                    onPress={() => void payWithPaystack()}
                    disabled={submitting}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                  >
                    {submitting ? <JosCityLoader color={colors.white} /> : <Text style={styles.submitText}>{t("wallet.paystack")}</Text>}
                  </Pressable>
                ) : null}
                {safehavenOn ? (
                  <Pressable
                    onPress={() => void payWithSafehaven()}
                    disabled={submitting}
                    style={({ pressed }) => [styles.methodBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.methodBtnText}>{t("wallet.safehaven")}</Text>
                  </Pressable>
                ) : null}
                {manualOn ? (
                  <Pressable
                    onPress={() => setSheet("fundManual")}
                    disabled={submitting}
                    style={({ pressed }) => [styles.methodBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.methodBtnText}>{t("wallet.manualTransfer")}</Text>
                  </Pressable>
                ) : null}
                {!paystackOn && !safehavenOn && !manualOn ? (
                  <Pressable
                    onPress={() => void payWithPaystack()}
                    disabled={submitting}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                  >
                    {submitting ? <JosCityLoader color={colors.white} /> : <Text style={styles.submitText}>{t("wallet.paystack")}</Text>}
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {sheet === "fundManual" ? (
              <>
                <Text style={styles.modalTitle}>{t("wallet.manualTransfer")}</Text>
                <Text style={styles.modalMeta}>{t("wallet.manualHint")}</Text>
                <View style={styles.bankCard}>
                  <Text style={styles.bankLine}>{funding?.manual?.bank_name}</Text>
                  <Text style={styles.bankLine}>{funding?.manual?.account_name}</Text>
                  <Text style={styles.bankNumber}>{funding?.manual?.account_number}</Text>
                  <Pressable
                    onPress={() => {
                      const number = funding?.manual?.account_number;
                      if (number) void Clipboard.setStringAsync(number);
                    }}
                  >
                    <Text style={styles.copyLink}>{t("wallet.copyAccount")}</Text>
                  </Pressable>
                </View>
                {proofUri ? <Image source={{ uri: proofUri }} style={styles.proofPreview} /> : null}
                <Pressable
                  onPress={() => void pickProof()}
                  style={({ pressed }) => [styles.methodBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.methodBtnText}>
                    {proofUri ? t("wallet.changeProof") : t("wallet.attachProof")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void submitManual()}
                  disabled={submitting}
                  style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                >
                  {submitting ? <JosCityLoader color={colors.white} /> : <Text style={styles.submitText}>{t("wallet.submitProof")}</Text>}
                </Pressable>
              </>
            ) : null}

            {sheet === "share" ? (
              <>
                <Text style={styles.modalTitle}>{t("wallet.share")}</Text>
                <Text style={styles.modalMeta}>{t("wallet.shareHint")}</Text>
                <TextField
                  label={t("wallet.memberId")}
                  value={memberIdText}
                  onChangeText={(value) => {
                    setMemberIdText(value);
                    setAmountText("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t("wallet.memberIdPlaceholder")}
                  editable={!submitting}
                />
                {lookingUp ? (
                  <Text style={styles.lookupMeta}>{t("wallet.lookingUp")}</Text>
                ) : recipient ? (
                  <View style={styles.recipientCard}>
                    <Text style={styles.recipientName}>{recipient.name}</Text>
                    <Text style={styles.recipientMeta}>
                      {t("wallet.memberFound", {
                        name: recipient.member_id,
                        type: recipient.account_type_label,
                      })}
                    </Text>
                  </View>
                ) : recipientError ? (
                  <Text style={styles.lookupError}>{recipientError}</Text>
                ) : null}
                <Text style={styles.availableLine}>
                  {t("wallet.availableShort", { amount: formatNaira(available) })}
                </Text>
                <View style={[styles.amountField, !recipient && styles.amountFieldDisabled]}>
                  <Text style={styles.amountPrefix}>₦</Text>
                  <TextInput
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.amountInput}
                    editable={Boolean(recipient) && !submitting}
                  />
                </View>
                <Pressable
                  onPress={() => void submitShare()}
                  disabled={submitting || !recipient}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!recipient || submitting) && styles.submitBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("wallet.shareNow")}
                >
                  {submitting ? (
                    <JosCityLoader color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>{t("wallet.shareNow")}</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            <Pressable
              onPress={closeSheet}
              disabled={submitting}
              style={styles.cancelBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SettingsPage>
  );
}

function AccountRow({
  title,
  subtitle,
  onPress,
  comingSoon,
  soonLabel,
  last,
}: {
  title: string;
  subtitle: string;
  onPress?: () => void;
  comingSoon?: boolean;
  soonLabel?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = (
    <>
      <View style={styles.accountCopy}>
        <Text style={styles.accountTitle}>{title}</Text>
        <Text style={styles.accountMeta}>{subtitle}</Text>
      </View>
      {comingSoon ? (
        <SoonBadge label={soonLabel} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </>
  );

  if (!onPress) {
    return <View style={[styles.accountRow, last && styles.accountRowLast]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.accountRow,
        last && styles.accountRowLast,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {body}
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroKicker: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    color: "rgba(255,255,255,0.78)",
  },
  planBadge: {
    borderRadius: 999,
    backgroundColor: "#C5C9CE",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planBadgeText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.white,
  },
  heroBalance: {
    marginTop: 10,
    fontFamily: "Montserrat_700Bold",
    fontSize: 32,
    color: colors.white,
  },
  heroPoints: {
    marginTop: 4,
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
  },
  heroActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  fundBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  fundText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: colors.brand,
  },
  ghostBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#164d30",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ghostText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: colors.white,
  },
  ghostBtnSoon: {
    opacity: 0.72,
  },
  ghostTextSoon: {
    color: "rgba(255,255,255,0.7)",
  },
  statSoon: {
    marginTop: 8,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 22,
    paddingBottom: 4,
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  statKicker: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.textMuted,
  },
  statValue: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
  },
  statMeta: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
  },
  sectionMeta: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  escrowCard: {
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
  },
  escrowValue: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
  },
  seeAll: {
    marginTop: 4,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  txList: {
    marginBottom: 8,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navActive,
    alignItems: "center",
    justifyContent: "center",
  },
  txCopy: {
    flex: 1,
  },
  txTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  txMeta: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
  },
  txAmountIn: {
    color: colors.success,
  },
  txAmountOut: {
    color: colors.text,
  },
  detailAmount: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
  },
  detailRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
  txDate: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  approvedPill: {
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: colors.navActive,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  approvedText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  debitPill: {
    backgroundColor: colors.iconSoft,
  },
  debitText: {
    color: colors.error,
  },
  accountHeading: {
    marginTop: 18,
    marginBottom: 4,
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
  },
  accountList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  accountRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountRowLast: {
    borderBottomWidth: 0,
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  accountMeta: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  footnote: {
    marginTop: 18,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.72,
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
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 18,
  },
  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
  },
  modalMeta: {
    marginTop: 6,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  amountField: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  amountPrefix: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  amountInput: {
    flex: 1,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 18,
    color: colors.text,
    paddingVertical: 12,
  },
  submitBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.white,
  },
  cancelBtn: {
    marginTop: 8,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  choiceRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  choiceBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  choiceText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.white,
  },
  methodBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  methodBtnText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  bankCard: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  bankLine: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: colors.text,
  },
  bankNumber: {
    marginTop: 6,
    fontFamily: "Montserrat_700Bold",
    fontSize: 20,
    color: colors.text,
  },
  copyLink: {
    marginTop: 8,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  proofPreview: {
    marginTop: 12,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.fieldBg,
  },
  availableLine: {
    marginTop: 10,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  lookupMeta: {
    marginTop: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  lookupError: {
    marginTop: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.error,
  },
  recipientCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.navActive,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recipientName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  recipientMeta: {
    marginTop: 3,
    fontFamily: "Montserrat_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
  amountFieldDisabled: {
    opacity: 0.45,
  },
});
}
