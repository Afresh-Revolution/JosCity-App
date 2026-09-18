import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeScreen from "../../src/screens/HomeScreen";
import AgentTabBar from "../../src/components/agents/AgentTabBar";
import { hasSession } from "../../src/storage/session";
import { useTheme } from "../../src/theme/ThemeProvider";
export default function AgentFeedRoute() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { colors } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets();
  useEffect(() => { let active = true; hasSession().then(value => { if (active) setSignedIn(value); }).catch(() => { if (active) setSignedIn(false); }); return () => { active = false; }; }, []);
  if (signedIn) return <HomeScreen />;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.cream }}><View style={{ flex: 1, justifyContent: "center", padding: 28, paddingBottom: 120 + insets.bottom, gap: 20, maxWidth: 620, alignSelf: "center" }}><Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: 32, color: colors.text }}>One city. One community.</Text><Text style={{ color: colors.textMuted, fontFamily: "Montserrat_400Regular", lineHeight: 24 }}>{signedIn === null ? "Loading your feed?" : "Agents share the same JOSCITY feed. Sign in with an existing account to see posts, stories and your community."}</Text>{signedIn === false && <Pressable accessibilityRole="button" onPress={() => router.push("/login")} style={{ backgroundColor: colors.brand, borderRadius: 18, padding: 18, alignItems: "center" }}><Text style={{ color: "white", fontFamily: "Montserrat_700Bold" }}>Log in to JOSCITY</Text></Pressable>}</View><AgentTabBar active="feed" /></View>;
}
