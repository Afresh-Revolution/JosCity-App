import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AppButton from "../components/AppButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAccountType, getAuthToken, getUser, homeRouteForAccount, isDedicatedAgentAccount, switchToSession, type StoredSession, type StoredUser } from "../storage/session";
import SwitchAccountSheet, { type SwitchAccountType } from "../components/SwitchAccountSheet";
import BusinessAccountSheet from "../components/BusinessAccountSheet";
import FeedHeader from "../components/feed/FeedHeader";
import AgentWorkPanel from "../components/agents/AgentWorkPanel";
import AgentProfileEditor from "../components/agents/AgentProfileEditor";
import AgentReputationCard from "../components/agents/AgentReputationCard";
import AgentSourcedCatalogue from "../components/agents/AgentSourcedCatalogue";
import JosCityLoader from "../components/JosCityLoader";
import { HELP_ME_BUY, HELP_ME_DELIVER, toggleAgentServices } from "../api/agentSignup";
import { useAgentPreview, updateAgentPreview } from "../state/agentPreview";
import { useAgentActivation } from "../state/useAgentActivation";
import AgentTabBar from "../components/agents/AgentTabBar";
import { registerPushTokenAfterLogin, unregisterPushTokenOnLogout } from "../push/pushNotifications";
import { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme/ThemeProvider";
import { resolveAccountBadgeColor } from "../utils/badgeColor";
import type { Palette } from "../theme/colors";

function naira(value: unknown) {
  return `NGN ${Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function AgentScreen({ page = "dashboard" }: { page?: "dashboard" | "profile" | "settings" }) {
  const { colors } = useTheme(); const s = styles(colors); const insets = useSafeAreaInsets(); const router = useRouter();
  const { t } = useI18n();
  const [editingProfile, setEditingProfile] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [switchChooserOpen, setSwitchChooserOpen] = useState(false);
  const [switchLoginOpen, setSwitchLoginOpen] = useState(false);
  const [switchLoginType, setSwitchLoginType] = useState<SwitchAccountType>("personal");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);
  const [switchAllowed, setSwitchAllowed] = useState<SwitchAccountType[]>([]);
  const unread = 0;
  const wide = useWindowDimensions().width >= 760;
  const agentPreview = useAgentPreview();
  const activation = useAgentActivation();
  const online = agentPreview.accepting;
  const setOnline = (accepting: boolean) => { void activation.setAccepting(accepting); };
  const displayName = `${activation.profile?.user_firstname || agentPreview.firstName} ${activation.profile?.user_lastname || agentPreview.lastName}`.trim() || "Agent";
  const initials = `${(activation.profile?.user_firstname || agentPreview.firstName || "A")[0]}${(activation.profile?.user_lastname || agentPreview.lastName || "")[0] || ""}`.toUpperCase();
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([getAuthToken(), getAccountType(), getUser()]).then(([token, type, user]) => {
      if (!active) return;
      setAuthed(Boolean(token));
      setSessionUser(user);
      if (isDedicatedAgentAccount(user, type)) setSwitchAllowed([]);
      else if (type === "business") setSwitchAllowed(["personal", "agent"]);
      else setSwitchAllowed(["personal", "business"]);
    });
    return () => { active = false; };
  }, []));
  const changePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled) { updateAgentPreview({ avatar: result.assets[0].uri }); setPhotoError(""); }
    } catch { setPhotoError("Could not open photos. Check your photo permissions and try again."); }
  };
  const badgeColor = resolveAccountBadgeColor({
    badge_color: typeof sessionUser?.badge_color === "string" ? sessionUser.badge_color : null,
    account_type: "agent",
    signup_intent: typeof sessionUser?.signup_intent === "string" ? sessionUser.signup_intent : "agent",
    agent_type: typeof sessionUser?.agent_type === "string" ? sessionUser.agent_type : typeof activation.profile?.agent_type === "string" ? activation.profile.agent_type : null,
    nin_number: typeof sessionUser?.nin_number === "string" ? sessionUser.nin_number : null,
    nin_verified: Boolean(sessionUser?.nin_verified),
  }) || "#6B7280";
  const title = (text: string) => <Text style={s.section}>{text}</Text>;
  const row = (label: string, value: string) => <View style={s.row}><Text style={s.muted}>{label}</Text><Text style={s.bold}>{value}</Text></View>;
  if (authed === null) {
    return <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}><JosCityLoader color={colors.primary} size="large" /></View>;
  }
  if (!authed) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 24, paddingHorizontal: 24, gap: 16 }]}>
        <Text style={s.heading}>Agent account</Text>
        <Text style={s.muted}>Sign in to open your dashboard. Jobs, requests and your profile load from your account.</Text>
        <AppButton label="Log in" onPress={() => router.push({ pathname: "/login", params: { type: "agent" } })} />
        <AppButton label="Create an agent account" variant="secondary" onPress={() => router.push("/register/agent" as never)} />
      </View>
    );
  }
  return <View style={s.root}>
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      {page === "profile" ? (
        <View style={s.headerBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerKicker}>{t("profile.tabKicker")}</Text>
            <Text style={s.headerTitle}>{t("profile.title")}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/agents/settings" as never)}
            style={s.gearBtn}
            accessibilityRole="button"
            accessibilityLabel={t("profile.settingsHint")}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      ) : (
        <FeedHeader unreadCount={unread} showSearch={false} onNotifications={() => router.push("/agents/notifications" as never)} />
      )}
    </View>
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: TAB_BAR_SPACE + insets.bottom + 36 }]} keyboardShouldPersistTaps="always">
      {page !== "profile" ? <View style={s.row}><Text style={s.link}>AGENTS</Text></View> : null}
      {page === "settings" ? (
        <>
          <Text style={s.heading}>Agent settings</Text>
          <Text style={s.muted}>Account, safety and support for your agent profile.</Text>
        </>
      ) : null}
      {activation.error ? <Text accessibilityRole="alert" style={s.notice}>{activation.error}</Text> : null}
      {activation.notice ? <Text style={s.link}>{activation.notice}</Text> : null}
      {page === "dashboard" && activation.authenticated && activation.needsDetails && <View style={s.card}>
        {title("Finish with your create-account details")}
        <Text style={s.muted}>Use the same Agent bio, categories, services and NIN from the create account page. This is not a new form.</Text>
        <AppButton label="Open your agent details" onPress={() => setDetailsOpen(true)} />
      </View>}
      {page === "dashboard" && <View style={s.hero}>
        <View style={s.identity}><View style={s.avatar}>{agentPreview.avatar ? <Image source={{ uri: agentPreview.avatar }} style={{ width: 60, height: 60, borderRadius: 22 }} /> : <Text style={{ fontSize: 24, color: colors.brand, fontFamily: "Montserrat_700Bold" }}>{initials}</Text>}</View><View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={s.heroTitle}>{displayName}</Text><Ionicons accessibilityLabel="Agent verification badge" name="checkmark-circle" color={badgeColor} size={23} /></View><Text style={s.heroCopy}>{agentPreview.services.join(" · ") || "Personal shopper & delivery partner"}</Text><Text style={s.heroCopy}>{agentPreview.address || "Jos"} - {agentPreview.category || "Your specialties"}</Text></View></View>
        <View style={s.availability}><View style={{ flex: 1 }}><Text style={s.heroTitle}>{online ? "Accepting requests" : "Not accepting"}</Text><Text style={s.heroCopy}>Rating and directory position stay visible</Text></View><Switch accessibilityLabel="Availability" value={online} onValueChange={setOnline} trackColor={{ true: "#86C7A2", false: "#707A73" }} /></View>
      </View>}
      {page === "dashboard" && <>
        <AppButton label="Map" variant="secondary" onPress={() => router.push("/agents/map" as never)} />
        <View style={s.grid}>{[["Active jobs", String(activation.stats?.active_jobs ?? 0), "Live from your account"], ["Pending quotes", String(activation.stats?.pending_quotes ?? 0), "Waiting for a customer"], ["Completed today", String(activation.stats?.completed_today ?? 0), "Jobs finished today"], ["Your rating", Number(activation.profile?.agent_rating_avg || 0).toFixed(1), `${activation.profile?.agent_completed_jobs_count || 0} completed jobs`]].map(([label, value, caption]) => <View key={label} style={[s.card, { width: wide ? "23.5%" : "48%" }]}><Text style={s.muted}>{label}</Text><Text style={s.metric}>{value}</Text><Text style={s.link}>{caption}</Text></View>)}</View>
        <View style={s.card}><View style={s.row}>{title("Protected fees")}<Text style={s.bold}>{naira(activation.stats?.held_agent_fees)}</Text></View><Text style={s.muted}>Held until the customer confirms delivery.</Text></View>
        {title("Earnings")}
        <View style={s.grid}>
          {([
            ["Wallet", naira(activation.walletBalance), "Tap to open wallet"],
            ["Held fees", naira(activation.stats?.held_agent_fees), "Until delivery is confirmed"],
            ["Completed today", String(activation.stats?.completed_today ?? 0), "Jobs finished today"],
            ["Lifetime jobs", String(activation.profile?.agent_completed_jobs_count ?? 0), "All completed jobs"],
          ] as const).map(([label, value, caption]) => {
            const tileStyle = [s.card, { width: wide ? "23.5%" : "48%" }] as const;
            const body = (
              <>
                <Text style={s.muted}>{label}</Text>
                <Text style={label === "Wallet" || label === "Held fees" ? s.earnValue : s.metric}>{value}</Text>
                <Text style={s.link}>{caption}</Text>
              </>
            );
            return label === "Wallet" ? (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel="Open wallet" onPress={() => router.push("/agents/wallet" as never)} style={tileStyle}>{body}</Pressable>
            ) : (
              <View key={label} style={tileStyle}>{body}</View>
            );
          })}
        </View>
        <AgentWorkPanel />
      </>}
      {page === "profile" && <>
        <View style={[s.card, { alignItems: "center", paddingVertical: 28, gap: 16 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={agentPreview.avatar ? "Change profile picture" : "Upload profile picture"} onPress={() => void changePhoto()} style={{ width: 100, height: 100 }}>
            {agentPreview.avatar ? <Image source={{ uri: agentPreview.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} /> : <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.avatarBg, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 34, color: colors.primary }}>{initials}</Text></View>}
            <View style={{ position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Ionicons name="camera" size={16} color={colors.white} /></View>
          </Pressable>
          {photoError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{photoError}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={[s.section, { fontSize: 24 }]}>{displayName}</Text><Ionicons name="checkmark-circle" size={23} color={badgeColor} /></View>
          <Text style={s.muted}>Agent - {agentPreview.address || "Jos North, Plateau"}</Text>
          <Text style={[s.muted, { textAlign: "center" }]}>{agentPreview.bio}</Text>
          <View style={[s.row, { width: "100%", justifyContent: "space-around", paddingVertical: 12 }]}>{[[`${Number(activation.profile?.agent_rating_avg || 0).toFixed(1)}`, "Rating"], [String(activation.profile?.agent_completed_jobs_count ?? 0), "Completed"], [activation.profile?.star_level?.label || "Agent", "Level"]].map(([value, label]) => <View key={label} style={{ alignItems: "center", gap: 5 }}><Text style={s.section}>{value}</Text><Text style={s.muted}>{label}</Text></View>)}</View>
          <AppButton label={editingProfile ? "Done editing" : "Edit profile"} variant="secondary" onPress={() => setEditingProfile(!editingProfile)} style={{ width: "100%" }} />
        </View>
        <View style={s.card}>{title("Services & specialties")}<View style={s.filters}>{agentPreview.services.map(service => <View key={service} style={s.chip}><Text style={s.link}>{service}</Text></View>)}</View>{row("Specialties", agentPreview.category)}{row("Service area", agentPreview.address || "Jos North - Rayfield")}</View>
        {editingProfile && <View style={s.card}>{title("Edit profile")}<Text style={s.muted}>Use the same fields from the create account page.</Text><Text style={s.bold}>Bio</Text><TextInput accessibilityLabel="Agent bio" multiline value={agentPreview.bio} onChangeText={bio => updateAgentPreview({ bio })} style={[s.card, { color: colors.text }]} /><Text style={s.bold}>Categories / specialties</Text><TextInput accessibilityLabel="Agent categories" value={agentPreview.category} onChangeText={category => updateAgentPreview({ category })} style={[s.card, { color: colors.text }]} /><View style={s.filters}>{[HELP_ME_BUY, HELP_ME_DELIVER].map(service => <Pressable key={service} accessibilityRole="checkbox" accessibilityState={{ checked: agentPreview.services.includes(service) }} onPress={() => updateAgentPreview({ services: toggleAgentServices(agentPreview.services, service) })} style={s.chip}><Text style={s.link}>{agentPreview.services.includes(service) ? "Selected: " : ""}{service}</Text></Pressable>)}</View></View>}
        <AgentReputationCard profile={activation.profile} accent={badgeColor} />
        <AgentSourcedCatalogue agentName={agentPreview.firstName || displayName} />
        {switchAllowed.length ? <View style={s.card}><Pressable accessibilityRole="button" onPress={() => setSwitchChooserOpen(true)} style={[s.row, { paddingVertical: 14 }]}><Text style={s.bold}>Switch account</Text><Ionicons name="swap-horizontal-outline" size={22} color={colors.primary} /></Pressable></View> : null}
      </>}
      <Text style={s.notice}>Agent services use the details you entered when creating your account.</Text>
    </ScrollView><AgentTabBar active={page === "settings" ? "profile" : page} />
    {detailsOpen && <AgentProfileEditor title="Agent details" copy="These are the same fields from the create account page." onClose={() => setDetailsOpen(false)} onSave={activation.saveDetails} />}
    <SwitchAccountSheet visible={switchChooserOpen} current="agent" allowed={switchAllowed} onClose={() => setSwitchChooserOpen(false)} onSelect={type => {
      setSwitchChooserOpen(false);
      setSwitchLoginType(type);
      setSwitchLoginOpen(true);
    }} />
    <BusinessAccountSheet
      visible={switchLoginOpen}
      mode={switchLoginType}
      onClose={() => setSwitchLoginOpen(false)}
      onLinked={async (session: StoredSession) => {
        await unregisterPushTokenOnLogout();
        await switchToSession(session);
        setSwitchLoginOpen(false);
        void registerPushTokenAfterLogin();
        router.replace(homeRouteForAccount(session.accountType) as never);
      }}
    />
  </View>;
}
const styles = (c: Palette) => StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 }, action: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", padding: 10 },
  root: { flex: 1, backgroundColor: c.cream }, content: { width: "100%", maxWidth: 1080, alignSelf: "center", padding: 20, gap: 18, paddingBottom: 32 },
  headerBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  headerKicker: { fontFamily: "Montserrat_500Medium", fontSize: 11, letterSpacing: 0.4, color: c.textMuted, marginBottom: 2 },
  headerTitle: { fontFamily: "Montserrat_700Bold", fontSize: 32, color: c.text },
  gearBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, wordmark: { fontFamily: "Montserrat_700Bold", color: c.primary, fontSize: 19 }, heading: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 32, color: c.text }, section: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: c.text }, muted: { fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 20, color: c.textMuted }, bold: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: c.text }, link: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: c.primary }, hero: { backgroundColor: c.brand, padding: 22, borderRadius: 26, gap: 20 }, identity: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 6 }, avatar: { width: 60, height: 60, borderRadius: 22, backgroundColor: "#E6EFE8", alignItems: "center", justifyContent: "center" }, heroTitle: { color: "white", fontFamily: "Montserrat_700Bold", fontSize: 17 }, heroCopy: { color: "#D2E5D8", fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 21 }, availability: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 18, backgroundColor: "#24533C" }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }, card: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 18, gap: 12 }, metric: { color: c.text, fontFamily: "Montserrat_700Bold", fontSize: 27 }, earnValue: { color: c.text, fontFamily: "Montserrat_700Bold", fontSize: 20 }, chart: { flexDirection: "row", alignItems: "flex-end", paddingTop: 16 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { padding: 12, borderRadius: 14, backgroundColor: c.navActive }, smallIcon: { width: 48, height: 52, borderRadius: 14, backgroundColor: c.iconSoft, alignItems: "center", justifyContent: "center" }, notice: { color: c.textMuted, fontFamily: "Montserrat_400Regular", fontSize: 12, lineHeight: 20, paddingVertical: 8 },
});
