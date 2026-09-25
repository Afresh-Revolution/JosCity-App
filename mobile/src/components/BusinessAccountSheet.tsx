import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ErrorBanner } from "./AppNotice";
import { friendlyError } from "../utils/errors";
import { isStoreReviewEmail } from "../utils/storeReviewAccounts";
import { checkActivationRequired, loginBusiness, loginPersonal } from "../api/auth";
import { useI18n } from "../i18n/I18nProvider";
import {
  loginMatchesAccount,
  loginMismatchMessage,
  type AccountType,
  type StoredSession,
} from "../storage/session";
import {
  getBiometricStatus,
  unlockBiometricCredentials,
  type BiometricStatus,
} from "../biometrics/biometrics";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import AppButton from "./AppButton";
import BiometricScanButton from "./BiometricScanButton";
import TextField from "./TextField";

type Props = {
  visible: boolean;
  initialEmail?: string;
  mode?: AccountType;
  onClose: () => void;
  onLinked: (session: StoredSession) => void | Promise<void>;
};

export default function BusinessAccountSheet({
  visible,
  initialEmail = "",
  mode = "business",
  onClose,
  onLinked,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activationRequired, setActivationRequired] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const titleKey = mode === "personal" ? "profile.personalSheetTitle" : mode === "agent" ? "profile.agentSheetTitle" : "profile.businessSheetTitle";
  const bodyKey = mode === "personal" ? "profile.personalSheetBody" : mode === "agent" ? "profile.agentSheetBody" : "profile.businessSheetBody";
  const emailKey = mode === "business" ? "profile.businessEmail" : "profile.personalEmail";
  const canUseBiometrics = Boolean(
    biometric?.enabled && biometric.available && biometric.enrolled && biometric.hint?.accountType === mode
  );

  useEffect(() => {
    if (!visible) return;
    setEmail(initialEmail);
    setPassword("");
    setActivationCode("");
    setTwoFactorCode("");
    setShowPassword(false);
    setActivationRequired(false);
    setTwoFactorRequired(false);
    setError(null);
    setLoading(false);
    setBiometricBusy(false);
    void getBiometricStatus().then(setBiometric);
  }, [initialEmail, visible, mode]);

  useEffect(() => {
    if (!visible) return;
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@")) {
      setActivationRequired(false);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await checkActivationRequired(normalized, mode === "business" ? "business" : "personal");
      setActivationRequired(Boolean(result.activation_required));
    }, 350);
    return () => clearTimeout(timer);
  }, [email, mode, visible]);

  const finishLogin = async (params: { email: string; password: string }) => {
    setError(null);
    if (!params.email.trim() || !params.password.trim()) {
      setError(t(mode === "business" ? "profile.businessLoginMissing" : mode === "agent" ? "profile.agentLoginMissing" : "profile.personalLoginMissing"));
      return false;
    }
    const result = mode === "business"
      ? await loginBusiness({ email: params.email, password: params.password, activationCode })
      : await loginPersonal({
          email: params.email,
          password: params.password,
          activationCode,
          twoFactorCode,
        });
    if (result.two_factor_required && !result.token) {
      setTwoFactorRequired(true);
      setError(friendlyError(result.message || t("profile.personalTwoFactorHint")));
      return false;
    }
    if (!result.success || !result.token) {
      setError(friendlyError(result.message || t(mode === "business" ? "profile.businessLoginFailed" : mode === "agent" ? "profile.agentLoginFailed" : "profile.personalLoginFailed")));
      return false;
    }
    if (!loginMatchesAccount(mode, result.user, result.user?.account_type)) {
      setError(loginMismatchMessage(mode));
      return false;
    }
    await onLinked({
      token: result.token,
      accountType: mode,
      user: { ...(result.user || {}), account_type: mode },
    });
    return true;
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      await finishLogin({ email, password });
    } catch {
      setError(t(mode === "business" ? "profile.businessLoginNetwork" : "profile.personalLoginNetwork"));
    } finally {
      setLoading(false);
    }
  };

  const onBiometric = async () => {
    if (biometricBusy || loading) return;
    setError(null);
    setBiometricBusy(true);
    try {
      const unlocked = await unlockBiometricCredentials();
      if (!unlocked.success || !unlocked.credentials) {
        setError(unlocked.message || "Biometric sign-in was cancelled.");
        setBiometric(await getBiometricStatus());
        return;
      }
      if (unlocked.credentials.accountType !== mode) {
        setError("Those biometrics belong to a different account type. Sign in with email and password.");
        return;
      }
      setEmail(unlocked.credentials.email);
      await finishLogin({ email: unlocked.credentials.email, password: unlocked.credentials.password });
    } catch {
      setError(t("profile.personalLoginNetwork"));
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel={t("common.close")} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.title}>{t(titleKey)}</Text>
            <Text style={styles.subtitle}>{t(bodyKey)}</Text>

            <TextField
              label={t(emailKey)}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={mode === "business" ? "business@example.com" : "you@example.com"}
              left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
            />
            <TextField
              label={t("profile.businessPassword")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              placeholder={t(mode === "business" ? "profile.businessPasswordHint" : "profile.personalPasswordHint")}
              right={
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              }
            />
            {activationRequired ? (
              <TextField
                label={t("profile.businessActivation")}
                value={activationCode}
                onChangeText={setActivationCode}
                autoCapitalize="characters"
                placeholder={t("profile.businessActivationHint")}
              />
            ) : null}
            {mode !== "business" && twoFactorRequired ? (
              <TextField
                label={t("profile.personalTwoFactor")}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                keyboardType="number-pad"
                placeholder={t("profile.personalTwoFactorHint")}
              />
            ) : null}

            {error ? <ErrorBanner message={error} /> : null}

            <View style={styles.actions}>
              <AppButton
                label={t("profile.businessContinue")}
                onPress={() => void onSubmit()}
                loading={loading}
                disabled={biometricBusy}
                style={styles.continue}
              />
              {canUseBiometrics ? (
                <BiometricScanButton
                  kind={biometric?.kind}
                  busy={biometricBusy}
                  disabled={loading}
                  onPress={() => void onBiometric()}
                />
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                onClose();
                router.push(mode === "personal" ? "/register/personal" : mode === "agent" ? "/register/agent" : "/register/business");
              }}
              style={styles.create}
              accessibilityRole="button"
            >
              <Text style={styles.createText}>
                {t(mode === "personal" ? "profile.personalCreate" : mode === "agent" ? "profile.agentCreate" : "profile.businessCreate")}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    dim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.48)",
    },
    sheet: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: "88%",
    },
    handle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 18,
    },
    content: {
      paddingBottom: 8,
    },
    title: {
      fontFamily: "PlayfairDisplay_700Bold",
      fontSize: 26,
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 18,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    continue: {
      flex: 1,
    },
    create: {
      alignItems: "center",
      paddingVertical: 16,
    },
    createText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.primary,
    },
  });
}
