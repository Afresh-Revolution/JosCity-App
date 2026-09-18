import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
export default function AgentTabBar({ active }: { active: string }) {
  const router = useRouter(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  return <View style={{ position: "absolute", left: 12, right: 12, bottom: Math.max(insets.bottom, 10), alignItems: "center" }}><View style={{ width: "100%", maxWidth: 600, alignSelf: "center", flexDirection: "row", backgroundColor: colors.card, borderRadius: 38, paddingHorizontal: 10, paddingVertical: 10, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
    {([ ["dashboard", "Dashboard", "grid-outline", "/agents"], ["feed", "Feeds", "newspaper-outline", "/agents/feed"], ["wallet", "Wallet", "wallet-outline", "/agents/wallet"], ["profile", "Profile", "person-outline", "/agents/profile"] ] as const).map(([id, label, icon, path]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active === id }} onPress={() => router.replace(path as never)} style={{ flex: 1, alignItems: "center", gap: 5, padding: 8, borderRadius: 18, backgroundColor: active === id ? colors.navActive : "transparent" }}><Ionicons name={icon} size={23} color={active === id ? colors.primary : colors.textMuted} /><Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: active === id ? colors.primary : colors.textMuted }}>{label}</Text></Pressable>)}
  </View></View>;
}
