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
import { checkActivationRequired, loginBusiness, loginPersonal } from "../api/auth";
import { useI18n } from "../i18n/I18nProvider";
import {
  isBusinessAccountType,
  isPersonalAccountType,
  type StoredSession,
} from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import AppButton from "./AppButton";
import TextField from "./TextField";

type Props = {
  visible: boolean;
  initialEmail?: string;
  mode?: "business" | "personal";
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
  const personal = mode === "personal";

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
  }, [initialEmail, visible]);

  useEffect(() => {
    if (!visible) return;
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@")) {
      setActivationRequired(false);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await checkActivationRequired(normalized, personal ? "personal" : "business");
      setActivationRequired(Boolean(result.activation_required));
    }, 350);
    return () => clearTimeout(timer);
  }, [email, personal, visible]);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError(t(personal ? "profile.personalLoginMissing" : "profile.businessLoginMissing"));
      return;
    }

    setLoading(true);
    try {
      if (personal) {
        const result = await loginPersonal({
          email,
          password,
          activationCode,
          twoFactorCode,
        });
        if (result.two_factor_required && !result.token) {
          setTwoFactorRequired(true);
          setError(friendlyError(result.message || t("profile.personalTwoFactorHint")));
          return;
        }
        if (!result.success || !result.token) {
          setError(friendlyError(result.message || t("profile.personalLoginFailed")));
          return;
        }

        const incomingType = result.user?.account_type;
        if (incomingType && !isPersonalAccountType(String(incomingType))) {
          setError(t("profile.personalLoginNotPersonal"));
          return;
        }

        await onLinked({
          token: result.token,
          accountType: "personal",
          user: {
            ...(result.user || {}),
            account_type: "personal",
          },
        });
        return;
      }

      const result = await loginBusiness({
        email,
        password,
        activationCode,
      });
      if (!result.success || !result.token) {
        setError(friendlyError(result.message || t("profile.businessLoginFailed")));
        return;
      }

      const incomingType = result.user?.account_type;
      if (incomingType && !isBusinessAccountType(String(incomingType))) {
        setError(t("profile.businessLoginNotBusiness"));
        return;
      }

      await onLinked({
        token: result.token,
        accountType: "business",
        user: {
          ...(result.user || {}),
          account_type: "business",
        },
      });
    } catch {
      setError(t(personal ? "profile.personalLoginNetwork" : "profile.businessLoginNetwork"));
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>
              {t(personal ? "profile.personalSheetTitle" : "profile.businessSheetTitle")}
            </Text>
            <Text style={styles.subtitle}>
              {t(personal ? "profile.personalSheetBody" : "profile.businessSheetBody")}
            </Text>

            <TextField
              label={t(personal ? "profile.personalEmail" : "profile.businessEmail")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={personal ? "you@example.com" : "business@example.com"}
              left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
            />
            <TextField
              label={t("profile.businessPassword")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              placeholder={t(
                personal ? "profile.personalPasswordHint" : "profile.businessPasswordHint"
              )}
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
            {personal && twoFactorRequired ? (
              <TextField
                label={t("profile.personalTwoFactor")}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                keyboardType="number-pad"
                placeholder={t("profile.personalTwoFactorHint")}
              />
            ) : null}

            {error ? <ErrorBanner message={error} /> : null}

            <AppButton
              label={t("profile.businessContinue")}
              onPress={() => void onSubmit()}
              loading={loading}
            />
            <Pressable
              onPress={() => {
                onClose();
                router.push(personal ? "/register/personal" : "/register/business");
              }}
              style={styles.create}
              accessibilityRole="button"
            >
              <Text style={styles.createText}>
                {t(personal ? "profile.personalCreate" : "profile.businessCreate")}
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
    error: {
      marginBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.error,
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
