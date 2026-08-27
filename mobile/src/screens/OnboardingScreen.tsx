import { useMemo, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import { onboardingSlides } from "../data/onboarding";
import { setOnboardingComplete } from "../storage/onboarding";
import { colors } from "../theme/colors";
import { useResponsive } from "../theme/layout";

function CollageHero({
  images,
  replayKey,
}: {
  images: ImageSourcePropType[];
  replayKey: number;
}) {
  const cards: {
    source: ImageSourcePropType;
    rotate: string;
    top: `${number}%`;
    left?: `${number}%`;
    right?: `${number}%`;
    width: `${number}%`;
    height: `${number}%`;
  }[] = useMemo(
    () => [
      { source: images[0], rotate: "-8deg", top: "8%", left: "4%", width: "42%", height: "38%" },
      { source: images[1], rotate: "7deg", top: "4%", right: "6%", width: "46%", height: "42%" },
      { source: images[2], rotate: "-4deg", top: "44%", left: "8%", width: "38%", height: "36%" },
      { source: images[3], rotate: "6deg", top: "42%", right: "10%", width: "44%", height: "40%" },
      { source: images[4], rotate: "-2deg", top: "28%", left: "30%", width: "36%", height: "32%" },
    ],
    [images]
  );

  return (
    <View style={styles.collage}>
      {cards.map((card, index) => (
        <FadeIn
          key={`${replayKey}-${index}`}
          delay={80 + index * 90}
          duration={700}
          scaleFrom={0.94}
          style={[
            styles.collageCard,
            {
              top: card.top,
              left: card.left,
              right: card.right,
              width: card.width,
              height: card.height,
            },
          ]}
        >
          <View style={[styles.collageInner, { transform: [{ rotate: card.rotate as `${number}deg` }] }]}>
            <Image source={card.source} style={styles.collageImage} />
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, moderateScale } = useResponsive();
  const [index, setIndex] = useState(0);
  const slide = onboardingSlides[index];
  const heroHeight = Math.min(height * 0.46, 420);

  const finish = async () => {
    await setOnboardingComplete();
    router.replace("/welcome");
  };

  const onNext = () => {
    if (index >= onboardingSlides.length - 1) {
      void finish();
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar style="dark" />

      <View style={[styles.heroWrap, { height: heroHeight }]}>
        {slide.collage ? (
          <CollageHero images={slide.collage} replayKey={index} />
        ) : (
          <FadeIn key={`hero-${index}`} duration={700} translateY={0} style={styles.fill}>
            <Image source={slide.hero} style={styles.hero} />
          </FadeIn>
        )}
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", colors.white]}
          locations={[0.55, 0.82, 1]}
          style={styles.heroFade}
        />
        <FadeIn delay={180} style={[styles.skipWrap, { top: insets.top + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={() => void finish()}
            style={styles.skip}
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </FadeIn>
      </View>

      <View style={styles.content}>
        <FadeIn delay={220} replayKey={index} style={styles.dots}>
          {onboardingSlides.map((item, dotIndex) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                dotIndex === index ? styles.dotActive : styles.dotIdle,
              ]}
            />
          ))}
        </FadeIn>

        <FadeIn delay={280} replayKey={index}>
          <Text
            style={[
              styles.title,
              { fontSize: moderateScale(32, 0.4), lineHeight: moderateScale(40, 0.4) },
            ]}
          >
            {slide.title}
          </Text>
        </FadeIn>

        <FadeIn delay={360} replayKey={index}>
          <Text style={styles.body}>{slide.body}</Text>
        </FadeIn>

        <View style={styles.spacer} />

        <FadeIn delay={440} replayKey={index}>
          <AppButton label={slide.cta} onPress={onNext} />
        </FadeIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  heroWrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.white,
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
    height: "42%",
  },
  skipWrap: {
    position: "absolute",
    right: 18,
  },
  skip: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  skipLabel: {
    color: colors.skipText,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  dot: {
    height: 4,
    borderRadius: 999,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.primary,
  },
  dotIdle: {
    width: 10,
    backgroundColor: colors.paginationInactive,
  },
  title: {
    color: colors.text,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 12,
  },
  body: {
    color: colors.textMuted,
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  spacer: {
    flex: 1,
  },
  collage: {
    flex: 1,
    backgroundColor: colors.white,
  },
  collageCard: {
    position: "absolute",
  },
  collageInner: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  collageImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});
