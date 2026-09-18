import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AgentTabBar from "../../src/components/agents/AgentTabBar";
import { useTheme } from "../../src/theme/ThemeProvider";

// Do not use the active personal/business session for an agent inbox.
// Connect this screen only after authenticated agent accounts are implemented.
export default function AgentNotificationsRoute() {
  const { colors } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
    <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to agent dashboard" onPress={() => router.replace("/agents" as never)} style={{ padding: 10 }}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
      <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: colors.text }}>Agent notifications</Text>
    </View>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 28, paddingBottom: 120 + insets.bottom, gap: 18 }}>
      <View style={{ backgroundColor: colors.iconSoft, padding: 24, borderRadius: 40 }}><Ionicons name="notifications-outline" size={34} color={colors.primary} /></View>
      <Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: 27, color: colors.text, textAlign: "center" }}>No agent notifications yet</Text>
      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 23, color: colors.textMuted, textAlign: "center", maxWidth: 420 }}>Requests, job updates and activity for your agent account will appear here once agent accounts are available.</Text>
      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: colors.textMuted }}>AGENT PREVIEW</Text>
    </ScrollView>
    <AgentTabBar active="" />
  </View>;
}
