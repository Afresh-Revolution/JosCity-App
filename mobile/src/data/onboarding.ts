import { ImageSourcePropType } from "react-native";

export type OnboardingSlide = {
  id: string;
  title: string;
  body: string;
  cta: string;
  hero: ImageSourcePropType;
  collage?: ImageSourcePropType[];
};

export const onboardingSlides: OnboardingSlide[] = [
  {
    id: "city",
    title: "Your city, in your pocket",
    body: "News, city services and everything happening around the Plateau — in one place.",
    cta: "Next",
    hero: require("../../assets/onboarding/city.jpg"),
  },
  {
    id: "market",
    title: "Buy and sell with confidence",
    body: "Shop verified Jos businesses and trade in a marketplace with proof-of-payment protection.",
    cta: "Next",
    hero: require("../../assets/onboarding/market.jpg"),
  },
  {
    id: "wallet",
    title: "One wallet for the community",
    body: "Fund your wallet, earn CBC points and carry your JOSCITY digital membership ID.",
    cta: "Get started",
    hero: require("../../assets/onboarding/collage.jpg"),
    collage: [
      require("../../assets/onboarding/crowd.jpg"),
      require("../../assets/onboarding/smile.jpg"),
      require("../../assets/onboarding/event.jpg"),
      require("../../assets/onboarding/dance.jpg"),
      require("../../assets/onboarding/portrait.jpg"),
      require("../../assets/onboarding/collage.jpg"),
    ],
  },
];
