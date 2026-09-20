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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import TextField from "../components/TextField";
import { friendlyError } from "../utils/errors";
import { fetchBusinessCategories, registerBusiness } from "../api/auth";
import {
  BUSINESS_CATEGORIES,
  type BusinessCategory,
} from "../constants/businessCategories";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { colors } from "../theme/colors";
import { clearSignupDraft, loadSignupDraft, saveSignupDraft } from "../storage/signupDraft";

export default function BusinessRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cac, setCac] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [categories, setCategories] = useState<BusinessCategory[]>(BUSINESS_CATEGORIES);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const draftReady = useRef(false);
  const skipDraftSave = useRef(false);

  const labelColor = colors.primary;
  const selectedType = categories.find((item) => item.slug === businessType);

  useEffect(() => {
    let cancelled = false;
    void fetchBusinessCategories().then((items) => {
      if (!cancelled && items.length > 0) setCategories(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadSignupDraft().then((draft) => {
      if (!active) return;
      if (draft?.kind === "business") {
        setStep(Math.min(4, Math.max(1, draft.step || 1)));
        setBusinessName(draft.businessName || "");
        setBusinessType(draft.businessType || "");
        setDescription(draft.description || "");
        setAddress(draft.address || "");
        setEmail(draft.email || "");
        setPhone(draft.phone || "");
        setPassword(draft.password || "");
        setConfirm(draft.confirm || "");
        setCac(draft.cac || "");
        setAgreed(Boolean(draft.agreed));
      }
      draftReady.current = true;
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftReady.current || done || skipDraftSave.current) return;
    void saveSignupDraft({
      kind: "business",
      step,
      businessName,
      businessType,
      description,
      address,
      email,
      phone,
      password,
      confirm,
      cac,
      agreed,
    });
  }, [step, businessName, businessType, description, address, email, phone, password, confirm, cac, agreed, done]);

  const validateStep = () => {
    if (step === 1) {
      if (businessName.trim().length < 2) {
        return "Enter your business name.";
      }
      if (!businessType) {
        return "Select a business type.";
      }
    }
    if (step === 2) {
      if (address.trim().length < 10) {
        return "Enter a fuller address (street, area, Jos).";
      }
    }
    if (step === 3) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return "Enter a valid business email.";
      }
      if (phone.replace(/\s/g, "").length < 10) {
        return "Enter a valid business phone number.";
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return "Use 8+ characters with a letter and a number.";
      }
      if (password !== confirm) {
        return "Passwords do not match.";
      }
    }
    if (step === 4) {
      const cacValue = cac.trim();
      if (cacValue && cacValue.length < 5) {
        return "Enter a valid CAC number, or leave it blank.";
      }
      if (!agreed) {
        return "Agree to the Terms of Service, Merchant Terms and Privacy Policy to continue.";
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
    if (step < 4) {
      setStep((current) => current + 1);
      return;
    }

    setLoading(true);
    try {
      const result = await registerBusiness({
        business_name: businessName,
        business_type: businessType,
        business_email: email,
        business_phone: phone,
        business_location: address,
        business_password: password,
        CAC_number: cac,
        business_description: description,
        terms_accepted: agreed,
      });
      if (!result.success) {
        setError(friendlyError(result.message || "Registration failed."));
        return;
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
    () => [1, 2, 3, 4].map((value) => value <= step),
    [step]
  );

  const titles = [
    "Business details",
    "Location",
    "Contact & sign-in",
    "Verification",
  ] as const;
  const subtitles = [
    "How your business appears across JOSCITY.",
    "Where customers can find you in Jos.",
    "The email and password you'll use to manage your business.",
    "CAC is optional, but verified businesses get more trust and reach.",
  ] as const;

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
          keyboardDismissMode="on-drag"
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
            <Text style={styles.stepLabel}>STEP {step} OF 4</Text>
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
              <Text style={styles.title}>Business created</Text>
              <Text style={styles.subtitle}>
                Check your email for an activation code, then log in to manage your business
                on JOSCITY.
              </Text>
              <AppButton
                label="Go to login"
                onPress={() =>
                  router.replace({
                    pathname: "/login",
                    params: { email, type: "business" },
                  })
                }
              />
            </FadeIn>
          ) : (
            <>
              <FadeIn replayKey={step} delay={120}>
                <Text style={styles.title}>{titles[step - 1]}</Text>
                <Text style={styles.subtitle}>{subtitles[step - 1]}</Text>
              </FadeIn>

              <FadeIn replayKey={step} delay={200} style={styles.form}>
                {step === 1 ? (
                  <>
                    <TextField
                      label="Business name"
                      labelColor={labelColor}
                      value={businessName}
                      onChangeText={setBusinessName}
                      placeholder="Terminus Fresh Foods"
                      autoCapitalize="words"
                      left={<Ionicons name="business-outline" size={18} color={colors.textMuted} />}
                    />
                    <Pressable onPress={() => setTypeOpen(true)}>
                      <View pointerEvents="none">
                        <TextField
                          label="Business type"
                          labelColor={labelColor}
                          value={selectedType?.name || ""}
                          placeholder="Select business type"
                          editable={false}
                          right={<Ionicons name="chevron-down" size={18} color={colors.textMuted} />}
                        />
                      </View>
                    </Pressable>
                    <TextField
                      label="Short description (optional)"
                      labelColor={labelColor}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="What your business offers in one or two lines"
                      multiline
                      maxLength={240}
                    />
                  </>
                ) : null}

                {step === 2 ? (
                  <TextField
                    label="Business address"
                    labelColor={labelColor}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Godiya compound B, off Bauchi ring road, Jos"
                    autoCapitalize="words"
                    left={<Ionicons name="location-outline" size={18} color={colors.textMuted} />}
                  />
                ) : null}

                {step === 3 ? (
                  <>
                    <TextField
                      label="Business email"
                      labelColor={labelColor}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="business@example.com"
                      left={<Ionicons name="mail-outline" size={18} color={colors.textMuted} />}
                    />
                    <TextField
                      label="Business phone"
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

                {step === 4 ? (
                  <>
                    <TextField
                      label="CAC number (optional)"
                      labelColor={labelColor}
                      value={cac}
                      onChangeText={(value) =>
                        setCac(value.replace(/[^A-Za-z0-9/-]/g, "").slice(0, 32))
                      }
                      autoCapitalize="characters"
                      placeholder="RC1234567"
                      helper="Leave blank if your business isn't CAC registered yet."
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
                          onPress={() => void openExternalUrl(LEGAL.terms)}
                        >
                          Terms of Service
                        </Text>
                        ,{" "}
                        <Text
                          style={styles.termsLink}
                          onPress={() => void openExternalUrl(LEGAL.merchant)}
                        >
                          Merchant Terms
                        </Text>{" "}
                        and{" "}
                        <Text
                          style={styles.termsLink}
                          onPress={() => void openExternalUrl(LEGAL.privacy)}
                        >
                          Privacy Policy
                        </Text>
                        , and confirm I'm authorised to register this business.
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                {error ? <ErrorBanner message={error} /> : null}
              </FadeIn>

              <View style={styles.spacer} />

              <FadeIn replayKey={step} delay={280}>
                <Pressable onPress={() => router.push("/login")} style={styles.loginRow}>
                  <Text style={styles.loginText}>Already registered? </Text>
                  <Text style={styles.loginLink}>Log in</Text>
                </Pressable>
                <AppButton
                  label={step === 4 ? "Submit registration" : "Continue"}
                  onPress={() => void onContinue()}
                  loading={loading}
                  disabled={step === 4 && !agreed}
                />
              </FadeIn>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={typeOpen} transparent animationType="fade" onRequestClose={() => setTypeOpen(false)}>
        <Pressable style={styles.pickerDim} onPress={() => setTypeOpen(false)}>
          <View style={[styles.picker, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.pickerTitle}>Select business type</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {categories.map((option) => (
                <Pressable
                  key={option.slug}
                  onPress={() => {
                    setBusinessType(option.slug);
                    setTypeOpen(false);
                  }}
                  style={styles.pickerItem}
                >
                  <Text style={styles.pickerLabel}>{option.name}</Text>
                  {businessType === option.slug ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
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
    maxHeight: "72%",
  },
  pickerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerList: {
    maxHeight: 420,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: colors.text,
    flex: 1,
    paddingRight: 12,
  },
});
