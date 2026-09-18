import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AppButton from "../components/AppButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { hasSession, getAccountType } from "../storage/session";
import SwitchAccountSheet from "../components/SwitchAccountSheet";
import FeedHeader from "../components/feed/FeedHeader";
import AgentWorkPanel from "../components/agents/AgentWorkPanel";
import { useAgentPreview, updateAgentPreview } from "../state/agentPreview";
import AgentTabBar from "../components/agents/AgentTabBar";
import { useTheme } from "../theme/ThemeProvider";
import { BADGE_AGENT } from "../utils/badgeColor";
import type { Palette } from "../theme/colors";

export default function AgentScreen({ page = "dashboard" }: { page?: "dashboard" | "wallet" | "profile" }) {
  const { colors } = useTheme(); const s = styles(colors); const insets = useSafeAreaInsets(); const router = useRouter();
  const [editingProfile, setEditingProfile] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [switchChooserOpen, setSwitchChooserOpen] = useState(false);
  // Agent preview has no authenticated notification inbox yet.
  const unread = 0;
  const wide = useWindowDimensions().width >= 760;
  const agentPreview = useAgentPreview();
  const online = agentPreview.accepting;
  const setOnline = (accepting: boolean) => updateAgentPreview({ accepting });
  const changePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled) { updateAgentPreview({ avatar: result.assets[0].uri }); setPhotoError(""); }
    } catch { setPhotoError("Could not open photos. Check your photo permissions and try again."); }
  };
  const title = (text: string) => <Text style={s.section}>{text}</Text>;
  const row = (label: string, value: string) => <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.bold}>{value}</Text></View>;
  return <View style={s.root}>
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}><FeedHeader unreadCount={unread} showSearch={false} onNotifications={() => router.push("/agents/notifications" as never)} /></View>
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: 110 + insets.bottom }]}>
      <View style={s.row}><Text style={s.link}>AGENTS</Text><Pressable accessibilityRole="button" onPress={() => router.push("/welcome" as never)}><Text style={s.link}>Exit preview</Text></Pressable></View>
      <Text style={s.preview}>UI PREVIEW - Sample information</Text>
      <Text style={s.heading}>{page === "dashboard" ? "Your city. Your next opportunity." : page === "wallet" ? "Your agent wallet" : "Agent profile"}</Text>
      <Text style={s.muted}>{page === "dashboard" ? "A little local knowledge. A big difference for someone in Jos." : page === "wallet" ? "Earnings, protected payments and rewards in one place." : "Your reputation, services and community."}</Text>
      {page === "dashboard" && <View style={s.hero}>
        <View style={s.identity}><View style={s.avatar}>{agentPreview.avatar ? <Image source={{ uri: agentPreview.avatar }} style={{ width: 60, height: 60, borderRadius: 22 }} /> : <Text style={{ fontSize: 24, color: colors.brand, fontFamily: "Montserrat_700Bold" }}>JM</Text>}</View><View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={s.heroTitle}>John Musa</Text><Ionicons accessibilityLabel="Agent verification badge sample" name="checkmark-circle" color={BADGE_AGENT} size={23} /></View><Text style={s.heroCopy}>Personal shopper & delivery partner</Text><Text style={s.heroCopy}>Jos North - Electronics & everyday essentials</Text></View></View>
        {page === "dashboard" ? <View style={s.availability}><View style={{ flex: 1 }}><Text style={s.heroTitle}>{online ? "Accepting requests" : "Not accepting"}</Text><Text style={s.heroCopy}>Rating and directory position stay visible</Text></View><Switch accessibilityLabel="Preview availability" value={online} onValueChange={setOnline} trackColor={{ true: "#86C7A2", false: "#707A73" }} /></View> : <View style={s.availability}><Text style={s.heroCopy}>? 4.8 rating     ?     126 completed jobs     ?     98% success</Text></View>}
      </View>}
      {page === "dashboard" && <>
        <View style={s.grid}>{[["Today's earnings", "NGN 21,000", "+18% from yesterday"], ["Pending requests", String(agentPreview.requests.filter(r => r.stage < 0).length), "2 within 1 km"], ["Active jobs", String(agentPreview.requests.filter(r => r.stage >= 0 && r.stage < 4).length), "One purchase - one delivery"], ["Your rating", "4.8 stars", "98% success rate"]].map(([label, value, caption]) => <View key={label} style={[s.card, { width: wide ? "23.5%" : "48%" }]}><Text style={s.muted}>{label}</Text><Text style={s.metric}>{value}</Text><Text style={s.link}>{caption}</Text></View>)}</View>
        <View style={s.card}><View style={s.row}>{title("This week")}<Text style={s.bold}>NGN 101,700</Text></View><View accessibilityLabel="Sample earnings chart: Monday through Sunday" style={s.chart}>{[35, 52, 41, 65, 80, 100, 58].map((height, index) => <View key={index} style={{ flex: 1, alignItems: "center", gap: 8 }}><View style={{ height: 105, justifyContent: "flex-end", width: "65%" }}><View style={{ height, backgroundColor: index === 5 ? colors.primary : colors.navActive, borderRadius: 8 }} /></View><Text style={s.muted}>{["M", "T", "W", "T", "F", "S", "S"][index]}</Text></View>)}</View></View>
        <AgentWorkPanel />
        <View style={s.card}>{title("Job earnings")}<View style={s.grid}>{[["Today", "NGN 21,000"], ["This week", "NGN 101,700"], ["This month", "NGN 384,500"], ["Lifetime", "NGN 2,140,000"]].map(([label, value]) => <View key={label} style={{ width: wide ? "23%" : "47%", gap: 8, paddingVertical: 10 }}><Text style={s.muted}>{label}</Text><Text style={s.bold}>{value}</Text></View>)}</View><Text style={s.muted}>Sample earnings from purchases and deliveries.</Text></View>
      </>}
      {page === "wallet" && <>
        <View style={s.hero}><Text style={s.heroCopy}>Normal wallet ? Sample balance</Text><Text style={[s.metric, { color: "white", fontSize: 38 }]}>NGN 42,500</Text><Text style={s.heroCopy}>Available earnings</Text><View style={s.filters}>{["Add money", "Withdraw"].map(label => <View key={label} accessibilityState={{ disabled: true }} style={s.chip}><Text style={s.link}>{label} ? Soon</Text></View>)}</View></View>
        <View style={s.card}>{title("Protected in escrow")}{row("Sample held balance", "NGN 108,000")}<Text style={s.muted}>Customer funds stay protected until delivery is confirmed. Escrow payments are coming soon.</Text></View>
        <View style={s.card}>{title("CBC rewards")}{row("Sample reward balance", "NGN 2,400")}<Text style={s.muted}>Buy CBC and save. Rewards on eligible agent transactions are coming soon.</Text></View>
        {title("Recent activity")}{[["Shopping service fee", "+NGN 5,000"], ["Delivery - Rayfield", "+NGN 3,000"], ["Purchase funds - In escrow", "NGN 108,000"]].map(([label, amount]) => <View key={label} style={s.card}>{row(label, amount)}<Text style={s.muted}>Sample transaction</Text></View>)}
      </>}
      {page === "profile" && <>
        <View style={[s.card, { alignItems: "center", paddingVertical: 28, gap: 16 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={agentPreview.avatar ? "Change profile picture" : "Upload profile picture"} onPress={() => void changePhoto()} style={{ width: 100, height: 100 }}>
            {agentPreview.avatar ? <Image source={{ uri: agentPreview.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} /> : <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.avatarBg, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 34, color: colors.primary }}>JM</Text></View>}
            <View style={{ position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={16} color={colors.white} /></View>
          </Pressable>
          {photoError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{photoError}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={[s.section, { fontSize: 24 }]}>John Musa</Text><Ionicons name="checkmark-circle" size={23} color={BADGE_AGENT} /></View>
          <Text style={s.muted}>Agent - Jos North, Plateau</Text>
          <Text style={[s.muted, { textAlign: "center" }]}>{agentPreview.bio}</Text>
          <View style={[s.row, { width: "100%", justifyContent: "space-around", paddingVertical: 12 }]}>{[["4.8", "Rating"], ["126", "Completed"], ["98%", "Success"]].map(([value, label]) => <View key={label} style={{ alignItems: "center", gap: 5 }}><Text style={s.section}>{value}</Text><Text style={s.muted}>{label}</Text></View>)}</View>
          <AppButton label={editingProfile ? "Done editing" : "Edit profile"} variant="secondary" onPress={() => setEditingProfile(!editingProfile)} style={{ width: "100%" }} />
        </View>
        <View style={s.card}>{title("Services & specialties")}<View style={s.filters}>{agentPreview.services.map(service => <View key={service} style={s.chip}><Text style={s.link}>{service}</Text></View>)}</View>{row("Specialties", agentPreview.category)}{row("Service area", "Jos North - Rayfield")}</View>
        {editingProfile && <View style={s.card}>{title("Edit profile")}<Text style={s.muted}>Changes are saved only in this preview.</Text><Text style={s.bold}>Bio</Text><TextInput accessibilityLabel="Agent bio" multiline value={agentPreview.bio} onChangeText={bio => updateAgentPreview({ bio })} style={[s.card, { color: colors.text }]} /><Text style={s.bold}>Categories / specialties</Text><TextInput accessibilityLabel="Agent categories" value={agentPreview.category} onChangeText={category => updateAgentPreview({ category })} style={[s.card, { color: colors.text }]} /><View style={s.filters}>{["Help me buy", "Help me deliver"].map(service => <Pressable key={service} accessibilityRole="checkbox" accessibilityState={{ checked: agentPreview.services.includes(service) }} onPress={() => updateAgentPreview({ services: agentPreview.services.includes(service) ? agentPreview.services.filter(s => s !== service) : [...agentPreview.services, service] })} style={s.chip}><Text style={s.link}>{agentPreview.services.includes(service) ? "Selected: " : ""}{service}</Text></Pressable>)}</View></View>}
        <View style={s.card}>{title("Agent reputation")}<Text style={[s.bold, { color: BADGE_AGENT }]}>Verified Agent - Badge preview</Text><Text style={s.muted}>New / Verified / Trusted / Elite</Text><Text style={s.notice}>Verification and agent levels shown here are examples.</Text></View>
        <View style={s.card}>{title("Sourced by John")}{row("Phones & gadgets", "Coming soon")}<Text style={s.muted}>A space for products you can source and your own listings.</Text></View>
        <View style={s.card}>{title("Services & account")}<Pressable accessibilityRole="button" onPress={() => setSwitchChooserOpen(true)} style={[s.row, { paddingVertical: 14 }]}><Text style={s.bold}>Switch account</Text><Ionicons name="swap-horizontal-outline" size={22} color={colors.primary} /></Pressable>{["Verification documents", "Reviews & job history", "Support & disputes"].map(label => <View key={label} style={[s.row, { paddingVertical: 14 }]}><Text style={s.bold}>{label}</Text><Text style={s.muted}>Soon</Text></View>)}</View>
      </>}
      <Text style={s.notice}>Agent preview only. Changes stay in this session. No real jobs, notifications or payments are created.</Text>
    </ScrollView><AgentTabBar active={page} />
    <SwitchAccountSheet visible={switchChooserOpen} current="agent" onClose={() => setSwitchChooserOpen(false)} onSelect={async type => {
      setSwitchChooserOpen(false);
      const current = await getAccountType();
      if (await hasSession() && current === type) router.replace((type === "business" ? "/business" : "/home") as never);
      else router.push({ pathname: "/login", params: { type } });
    }} />
  </View>;
}
const styles = (c: Palette) => StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 }, action: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", padding: 10 },
  root: { flex: 1, backgroundColor: c.cream }, content: { width: "100%", maxWidth: 1080, alignSelf: "center", padding: 20, gap: 18, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, wordmark: { fontFamily: "Montserrat_700Bold", color: c.primary, fontSize: 19 }, preview: { color: c.textMuted, fontFamily: "Montserrat_600SemiBold", fontSize: 10, letterSpacing: 1.5 }, heading: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 32, color: c.text }, section: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: c.text }, muted: { fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 20, color: c.textMuted }, bold: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: c.text }, link: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: c.primary }, hero: { backgroundColor: c.brand, padding: 22, borderRadius: 26, gap: 20 }, identity: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 6 }, avatar: { width: 60, height: 60, borderRadius: 22, backgroundColor: "#E6EFE8", alignItems: "center", justifyContent: "center" }, heroTitle: { color: "white", fontFamily: "Montserrat_700Bold", fontSize: 17 }, heroCopy: { color: "#D2E5D8", fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 21 }, availability: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 18, backgroundColor: "#24533C" }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }, card: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 18, gap: 12 }, metric: { color: c.text, fontFamily: "Montserrat_700Bold", fontSize: 27 }, chart: { flexDirection: "row", alignItems: "flex-end", paddingTop: 16 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { padding: 12, borderRadius: 14, backgroundColor: c.navActive }, smallIcon: { width: 48, height: 52, borderRadius: 14, backgroundColor: c.iconSoft, alignItems: "center", justifyContent: "center" }, notice: { color: c.textMuted, fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 20, paddingVertical: 8 },
});
