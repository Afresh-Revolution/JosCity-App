import { useEffect, useState } from "react";
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
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import TextField from "../components/TextField";
import {
  checkActivationRequired,
  getUserProfile,
  loginBusiness,
  loginPersonal,
  requestPasswordResetOtp,
  resendActivation,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "../api/auth";
import AccountTypeToggle, { type LoginAccountType } from "../components/AccountTypeToggle";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { registerPushTokenAfterLogin } from "../push/pushNotifications";
import {
  isBusinessAccountType,
  isPersonalAccountType,
  saveSession,
} from "../storage/session";
import { colors } from "../theme/colors";
import { friendlyError } from "../utils/errors";

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

  useEffect(() => {
    if (incomingEmail) setEmail(incomingEmail);
  }, [incomingEmail]);

  useEffect(() => {
    if (incomingType === "business" || incomingType === "personal" || incomingType === "agent") setAccountType(incomingType);
  }, [incomingType]);

  useEffect(() => {
    if (accountType === "agent") {
      setActivationRequired(false);
      setTwoFactorRequired(false);
      return;
    }
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@")) {
      setActivationRequired(false);
      setTwoFactorRequired(false);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await checkActivationRequired(normalized, accountType);
      setActivationRequired(Boolean(result.activation_required));
    }, 350);

    return () => clearTimeout(timer);
  }, [accountType, email]);

  const onLogin = async () => {
    if (accountType === "agent") { router.push("/agents" as never); return; }
    setError(null);
    setMessage(null);
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const result =
        accountType === "business"
          ? await loginBusiness({ email, password, activationCode })
          : await loginPersonal({
              email,
              password,
              activationCode,
              twoFactorCode,
            });

      if (result.two_factor_required && !result.token) {
        setTwoFactorRequired(true);
        setMessage(result.message || "Enter the code sent to your email.");
        return;
      }

      if (!result.success || !result.token) {
        setError(friendlyError(result.message || "Sign in failed."));
        return;
      }

      const resolvedType = String(result.user?.account_type || accountType);
      if (accountType === "business" && !isBusinessAccountType(resolvedType)) {
        setError("That login is not a business account.");
        return;
      }
      if (accountType === "personal" && resolvedType && !isPersonalAccountType(resolvedType)) {
        setError("That login is not a personal account. Switch to Business and try again.");
        return;
      }

      const user = {
        ...(result.user || {}),
        account_type: accountType,
      };
      await saveSession({ token: result.token, accountType, user });

      const profile = await getUserProfile();
      if (profile.success && profile.user) {
        await saveSession({
          token: result.token,
          accountType,
          user: { ...user, ...profile.user, account_type: accountType },
        });
      }

      void registerPushTokenAfterLogin();
      router.replace((accountType === "business" ? "/business" : "/home") as never);
    } catch {
      setError(friendlyError("offline"));
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (accountType === "agent") return;
    setError(null);
    setMessage(null);
    setForgotLoading(true);
    try {
      if (forgotStep === "email") {
        const result = await requestPasswordResetOtp(forgotEmail, accountType);
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
    if (accountType === "agent") return;
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
              {accountType === "agent" && <Text style={styles.subtitle}>Agent login is coming soon. Explore the dashboard preview; your credentials will not be submitted.</Text>}
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
                      if (accountType === "agent") { setMessage("Agent password recovery is coming soon."); return; }
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
                <AppButton
                  label={accountType === "agent" ? "Preview agent dashboard" : "Log in"}
                  onPress={() => void onLogin()}
                  loading={loading}
                />
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
