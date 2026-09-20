import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import JosCityLoader from "../JosCityLoader";
import {
  getWalletFunding,
  startPaystackFunding,
  startSafehavenFunding,
  submitManualFunding,
  verifyPaystackFunding,
  verifySafehavenFunding,
  type WalletFundingOptions,
} from "../../api/account";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { formatNaira } from "../../utils/format";
import { isPaystackFundingEnabled } from "../../utils/paystackFunding";

type Step = "amount" | "method" | "manual";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export default function WalletFundingModal({ visible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<Step>("amount");
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofType, setProofType] = useState<string | null>(null);
  const [paystackFailed, setPaystackFailed] = useState(false);
  const [funding, setFunding] = useState<WalletFundingOptions | null>(null);

  useEffect(() => {
    if (!visible) {
      setStep("amount");
      setAmountText("");
      setProofUri(null);
      setProofType(null);
      setPaystackFailed(false);
      setSubmitting(false);
      return;
    }
    void getWalletFunding().then((result) => {
      if (result.success && result.data) setFunding(result.data);
    });
  }, [visible]);

  const paystackOn = isPaystackFundingEnabled(funding);
  const safehavenOn = Boolean(funding?.safehaven?.enabled);
  const manualOn = Boolean(funding?.manual?.enabled);
  const minFund = Number(funding?.min_amount || 100);
  const amount = Number(String(amountText).replace(/,/g, ""));

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const openCheckout = async (url?: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url, { enableDefaultShareMenuItem: false });
    } catch {
      await Linking.openURL(url);
    }
  };

  const continueFunding = () => {
    if (!Number.isFinite(amount) || amount < minFund) {
      Alert.alert(t("wallet.amountTitle"), t("wallet.amountBody"));
      return;
    }
    setPaystackFailed(false);
    setStep("method");
  };

  const payWithPaystack = async () => {
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
    onClose();
    Alert.alert(t("wallet.fundSuccess"), t("wallet.fundSuccessBody", { amount: formatNaira(amount) }));
    await onSuccess();
  };

  const payWithSafehaven = async () => {
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
    onClose();
    Alert.alert(t("wallet.fundSuccess"), t("wallet.fundSuccessBody", { amount: formatNaira(amount) }));
    await onSuccess();
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
    onClose();
    Alert.alert(t("wallet.submitted"), t("wallet.submittedBody"));
    await onSuccess();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={close} />
        <View style={styles.modalCard}>
          {step === "amount" ? (
            <>
              <Text style={styles.modalTitle}>{t("wallet.fund")}</Text>
              <Text style={styles.modalMeta}>{t("wallet.fundHint")}</Text>
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
              <Pressable
                onPress={continueFunding}
                disabled={submitting}
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.fund")}
              >
                {submitting ? <JosCityLoader color={colors.white} /> : <Text style={styles.submitText}>{t("wallet.fund")}</Text>}
              </Pressable>
            </>
          ) : null}

          {step === "method" ? (
            <>
              <Text style={styles.modalTitle}>{t("wallet.fundMethods")}</Text>
              <Text style={styles.modalMeta}>
                {formatNaira(amount)}. {paystackFailed ? t("wallet.paystackFailed") : t("wallet.fundHint")}
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
                  onPress={() => setStep("manual")}
                  disabled={submitting}
                  style={({ pressed }) => [styles.methodBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.methodBtnText}>{t("wallet.manualTransfer")}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {step === "manual" ? (
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

          <Pressable
            onPress={close}
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
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
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
    pressed: {
      opacity: 0.72,
    },
  });
}
