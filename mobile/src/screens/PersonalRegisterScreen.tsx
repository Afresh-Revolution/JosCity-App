import { useEffect, useMemo, useRef, useState } from "react";
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
import { updateAgentPreview } from "../state/agentPreview";
import { savePendingAgentApplication } from "../storage/pendingAgent";
import { DEFAULT_AGENT_SERVICES, HELP_ME_BUY, HELP_ME_DELIVER, toggleAgentServices } from "../api/agentSignup";
import { clearSignupDraft, loadSignupDraft, saveSignupDraft } from "../storage/signupDraft";
import TextField from "../components/TextField";
import { friendlyError } from "../utils/errors";
import { registerPersonal } from "../api/auth";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

type Gender = "male" | "female" | "";

export default function PersonalRegisterScreen({ agent = false }: { agent?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralCode = (Array.isArray(params.ref) ? params.ref[0] : params.ref || "").trim();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [agentBio, setAgentBio] = useState("");
  const [agentCategories, setAgentCategories] = useState("");
  const [services, setServices] = useState(DEFAULT_AGENT_SERVICES);
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
  const draftReady = useRef(false);
  const skipDraftSave = useRef(false);

  useEffect(() => {
    let active = true;
    void loadSignupDraft().then((draft) => {
      if (!active) return;
      if (draft && (agent ? draft.kind === "agent" : draft.kind === "personal")) {
        setStep(Math.min(3, Math.max(1, draft.step || 1)));
        setEmail(draft.email || "");
        setPhone(draft.phone || "");
        setPassword(draft.password || "");
        setConfirm(draft.confirm || "");
        setFirstName(draft.firstName || "");
        setLastName(draft.lastName || "");
        setGender((draft.gender === "male" || draft.gender === "female" ? draft.gender : "") as Gender);
        setAddress(draft.address || "");
        setNin(draft.nin || "");
        setAgreed(Boolean(draft.agreed));
        setAgentBio(draft.agentBio || "");
        setAgentCategories(draft.agentCategories || "");
        if (draft.services?.length) {
          const next = [...draft.services];
          if (next.includes(HELP_ME_BUY) && !next.includes(HELP_ME_DELIVER)) next.push(HELP_ME_DELIVER);
          setServices(next);
        }
      }
      draftReady.current = true;
    });
    return () => {
      active = false;
    };
  }, [agent]);

  useEffect(() => {
    if (!draftReady.current || done || skipDraftSave.current) return;
    void saveSignupDraft({
      kind: agent ? "agent" : "personal",
      step,
      email,
      phone,
      password,
      confirm,
      firstName,
      lastName,
      gender,
      address,
      nin,
      agreed,
      agentBio,
      agentCategories,
      services,
    });
  }, [agent, step, email, phone, password, confirm, firstName, lastName, gender, address, nin, agreed, agentBio, agentCategories, services, done]);

  const labelColor = colors.primary;

  const validateStep = () => {
    if (step === 1) {
      if (agent && !agentBio.trim()) {
        return "Tell customers how you can help.";
      }
      if (agent && !agentCategories.trim()) {
        return "Add at least one category or specialty.";
      }
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
    if (agent && step === 1 && services.length === 0) {
      setError("Choose Help me buy, Help me deliver, or both.");
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
        signup_intent: agent ? "agent" : "personal",
      });
      if (!result.success) {
        setError(friendlyError(result.message || "Registration failed."));
        return;
      }
      if (agent) {
        const pending = {
          bio: agentBio,
          category: agentCategories,
          services: services.map((s) =>
            s.toLowerCase().includes("deliver") ? "Help me deliver" : "Help me buy"
          ),
          nin: nin.replace(/\D/g, ""),
        };
        await savePendingAgentApplication(pending);
        updateAgentPreview({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone,
          gender,
          address,
          bio: pending.bio,
          category: pending.category,
          services: pending.services,
          nin: pending.nin,
        });
      }
      skipDraftSave.current = true;
      await clearSignupDraft();
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
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
          keyboardShouldPersistTaps="always"
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
                {agent
                  ? "Check your email for an activation code, then log in as an agent. Your services, specialties and NIN from this page are already saved."
                  : "Check your email for an activation code, then log in to continue with JOSCITY."}
              </Text>
              <AppButton
                label="Go to login"
                onPress={() =>
                  router.replace({ pathname: "/login", params: { email, type: agent ? "agent" : "personal" } })
                }
              />
            </FadeIn>
          ) : (
            <>
              <FadeIn replayKey={step} delay={120}>
                <Text style={styles.title}>
                  {step === 1
                    ? agent ? "Agent account" : "Account details"
                    : step === 2
                      ? "Personal information"
                      : "Verification"}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 1
                    ? agent
                      ? "Create your JosCity agent account with the services and specialties you already offer."
                      : "Start with how you’ll sign in to JOSCITY."
                    : step === 2
                      ? "Tell us who you are — this appears on your membership ID. Gender and address are optional."
                      : "You can add your NIN now or skip it, then agree to the terms."}
                </Text>
              </FadeIn>

              {agent ? <View>
                <TextField label="Agent bio" labelColor={labelColor} value={agentBio} onChangeText={setAgentBio} placeholder="Tell customers how you can help" multiline />
                <TextField label="Categories / specialties" labelColor={labelColor} value={agentCategories} onChangeText={setAgentCategories} placeholder="Electronics, groceries, fashion..." />
                <Text style={styles.subtitle}>Help me buy also includes Help me deliver.</Text>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                  {[HELP_ME_BUY, HELP_ME_DELIVER].map(service => <Pressable key={service} accessibilityRole="checkbox" accessibilityState={{ checked: services.includes(service) }} onPress={() => setServices(current => toggleAgentServices(current, service))} style={{ flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: services.includes(service) ? colors.iconSoft : colors.card, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.primary, fontFamily: "Montserrat_600SemiBold" }}>{services.includes(service) ? "✓ " : ""}{service}</Text>
                  </Pressable>)}
                </View>
              </View> : null}
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
                <Pressable onPress={() => router.push({ pathname: "/login", params: { type: agent ? "agent" : "personal" } })} style={styles.loginRow}>
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.cream,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
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
    color: c.textMuted,
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
    backgroundColor: c.primary,
  },
  progressOff: {
    backgroundColor: c.fieldBorder,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: c.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: c.textMuted,
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
    borderColor: c.fieldBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  termsText: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: c.textMuted,
  },
  termsLink: {
    fontFamily: "Montserrat_600SemiBold",
    color: c.text,
    textDecorationLine: "underline",
  },
  error: {
    marginTop: 8,
    fontFamily: "Montserrat_400Regular",
    color: c.error,
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
    color: c.textMuted,
  },
  loginLink: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: c.text,
  },
  pickerDim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  picker: {
    backgroundColor: c.card,
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
    color: c.text,
  },
});
}
