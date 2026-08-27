import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AccountTypeSheet from "../components/AccountTypeSheet";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import { LEGAL, openExternalUrl } from "../constants/legal";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/layout";

const hero = require("../../assets/onboarding/city.jpg");
const logo = require("../../assets/logo.png");

export default function WelcomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ join?: string }>();
  const insets = useSafeAreaInsets();
  const { height, moderateScale } = useResponsive();
  const heroHeight = Math.min(height * 0.42, 380);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (params.join === "1") setSheetOpen(true);
  }, [params.join]);

  return (
    <View
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, 18) },
      ]}
    >
      <StatusBar style="light" />

      <View style={[styles.heroWrap, { height: heroHeight }]}>
        <FadeIn duration={800} translateY={0} style={styles.fill}>
          <Image source={hero} style={styles.hero} />
        </FadeIn>
        <LinearGradient
          colors={["rgba(244,241,234,0)", "rgba(244,241,234,0.55)", colors.cream]}
          locations={[0.5, 0.8, 1]}
          style={styles.heroFade}
        />
        <FadeIn delay={160} style={[styles.brand, { top: insets.top + 12 }]}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.brandName}>JOSCITY</Text>
        </FadeIn>
      </View>

      <View style={styles.content}>
        <FadeIn delay={240}>
          <Text
            style={[
              styles.title,
              { fontSize: moderateScale(36, 0.35), lineHeight: moderateScale(44, 0.35) },
            ]}
          >
            Jos, connected.
          </Text>
        </FadeIn>

        <FadeIn delay={320}>
          <Text style={styles.body}>
            Verified businesses, a protected marketplace and one community wallet — built for the people of Plateau.
          </Text>
        </FadeIn>

        <FadeIn delay={400} style={styles.trust}>
          <Ionicons name="shield-checkmark" size={16} color={colors.shield} />
          <Text style={styles.trustText}>
            Every account is activated by email and encrypted.
          </Text>
        </FadeIn>

        <View style={styles.spacer} />

        <FadeIn delay={480}>
          <AppButton
            label="Create account"
            suffix="→"
            onPress={() => setSheetOpen(true)}
          />
        </FadeIn>
        <FadeIn delay={560} style={styles.loginWrap}>
          <AppButton
            label="Log in"
            variant="secondary"
            onPress={() => router.push("/login")}
          />
        </FadeIn>
        <FadeIn delay={620} style={styles.legalWrap}>
          <Text style={styles.legalLead}>By continuing you agree to our </Text>
          <Pressable
            onPress={() => void openExternalUrl(LEGAL.terms)}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            <Text style={styles.legalLink}>Terms</Text>
          </Pressable>
          <Text style={styles.legalLead}> and </Text>
          <Pressable
            onPress={() => void openExternalUrl(LEGAL.privacy)}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalLead}>.</Text>
        </FadeIn>
      </View>

      <AccountTypeSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPersonal={() => {
          setSheetOpen(false);
          router.push("/register/personal");
        }}
        onBusiness={() => {
          setSheetOpen(false);
          router.push("/register/business");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  heroWrap: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  hero: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "48%",
  },
  brand: {
    position: "absolute",
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 34,
    height: 34,
  },
  brandName: {
    color: colors.white,
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    letterSpacing: 2.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    color: colors.text,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 12,
  },
  body: {
    color: "#5F5F5F",
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 320,
  },
  trustText: {
    flex: 1,
    color: colors.textSoft,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
  },
  loginWrap: {
    marginTop: 12,
  },
  legalWrap: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  legalLead: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  legalLink: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
