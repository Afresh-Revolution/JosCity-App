import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import BiometricScanButton from "../components/BiometricScanButton";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import TextField from "../components/TextField";
import {
  checkActivationRequired,
  getUserProfile,
  loginBusiness,
  loginPersonal,
  loginAgent,
  requestPasswordResetOtp,
  resendActivation,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "../api/auth";
import AccountTypeToggle, { type LoginAccountType } from "../components/AccountTypeToggle";
import BiometricSetupSheet from "../components/BiometricSetupSheet";
import { LEGAL, openExternalUrl } from "../constants/legal";
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricStatus,
  unlockBiometricCredentials,
  type BiometricStatus,
} from "../biometrics/biometrics";
import { shouldOfferBiometricSetup, type BiometricKind } from "../biometrics/logic";
import { registerPushTokenAfterLogin } from "../push/pushNotifications";
import {
  homeRouteForAccount,
  loginMatchesAccount,
  loginMismatchMessage,
  mergeStoredUser,
  saveSession,
  type AccountType,
} from "../storage/session";
import { colors } from "../theme/colors";
import { friendlyError } from "../utils/errors";
import { isStoreReviewEmail } from "../utils/storeReviewAccounts";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[]; type?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const incomingEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const incomingType = Array.isArray(params.type) ? params.type[0] : params.type;
  const [accountType, setAccountType] = useState<LoginAccountType>(
    incomingType === "agent" ? "agent" : incomingType === "business" ? "business" : "personal"
  );
  const [email, setEmail] = useState(incomingEmail ?? "");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activationRequired, setActivationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "password">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMode, setSetupMode] = useState<"setup" | "update">("setup");
  const [setupKind, setSetupKind] = useState<BiometricKind>("generic");
  const [setupEmail, setSetupEmail] = useState("");
  const autoPrompted = useRef(false);
  const pendingSetup = useRef<{
    email: string;
    password: string;
    accountType: AccountType;
    home: ReturnType<typeof homeRouteForAccount>;
  } | null>(null);

  useEffect(() => {
    if (incomingEmail) setEmail(incomingEmail);
  }, [incomingEmail]);

  useEffect(() => {
    if (incomingType === "business" || incomingType === "personal" || incomingType === "agent") setAccountType(incomingType);
  }, [incomingType]);

  useEffect(() => {
    let active = true;
    void getBiometricStatus().then((status) => {
      if (!active) return;
      setBiometric(status);
      if (status.hint?.email && !incomingEmail) setEmail(status.hint.email);
      if (status.hint?.accountType && !incomingType) setAccountType(status.hint.accountType);
    });
    return () => {
      active = false;
    };
  }, [incomingEmail, incomingType]);

  useEffect(() => {
    if (!biometric?.enabled || !biometric.available || !biometric.enrolled || forgot || autoPrompted.current) return;
    if (incomingEmail && biometric.hint?.email && incomingEmail.toLowerCase() !== biometric.hint.email) return;
    autoPrompted.current = true;
    const timer = setTimeout(() => {
      void onBiometricLogin();
    }, 450);
    return () => clearTimeout(timer);
  }, [biometric, forgot, incomingEmail]);

  useEffect(() => {
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@")) {
      setActivationRequired(false);
      setTwoFactorRequired(false);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await checkActivationRequired(
        normalized,
        accountType
      );
      setActivationRequired(Boolean(result.activation_required));
    }, 350);

    return () => clearTimeout(timer);
  }, [accountType, email]);

  const goHome = (route: ReturnType<typeof homeRouteForAccount>) => {
    void registerPushTokenAfterLogin();
    router.replace(route as never);
  };

  const maybeOfferBiometrics = async (input: {
    email: string;
    password: string;
    accountType: AccountType;
    home: ReturnType<typeof homeRouteForAccount>;
  }) => {
    const status = await getBiometricStatus();
    setBiometric(status);
    const offer = shouldOfferBiometricSetup({
      available: status.available,
      enrolled: status.enrolled,
      enabled: status.enabled,
      enabledEmail: status.hint?.email,
      currentEmail: input.email,
    });
    if (offer === "none") {
      goHome(input.home);
      return;
    }
    pendingSetup.current = input;
    setSetupKind(status.kind);
    setSetupMode(offer);
    setSetupEmail(input.email);
    setSetupOpen(true);
  };

  const onLogin = async (override?: { email: string; password: string; accountType: LoginAccountType }) => {
    setError(null);
    setMessage(null);
    const loginEmail = (override?.email ?? email).trim();
    const loginPassword = override?.password ?? password;
    const loginType = override?.accountType ?? accountType;
    if (!loginEmail || !loginPassword.trim()) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      let result =
        loginType === "business"
          ? await loginBusiness({ email: loginEmail, password: loginPassword, activationCode })
          : loginType === "agent"
            ? await loginAgent({
                email: loginEmail,
                password: loginPassword,
                activationCode,
                twoFactorCode,
              })
            : await loginPersonal({
                email: loginEmail,
                password: loginPassword,
                activationCode,
                twoFactorCode,
              });

      if (result.two_factor_required && !result.token) {
        setAccountType(loginType);
        setEmail(loginEmail);
        setPassword(loginPassword);
        setTwoFactorRequired(true);
        setMessage(result.message || "Enter the code sent to your email.");
        return;
      }

      if (!result.success || !result.token) {
        if (override) {
          await disableBiometricLogin();
          setBiometric(await getBiometricStatus());
          setError("Biometric sign-in is out of date. Enter your password.");
          return;
        }
        setError(friendlyError(result.message || "Sign in failed."));
        return;
      }

      const sessionType: AccountType =
        loginType === "agent" ? "agent" : loginType === "business" ? "business" : "personal";
      const profile = await getUserProfile({ token: result.token, skipUnauthorized: true });
      const mergedUser = mergeStoredUser(result.user, {
        ...(profile.user || {}),
        signup_intent: result.user?.signup_intent || profile.user?.signup_intent,
        agent_type: result.user?.agent_type || profile.user?.agent_type,
        agent_status: result.user?.agent_status || profile.user?.agent_status,
      });
      const resolvedType = String(mergedUser.account_type || sessionType);
      if (!loginMatchesAccount(sessionType, mergedUser, resolvedType)) {
        setError(loginMismatchMessage(sessionType));
        return;
      }

      const storedType: AccountType = loginType === "agent" ? "agent" : sessionType;
      const user = {
        ...mergedUser,
        account_type: storedType,
      };
      await saveSession({ token: result.token, accountType: storedType, user });
      await maybeOfferBiometrics({
        email: loginEmail,
        password: loginPassword,
        accountType: loginType === "agent" ? "agent" : storedType,
        home: homeRouteForAccount(loginType === "agent" ? "agent" : storedType),
      });
    } catch {
      setError(friendlyError("offline"));
    } finally {
      setLoading(false);
    }
  };

  const onBiometricLogin = async () => {
    if (biometricBusy || loading || forgot) return;
    setError(null);
    setMessage(null);
    setBiometricBusy(true);
    try {
      const unlocked = await unlockBiometricCredentials();
      if (!unlocked.success || !unlocked.credentials) {
        setError(unlocked.message || "Biometric sign-in was cancelled.");
        setBiometric(await getBiometricStatus());
        return;
      }
      if (unlocked.credentials.accountType !== accountType) {
        setError("Those biometrics belong to a different account type. Sign in with that account's email and password.");
        return;
      }
      setAccountType(unlocked.credentials.accountType);
      setEmail(unlocked.credentials.email);
      await onLogin(unlocked.credentials);
    } finally {
      setBiometricBusy(false);
    }
  };

  const finishSetup = (route?: ReturnType<typeof homeRouteForAccount>) => {
    const home = route || pendingSetup.current?.home || "/home";
    pendingSetup.current = null;
    setSetupOpen(false);
    goHome(home);
  };

  const onEnableBiometrics = async () => {
    const pending = pendingSetup.current;
    if (!pending) {
      finishSetup();
      return;
    }
    setSetupBusy(true);
    const result = await enableBiometricLogin({
      email: pending.email,
      password: pending.password,
      accountType: pending.accountType,
    });
    setSetupBusy(false);
    if (!result.success) {
      setError(result.message || "Could not turn on biometric sign-in.");
      return;
    }
    finishSetup(pending.home);
  };

  const onForgot = async () => {
    setError(null);
    setMessage(null);
    setForgotLoading(true);
    try {
      if (forgotStep === "email") {
        const result = await requestPasswordResetOtp(
          forgotEmail,
          accountType === "business" ? "business" : "personal"
        );
        if (!result.success) {
          setError(friendlyError(result.message || "Could not send reset code."));
          return;
        }
        setMessage("If the email exists, an OTP has been sent. It expires in 5 minutes.");
        setForgotStep("otp");
      } else if (forgotStep === "otp") {
        const result = await verifyPasswordResetOtp(forgotEmail, forgotOtp);
        if (!result.success) {
          setError(friendlyError(result.message || "Invalid or expired OTP."));
          return;
        }
        setMessage("OTP verified. Set your new password.");
        setForgotStep("password");
      } else {
        if (!forgotPassword.trim()) {
          setError("New password is required.");
          return;
        }
        const result = await resetPasswordWithOtp(
          forgotEmail,
          forgotOtp,
          forgotPassword
        );
        if (!result.success) {
          setError(friendlyError(result.message || "Could not reset password."));
          return;
        }
        setEmail(forgotEmail);
        setPassword("");
        setForgot(false);
        setForgotStep("email");
        setMessage("Password reset successful. Please sign in.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const onResendActivation = async () => {
    setError(null);
    setMessage(null);
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@")) {
      setError("Enter your email first to resend the activation code.");
      return;
    }

    setResendLoading(true);
    try {
      const result = await resendActivation(normalized, accountType);
      if (!result.success) {
        setError(friendlyError(result.message || "Could not resend the activation code."));
        return;
      }
      setMessage(result.message || "A new activation code has been sent to your email.");
    } catch {
      setError(friendlyError("offline"));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn delay={40}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          </FadeIn>

          <FadeIn delay={120}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to continue with JOSCITY.</Text>
            <View style={styles.toggle}>
              <AccountTypeToggle value={accountType} onChange={(value) => {
                setAccountType(value);
                setError(null);
                setMessage(null);
                setActivationRequired(false);
                setTwoFactorRequired(false);
                setActivationCode("");
                setTwoFactorCode("");
                setForgot(false);
              }} />
              
            </View>
          </FadeIn>

          {forgot ? (
            <>
              <FadeIn delay={240} style={styles.form}>
                {forgotStep === "email" ? (
                  <TextField
                    label="Email address"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={accountType === "business" ? "business@example.com" : "you@example.com"}
                    left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
                  />
                ) : null}
                {forgotStep === "otp" ? (
                  <TextField
                    label="OTP"
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    keyboardType="number-pad"
                    placeholder="Enter the code from your email"
                  />
                ) : null}
                {forgotStep === "password" ? (
                  <TextField
                    label="New password"
                    value={forgotPassword}
                    onChangeText={setForgotPassword}
                    secureTextEntry
                    placeholder="Enter a new password"
                  />
                ) : null}
                {error ? <ErrorBanner message={error} /> : null}
                {message ? <Text style={styles.success}>{message}</Text> : null}
                <AppButton
                  label={forgotStep === "password" ? "Reset password" : "Continue"}
                  onPress={() => void onForgot()}
                  loading={forgotLoading}
                />
                <Pressable
                  onPress={() => {
                    setForgot(false);
                    setError(null);
                    setMessage(null);
                  }}
                  style={styles.forgotBack}
                >
                  <Text style={styles.forgotLabel}>Back to login</Text>
                </Pressable>
              </FadeIn>
            </>
          ) : (
            <>
              <FadeIn delay={240} style={styles.form}>
                <TextField
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="you@example.com"
                  left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  placeholder="Enter your password"
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
                    label="Activation code"
                    value={activationCode}
                    onChangeText={setActivationCode}
                    autoCapitalize="characters"
                    placeholder="Enter the code from your email"
                  />
                ) : null}
                {twoFactorRequired ? (
                  <TextField
                    label="Sign-in code"
                    value={twoFactorCode}
                    onChangeText={setTwoFactorCode}
                    keyboardType="number-pad"
                    placeholder="6-digit email code"
                  />
                ) : null}
                <View style={styles.actionsRow}>
                  {activationRequired ? (
                    <Pressable
                      onPress={() => void onResendActivation()}
                      disabled={resendLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Resend activation code"
                      style={styles.resend}
                    >
                      <Text style={[styles.forgotLabel, resendLoading && styles.resendBusy]}>
                        {resendLoading ? "Resending..." : "Resend code"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    onPress={() => {
                      if (accountType === "agent") {
                        setForgot(true);
                        setForgotEmail(email);
                        setForgotStep("email");
                        setError(null);
                        setMessage(null);
                        return;
                      }
                      setForgot(true);
                      setForgotEmail(email);
                      setForgotStep("email");
                      setError(null);
                      setMessage(null);
                    }}
                    style={styles.forgot}
                  >
                    <Text style={styles.forgotLabel}>Forgot password?</Text>
                  </Pressable>
                </View>
                {error ? <ErrorBanner message={error} /> : null}
                {message ? <Text style={styles.success}>{message}</Text> : null}
                <View style={styles.loginRow}>
                  <AppButton
                    label="Log in"
                    onPress={() => void onLogin()}
                    loading={loading}
                    disabled={biometricBusy}
                    style={styles.loginBtn}
                  />
                  {biometric?.enabled && biometric.available ? (
                    <BiometricScanButton
                      kind={biometric.kind}
                      busy={biometricBusy}
                      disabled={loading}
                      onPress={() => void onBiometricLogin()}
                    />
                  ) : null}
                </View>
              </FadeIn>

              <FadeIn delay={440} style={styles.footer}>
                <Text style={styles.footerText}>New to JOSCITY? </Text>
                <Pressable onPress={() => router.push({ pathname: "/welcome", params: { join: "1" } })}>
                  <Text style={styles.footerLink}>Create an account</Text>
                </Pressable>
              </FadeIn>
              <FadeIn delay={500} style={styles.legalFooter}>
                <Text style={styles.legalText}>
                  By continuing you agree to the JOSCITY{" "}
                  <Text style={styles.legalLink} onPress={() => void openExternalUrl(LEGAL.terms)}>
                    Terms
                  </Text>{" "}
                  and{" "}
                  <Text style={styles.legalLink} onPress={() => void openExternalUrl(LEGAL.privacy)}>
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </FadeIn>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BiometricSetupSheet
        visible={setupOpen}
        busy={setupBusy}
        kind={setupKind}
        mode={setupMode}
        email={setupEmail}
        onEnable={() => void onEnableBiometrics()}
        onSkip={() => finishSetup()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 18,
  },
  toggle: {
    marginBottom: 4,
  },
  form: {
    marginTop: 18,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginBtn: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  resend: {
    paddingVertical: 4,
  },
  forgot: {
    paddingVertical: 4,
    marginLeft: "auto",
  },
  forgotBack: {
    alignSelf: "flex-end",
    marginTop: 14,
  },
  forgotLabel: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.text,
  },
  resendBusy: {
    opacity: 0.6,
  },
  error: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.error,
    marginBottom: 12,
  },
  success: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.success,
    marginBottom: 12,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 28,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  footerText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  footerLink: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  legalFooter: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  legalText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: "center",
  },
  legalLink: {
    fontFamily: "Montserrat_700Bold",
    color: colors.text,
  },
});
