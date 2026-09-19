import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import TextField from "../components/TextField";
import WalletFundingModal from "../components/wallet/WalletFundingModal";
import { useAppFeatures } from "../hooks/useAppFeatures";
import {
  getBusinessWallet,
  updateBusinessPayoutAccount,
  withdrawBusinessWallet,
  type BusinessWallet,
  type BusinessWalletTx,
} from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira } from "../utils/format";
import { isWithdrawMethodEnabled } from "../utils/paystackFunding";

type Filter = "all" | "in" | "out" | "pending";
type Sheet = "withdraw" | "payout" | "tx" | null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`;
}

function txIcon(item: BusinessWalletTx): keyof typeof Ionicons.glyphMap {
  if (item.kind === "withdrawal") return "card-outline";
  if (item.kind === "membership") return "arrow-up-outline";
  if (item.direction === "in") return "arrow-down-outline";
  return "wallet-outline";
}

function statusLabel(item: BusinessWalletTx) {
  if (item.status === "pending") return "PENDING APPROVAL";
  if (item.status === "failed") {
    return item.kind === "withdrawal" ? "REJECTED" : "FAILED";
  }
  return "";
}

export default function BusinessWalletScreen() {
  const allowed = useRequireBusinessAccount();
  const s = useSettingsStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { label } = useAppFeatures();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [wallet, setWallet] = useState<BusinessWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selected, setSelected] = useState<BusinessWalletTx | null>(null);
  const [amountText, setAmountText] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [afterPayout, setAfterPayout] = useState<"withdraw" | null>(null);
  const [fundOpen, setFundOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await getBusinessWallet();
    if (!result.success || !result.data) {
      setError(result.message || t("business.walletLoadError"));
      return;
    }
    setError(null);
    setWallet(result.data);
    if (result.data.payout_account) {
      setBankName(result.data.payout_account.bank_name);
      setAccountName(result.data.payout_account.account_name);
      setAccountNumber(result.data.payout_account.account_number);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const transactions = useMemo(() => {
    const rows = wallet?.transactions || [];
    if (filter === "in") return rows.filter((item) => item.direction === "in");
    if (filter === "out") return rows.filter((item) => item.direction === "out");
    if (filter === "pending") return rows.filter((item) => item.status === "pending");
    return rows;
  }, [filter, wallet?.transactions]);

  if (!allowed) return null;

  const closeSheet = () => {
    if (submitting) return;
    setSheet(null);
    setSelected(null);
    setAmountText("");
  };

  const openWithdrawSheet = () => {
    if (!wallet?.payout_account) {
      setAfterPayout("withdraw");
      setSheet("payout");
      return;
    }
    setSheet("withdraw");
  };

  const submitWithdraw = async (method: "paystack" | "manual") => {
    const amount = Number(String(amountText).replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t("business.walletAmountTitle"), t("business.walletAmountBody"));
      return;
    }
    if (amount > Number(wallet?.available || 0)) {
      Alert.alert(t("business.walletInsufficientTitle"), t("business.walletInsufficientBody"));
      return;
    }
    setSubmitting(true);
    const result = await withdrawBusinessWallet(amount, method);
    setSubmitting(false);
    if (!result.success) {
      Alert.alert(t("business.walletWithdrawError"), result.message || t("business.walletTryAgain"));
      return;
    }
    if (result.data) setWallet(result.data);
    setSheet(null);
    setAmountText("");
    Alert.alert(
      method === "paystack" ? t("wallet.withdrawSent") : t("business.walletWithdrawSubmitted"),
      method === "paystack" ? t("wallet.withdrawSentBody") : t("business.walletWithdrawReview")
    );
    await load();
  };

  const submitPayoutAccount = async () => {
    const name = bankName.trim();
    const holder = accountName.trim();
    const number = accountNumber.replace(/\s+/g, "");
    if (!name || !holder || number.length < 8) {
      Alert.alert(t("business.walletPayoutNeeded"), t("business.walletPayoutNeededBody"));
      return;
    }
    setSubmitting(true);
    const result = await updateBusinessPayoutAccount({
      bank_name: name,
      account_name: holder,
      account_number: number,
    });
    setSubmitting(false);
    if (!result.success || !result.data) {
      Alert.alert(t("business.walletPayoutError"), result.message || t("business.walletTryAgain"));
      return;
    }
    setWallet(result.data);
    if (afterPayout === "withdraw") {
      setAfterPayout(null);
      setSheet("withdraw");
    } else {
      setSheet(null);
    }
  };

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t("business.walletFilterAll") },
    { id: "in", label: t("business.walletFilterIn") },
    { id: "out", label: t("business.walletFilterOut") },
    { id: "pending", label: t("business.walletFilterPending") },
  ];

  return (
    <SettingsPage
      kicker={t("business.walletKicker")}
      title={t("business.walletTitle")}
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
          <Text style={styles.heroKicker}>{t("business.walletAvailable")}</Text>
          <Text style={styles.heroBalance}>{formatNaira(wallet?.available)}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t("business.walletHeld")}</Text>
              <Text style={styles.heroStatValue}>{formatNaira(wallet?.held_for_buyers)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t("business.walletLifetime")}</Text>
              <Text style={styles.heroStatValue}>{formatNaira(wallet?.lifetime_sales)}</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              onPress={() => setFundOpen(true)}
              style={({ pressed }) => [styles.fundBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("wallet.fund")}
            >
              <Ionicons name="arrow-down" size={16} color={colors.brand} />
              <Text style={styles.fundBtnText}>{t("wallet.fund")}</Text>
            </Pressable>
            <Pressable
              onPress={openWithdrawSheet}
              style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("business.withdraw")}
            >
              <Ionicons name="wallet-outline" size={16} color={colors.white} />
              <Text style={styles.heroBtnText}>{t("business.withdraw")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAfterPayout(null);
                setSheet("payout");
              }}
              style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("business.walletPayoutAccount")}
            >
              <Ionicons name="business-outline" size={16} color={colors.white} />
              <Text style={styles.heroBtnText}>{t("business.walletPayoutAccount")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.noticeText}>{t("business.walletNotice")}</Text>
        </View>

        <View style={styles.cbcRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cbcTitle}>{t("wallet.cbcPoints")}</Text>
            <Text style={styles.cbcMeta}>{t("business.walletCbcSoon")}</Text>
          </View>
          <Text style={styles.cbcSoon}>{label("rewards")}</Text>
        </View>

        <Text style={styles.payoutLine}>
          {wallet?.payout_account?.label || t("business.walletNoPayout")}
        </Text>

        <Text style={styles.sectionTitle}>{t("business.walletTransactions")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((item) => {
            const on = filter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={item.label}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!transactions.length ? (
          <Text style={s.empty}>{t("business.walletEmpty")}</Text>
        ) : (
          <View>
            {transactions.map((item) => {
              const badge = statusLabel(item);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSelected(item);
                    setSheet("tx");
                  }}
                  style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <View style={[styles.txIcon, item.direction === "in" && styles.txIconIn]}>
                    <Ionicons
                      name={txIcon(item)}
                      size={18}
                      color={item.direction === "in" ? colors.success : colors.text}
                    />
                  </View>
                  <View style={styles.txCopy}>
                    <Text style={styles.txTitle}>{item.title}</Text>
                    {badge ? (
                      <View style={[styles.badge, item.status === "failed" && styles.badgeFailed]}>
                        <Text
                          style={[
                            styles.badgeText,
                            item.status === "failed" && styles.badgeTextFailed,
                          ]}
                        >
                          {badge}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.txMeta}>{formatTxWhen(item.created_at)}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      item.amount > 0 ? styles.txAmountIn : styles.txAmountOut,
                    ]}
                  >
                    {formatNaira(item.amount, true)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </FadeIn>

      <Modal visible={sheet === "withdraw"} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeSheet} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("business.walletRequestTitle")}</Text>
            <Text style={styles.modalMeta}>
              {t("wallet.withdrawChooseHint")}
            </Text>
            <Text style={styles.amountLabel}>{t("business.walletAmountLabel")}</Text>
            <View style={styles.amountField}>
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
            <Text style={styles.modalAvailable}>
              {t("business.walletAvailableShort", { amount: formatNaira(wallet?.available) })}
            </Text>
            <View style={styles.quickRow}>
              {[20000, 50000].map((value) => {
                const disabled = value > Number(wallet?.available || 0) || submitting;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setAmountText(String(value))}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.quickChip,
                      disabled && styles.quickChipDisabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={formatNaira(value)}
                  >
                    <Text style={[styles.quickChipText, disabled && styles.quickChipTextDisabled]}>
                      {formatNaira(value)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setAmountText(String(Math.max(0, Number(wallet?.available || 0))))}
                disabled={submitting || Number(wallet?.available || 0) <= 0}
                style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("business.walletQuickAll")}
              >
                <Text style={styles.quickChipText}>{t("business.walletQuickAll")}</Text>
              </Pressable>
            </View>
            {isWithdrawMethodEnabled(wallet?.funding, "paystack") ? (
              <Pressable
                onPress={() => void submitWithdraw("paystack")}
                disabled={submitting}
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.withdrawPaystack")}
              >
                {submitting ? (
                  <JosCityLoader color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={16} color={colors.white} />
                    <Text style={styles.submitText}>{t("wallet.withdrawPaystack")}</Text>
                  </>
                )}
              </Pressable>
            ) : null}
            {isWithdrawMethodEnabled(wallet?.funding, "manual") ? (
              <Pressable
                onPress={() => void submitWithdraw("manual")}
                disabled={submitting}
                style={({ pressed }) => [styles.cancelOutline, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.withdrawManual")}
              >
                <Text style={styles.cancelOutlineText}>{t("wallet.withdrawManual")}</Text>
              </Pressable>
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

      <Modal visible={sheet === "payout"} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeSheet} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("business.walletPayoutAccount")}</Text>
            <Text style={styles.modalMeta}>{t("business.walletPayoutHint")}</Text>
            <TextField
              label={t("business.walletBankName")}
              value={bankName}
              onChangeText={setBankName}
              editable={!submitting}
            />
            <TextField
              label={t("business.walletAccountName")}
              value={accountName}
              onChangeText={setAccountName}
              editable={!submitting}
            />
            <TextField
              label={t("business.walletAccountNumber")}
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
            <Pressable onPress={closeSheet} disabled={submitting} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={sheet === "tx"} transparent animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeSheet} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            {selected?.subtitle ? <Text style={styles.modalMeta}>{selected.subtitle}</Text> : null}
            <Text
              style={[
                styles.detailAmount,
                Number(selected?.amount || 0) > 0 ? styles.txAmountIn : styles.txAmountOut,
              ]}
            >
              {formatNaira(selected?.amount, true)}
            </Text>
            {selected?.status === "pending" || selected?.status === "failed" ? (
              <View
                style={[
                  styles.badge,
                  styles.detailBadge,
                  selected.status === "failed" && styles.badgeFailed,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    selected.status === "failed" && styles.badgeTextFailed,
                  ]}
                >
                  {statusLabel(selected)}
                </Text>
              </View>
            ) : null}
            {selected?.status === "failed" ? (
              <View style={styles.reasonWrap}>
                <TextField
                  label={t("business.walletRejectedWhy")}
                  value={selected.reason || t("business.walletRejectedEmpty")}
                  editable={false}
                  multiline
                />
              </View>
            ) : null}
            <Text style={styles.modalMeta}>{formatTxWhen(selected?.created_at)}</Text>
            <Pressable onPress={closeSheet} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <WalletFundingModal
        visible={fundOpen}
        onClose={() => setFundOpen(false)}
        onSuccess={() => load()}
      />
    </SettingsPage>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    hero: {
      backgroundColor: colors.brand,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    heroKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.7,
      color: "rgba(255,255,255,0.78)",
    },
    heroBalance: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 32,
      color: colors.white,
    },
    heroStats: {
      marginTop: 14,
      flexDirection: "row",
      gap: 18,
    },
    heroStat: {
      flex: 1,
    },
    heroStatLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: "rgba(255,255,255,0.68)",
    },
    heroStatValue: {
      marginTop: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    heroActions: {
      marginTop: 16,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    fundBtn: {
      flexGrow: 1,
      minWidth: "30%",
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.white,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    fundBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.brand,
    },
    heroBtn: {
      flexGrow: 1,
      minWidth: "30%",
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: "#164d30",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    heroBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.white,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 14,
      backgroundColor: colors.navActive,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    noticeText: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: colors.text,
    },
    cbcRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 12,
    },
    cbcTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.text,
    },
    cbcMeta: {
      marginTop: 3,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    cbcSoon: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
    },
    payoutLine: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 22,
    },
    sectionTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
      marginBottom: 12,
    },
    filters: {
      gap: 8,
      paddingBottom: 8,
      marginBottom: 6,
    },
    chip: {
      borderRadius: 999,
      backgroundColor: colors.sheet,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: colors.brand,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    chipTextOn: {
      color: colors.white,
    },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
    },
    txIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    txIconIn: {
      backgroundColor: colors.navActive,
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
      fontSize: 12,
      color: colors.textMuted,
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
    badge: {
      alignSelf: "flex-start",
      marginTop: 5,
      borderRadius: 6,
      backgroundColor: "#F4E4C8",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeFailed: {
      backgroundColor: "rgba(180, 35, 24, 0.12)",
    },
    badgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 9,
      letterSpacing: 0.4,
      color: "#C2410C",
    },
    badgeTextFailed: {
      color: colors.error,
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
      marginBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    modalAvailable: {
      marginTop: 8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    amountLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    amountField: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
    },
    amountInput: {
      flex: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 18,
      color: colors.text,
      paddingVertical: 12,
    },
    quickRow: {
      marginTop: 14,
      flexDirection: "row",
      gap: 8,
    },
    quickChip: {
      borderRadius: 999,
      backgroundColor: colors.sheet,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    quickChipDisabled: {
      opacity: 0.4,
    },
    quickChipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    quickChipTextDisabled: {
      color: colors.textMuted,
    },
    submitBtn: {
      marginTop: 16,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    submitText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    cancelOutline: {
      marginTop: 8,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelOutlineText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
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
    reasonWrap: {
      marginTop: 12,
    },
    detailAmount: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
    },
    detailBadge: {
      marginTop: 10,
      marginBottom: 4,
    },
  });
}
