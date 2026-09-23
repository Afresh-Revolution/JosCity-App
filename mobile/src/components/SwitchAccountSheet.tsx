import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../theme/ThemeProvider";
export type SwitchAccountType = "personal" | "business" | "agent";
const OPTIONS = [
  ["personal", "Personal", "person-outline", "Your community, shopping and wallet."],
  ["business", "Business", "briefcase-outline", "Your shop, listings and business tools."],
  ["agent", "Agent", "bicycle-outline", "Shopping and delivery services."],
] as const;
export default function SwitchAccountSheet({ visible, current, onClose, onSelect, allowed }: { visible: boolean; current: SwitchAccountType; onClose: () => void; onSelect: (type: SwitchAccountType) => void; allowed?: SwitchAccountType[] }) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const choices = OPTIONS.filter(([id]) => id !== current && (!allowed || allowed.includes(id)));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
      <Pressable accessibilityLabel="Close account chooser" accessibilityRole="button" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ backgroundColor: colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Math.max(insets.bottom, 24), maxWidth: 620, width: "100%", alignSelf: "center", maxHeight: "85%" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: 26, color: colors.text }}>Switch account</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ padding: 10 }}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
        <Text style={{ color: colors.textMuted, fontFamily: "Montserrat_400Regular", marginBottom: 18 }}>{choices.length ? "Sign in to that account. Personal, business and agent logins are separate." : "This account stays in its own section."}</Text>
        <ScrollView>{choices.map(([id, label, icon, description]) => <Pressable key={id} accessibilityRole="button" onPress={() => onSelect(id)} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: 18, padding: 18, marginBottom: 12 }}><Ionicons name={icon} size={25} color={colors.primary} /><View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: "Montserrat_700Bold", color: colors.text }}>{label}</Text><Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textMuted }}>{description}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>)}</ScrollView>
      </View>
    </View>
  </Modal>;
}
