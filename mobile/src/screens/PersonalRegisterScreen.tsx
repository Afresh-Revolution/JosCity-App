import { useMemo, useState } from "react";
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
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import TextField from "../components/TextField";
import { friendlyError } from "../utils/errors";
import { registerPersonal } from "../api/auth";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { colors } from "../theme/colors";

type Gender = "male" | "female" | "";

export default function PersonalRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralCode = (Array.isArray(params.ref) ? params.ref[0] : params.ref || "").trim();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [address, setAddress] = useState("");
  const [nin, setNin] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const labelColor = colors.primary;

  const validateStep = () => {
    if (step === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return "Enter a valid email address.";
      }
      if (phone.replace(/\s/g, "").length < 10) {
        return "Enter a valid phone number.";
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return "Use 8+ characters with a letter and a number.";
      }
      if (password !== confirm) {
        return "Passwords do not match.";
      }
    }
    if (step === 2) {
      if (firstName.trim().length < 2 || lastName.trim().length < 2) {
        return "Enter your first and last name.";
      }
    }
    if (step === 3) {
      if (nin.replace(/\D/g, "").length > 0 && nin.replace(/\D/g, "").length !== 11) {
        return "NIN must be 11 digits if you add it.";
      }
      if (!agreed) {
        return "Agree to the Terms of Service and Privacy Policy to continue.";
      }
    }
    return null;
  };

  const onContinue = async () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    setLoading(true);
    try {
      const result = await registerPersonal({
        user_firstname: firstName,
        user_lastname: lastName,
        user_gender: gender,
        user_phone: phone,
        user_email: email,
        nin_number: nin.replace(/\D/g, ""),
        address,
        user_password: password,
        referral_code: referralCode || undefined,
      });
      if (!result.success) {
        setError(friendlyError(result.message || "Registration failed."));
        return;
      }
      setDone(true);
    } catch {
      setError(friendlyError("offline"));
    } finally {
      setLoading(false);
    }
  };

  const eye = (visible: boolean, toggle: () => void) => (
    <Pressable onPress={toggle} accessibilityRole="button">
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={20}
        color={colors.textMuted}
      />
    </Pressable>
  );

  const progress = useMemo(
    () => [1, 2, 3].map((value) => value <= step),
    [step]
  );

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
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn replayKey={step} delay={40} style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (step === 1) router.back();
                else setStep((current) => current - 1);
              }}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.stepLabel}>STEP {step} OF 3</Text>
          </FadeIn>

          <FadeIn replayKey={step} delay={80} style={styles.progressRow}>
            {progress.map((filled, index) => (
              <View
                key={index}
                style={[styles.progressSeg, filled ? styles.progressOn : styles.progressOff]}
              />
            ))}
          </FadeIn>

          {done ? (
            <FadeIn delay={120}>
              <Text style={styles.title}>Account created</Text>
              <Text style={styles.subtitle}>
                Check your email for an activation code, then log in to continue with JOSCITY.
              </Text>
              <AppButton
                label="Go to login"
                onPress={() =>
                  router.replace({ pathname: "/login", params: { email } })
                }
              />
            </FadeIn>
          ) : (
            <>
              <FadeIn replayKey={step} delay={120}>
                <Text style={styles.title}>
                  {step === 1
                    ? "Account details"
                    : step === 2
                      ? "Personal information"
                      : "Verification"}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 1
                    ? "Start with how you’ll sign in to JOSCITY."
                    : step === 2
                      ? "Tell us who you are — this appears on your membership ID. Gender and address are optional."
                      : "You can add your NIN now or skip it, then agree to the terms."}
                </Text>
              </FadeIn>

              <FadeIn replayKey={step} delay={200} style={styles.form}>
                {step === 1 ? (
                  <>
                    <TextField
                      label="Email address"
                      labelColor={labelColor}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
                    />
                    <TextField
                      label="Phone number"
                      labelColor={labelColor}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="0803 000 0000"
                      left={<Ionicons name="call-outline" size={18} color={colors.textMuted} />}
                    />
                    <TextField
                      label="Password"
                      labelColor={labelColor}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="At least 8 characters"
                      helper="Use 8+ characters with a letter and a number"
                      right={eye(showPassword, () => setShowPassword((value) => !value))}
                    />
                    <TextField
                      label="Confirm password"
                      labelColor={labelColor}
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry={!showConfirm}
                      placeholder="Re-enter your password"
                      right={eye(showConfirm, () => setShowConfirm((value) => !value))}
                    />
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <TextField
                      label="First name"
                      labelColor={labelColor}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Amina"
                      autoCapitalize="words"
                      left={<Ionicons name="person-outline" size={18} color={colors.textMuted} />}
                    />
                    <TextField
                      label="Last name"
                      labelColor={labelColor}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Danjuma"
                      autoCapitalize="words"
                    />
                    <Pressable onPress={() => setGenderOpen(true)}>
                      <View pointerEvents="none">
                        <TextField
                          label="Gender (optional)"
                          labelColor={labelColor}
                          value={gender ? gender[0].toUpperCase() + gender.slice(1) : ""}
                          placeholder="Prefer not to say"
                          editable={false}
                          right={<Ionicons name="chevron-down" size={18} color={colors.textMuted} />}
                        />
                      </View>
                    </Pressable>
                    <TextField
                      label="Address (optional)"
                      labelColor={labelColor}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Street, area, Jos"
                    />
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <TextField
                      label="NIN number (optional)"
                      labelColor={labelColor}
                      value={nin}
                      onChangeText={(value) => setNin(value.replace(/[^\d]/g, "").slice(0, 11))}
                      keyboardType="number-pad"
                      placeholder="11-digit National Identification Number"
                      helper="You can skip this. If you add it, use 11 digits. JOSCITY can verify it later."
                    />
                    <Pressable
                      onPress={() => setAgreed((value) => !value)}
                      style={styles.termsRow}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: agreed }}
                    >
                      <View style={[styles.check, agreed && styles.checkOn]}>
                        {agreed ? (
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        ) : null}
                      </View>
                      <Text style={styles.termsText}>
                        I agree to the JOSCITY{" "}
                        <Text
                          style={styles.termsLink}
                          onPress={() =>
                            void openExternalUrl(LEGAL.terms)
                          }
                        >
                          Terms of Service
                        </Text>{" "}
                        and{" "}
                        <Text
                          style={styles.termsLink}
                          onPress={() =>
                            void openExternalUrl(LEGAL.privacy)
                          }
                        >
                          Privacy Policy
                        </Text>
                        , and confirm the details above are mine.
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {error ? <ErrorBanner message={error} /> : null}
              </FadeIn>

              <View style={styles.spacer} />

              <FadeIn replayKey={step} delay={280}>
                <Pressable onPress={() => router.push("/login")} style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <Text style={styles.loginLink}>Log in</Text>
                </Pressable>
                <AppButton
                  label={step === 3 ? "Create account" : "Continue"}
                  onPress={() => void onContinue()}
                  loading={loading}
                  disabled={step === 3 && !agreed}
                />
              </FadeIn>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={genderOpen} transparent animationType="fade" onRequestClose={() => setGenderOpen(false)}>
        <Pressable style={styles.pickerDim} onPress={() => setGenderOpen(false)}>
          <View style={styles.picker}>
            {(["male", "female", ""] as const).map((option) => (
              <Pressable
                key={option || "skip"}
                onPress={() => {
                  setGender(option);
                  setGenderOpen(false);
                }}
                style={styles.pickerItem}
              >
                <Text style={styles.pickerLabel}>
                  {option === "male" ? "Male" : option === "female" ? "Female" : "Prefer not to say"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 22,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  progressOn: {
    backgroundColor: colors.primary,
  },
  progressOff: {
    backgroundColor: "#E4E0D8",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 22,
  },
  form: {
    flexGrow: 0,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.fieldBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  termsLink: {
    fontFamily: "Montserrat_600SemiBold",
    color: colors.text,
    textDecorationLine: "underline",
  },
  error: {
    marginTop: 8,
    fontFamily: "Montserrat_400Regular",
    color: colors.error,
    fontSize: 13,
  },
  spacer: {
    flex: 1,
    minHeight: 18,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 14,
    flexWrap: "wrap",
  },
  loginText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
  loginLink: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  pickerDim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  picker: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 12,
    paddingBottom: 28,
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  pickerLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: colors.text,
  },
});
