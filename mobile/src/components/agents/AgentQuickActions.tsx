import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
export default function AgentQuickActions() {
 const router = useRouter(); const { colors } = useTheme();
 return <View style={{ paddingHorizontal: 16, marginTop: 2, marginBottom: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}>{([["Help me buy", "bag-handle-outline", "/agent-services/request?service=buy"], ["Help me deliver", "bicycle-outline", "/agent-services/request?service=deliver"], ["Agents", "people-outline", "/agent-services/directory"]] as const).map(([label, icon, path]) => <Pressable accessibilityRole="button" key={label} onPress={() => router.push(path as never)} style={{ width: "31.5%", minHeight: 108, aspectRatio: 1, backgroundColor: colors.cream, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 6 }}><Ionicons name={icon} size={22} color={colors.textMuted} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ width: "100%", fontFamily: "Montserrat_600SemiBold", fontSize: 12, lineHeight: 16, textAlign: "center", color: colors.text }}>{label}</Text></Pressable>)}</View></View>;
}
