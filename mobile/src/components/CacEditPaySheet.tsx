import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "./JosCityLoader";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import {
  getCacEditState,
  startCacEditPaystack,
  startCacEditSafehaven,
  submitCacEditManual,
  verifyCacEditPaystack,
  verifyCacEditSafehaven,
  type CacEditState,
} from "../api/cacEdit";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { formatNaira } from "../utils/format";
import { isPaystackFundingEnabled } from "../utils/paystackFunding";

export default function CacEditPaySheet({
  open,
  state,
  onClose,
  onUpdated,
}: {
  open: boolean;
  state: CacEditState | null;
  onClose: () => void;
  onUpdated: (next: CacEditState) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<"methods" | "manual">("methods");
  const [submitting, setSubmitting] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);

  const funding = state?.funding;
  const amount = Number(state?.next_price || 0);
  const paystackOn = isPaystackFundingEnabled(funding);
  const safehavenOn = Boolean(funding?.safehaven?.enabled);
  const manualOn = Boolean(funding?.manual?.enabled);

  const close = () => {
    if (submitting) return;
    setStep("methods");
    setProofUri(null);
    onClose();
  };

  const refresh = async () => {
    const next = await getCacEditState();
    if (next.success && next.data) onUpdated(next.data);
  };

  const openCheckout = async (url?: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url, { enableDefaultShareMenuItem: false });
    } catch {
      await Linking.openURL(url);
    }
  };

  const payPaystack = async () => {
    setSubmitting(true);
    const started = await startCacEditPaystack();
    if (!started.success || !started.data?.authorization_url) {
      setSubmitting(false);
      Alert.alert(t("details.cacPayError"), started.message || t("wallet.paystackFailed"));
      return;
    }
    await openCheckout(started.data.authorization_url);
    const verified = await verifyCacEditPaystack(started.data.reference);
    setSubmitting(false);
    if (!verified.success) {
      Alert.alert(t("details.cacPayError"), verified.message || t("wallet.paystackFailed"));
      return;
    }
    await refresh();
    close();
    Alert.alert(t("details.cacPaySentTitle"), verified.message || t("details.cacPaySentBody"));
  };

  const paySafehaven = async () => {
    setSubmitting(true);
    const started = await startCacEditSafehaven();
    if (!started.success || !started.data?.authorization_url) {
      setSubmitting(false);
      Alert.alert(t("details.cacPayError"), started.message || t("wallet.tryAgain"));
      return;
    }
    await openCheckout(started.data.authorization_url);
    const verified = await verifyCacEditSafehaven(started.data.reference);
    setSubmitting(false);
    if (!verified.success) {
      Alert.alert(t("details.cacPayError"), verified.message || t("wallet.tryAgain"));
      return;
    }
    await refresh();
    close();
    Alert.alert(t("details.cacPaySentTitle"), verified.message || t("details.cacPaySentBody"));
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
  };

  const submitManual = async () => {
    if (!proofUri) {
      Alert.alert(t("details.cacPayError"), t("wallet.attachProof"));
      return;
    }
    setSubmitting(true);
    const result = await submitCacEditManual({ uri: proofUri });
    setSubmitting(false);
    if (!result.success) {
      Alert.alert(t("details.cacPayError"), result.message || t("wallet.tryAgain"));
      return;
    }
    await refresh();
    close();
    Alert.alert(t("details.cacPaySentTitle"), result.message || t("details.cacPaySentBody"));
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={close} />
        <View style={styles.modalCard}>
          {step === "methods" ? (
            <>
              <Text style={styles.modalTitle}>{t("details.cacUnlockTitle")}</Text>
              <Text style={styles.modalMeta}>
                {t("details.cacUnlockBody", { amount: formatNaira(amount) })}
              </Text>
              {paystackOn ? (
                <Pressable
                  onPress={() => void payPaystack()}
                  disabled={submitting}
                  style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                >
                  {submitting ? (
                    <JosCityLoader color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>{t("wallet.paystack")}</Text>
                  )}
                </Pressable>
              ) : null}
              {safehavenOn ? (
                <Pressable
                  onPress={() => void paySafehaven()}
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
              {!paystackOn && !safehavenOn && !manualOn ? (
                <Text style={styles.modalMeta}>{t("details.cacPayUnavailable")}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>{t("wallet.manualTransfer")}</Text>
              <Text style={styles.modalMeta}>
                {t("details.cacManualHint", { amount: formatNaira(amount) })}
              </Text>
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
                {submitting ? (
                  <JosCityLoader color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>{t("wallet.submitProof")}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
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
      marginBottom: 8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    submitBtn: {
      marginTop: 12,
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
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    copyLink: {
      marginTop: 8,
      fontFamily: "Montserrat_700Bold",
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
