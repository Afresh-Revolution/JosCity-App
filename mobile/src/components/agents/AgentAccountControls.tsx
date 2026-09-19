import { useEffect, useState } from "react";
import { Linking, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { SettingsNavRow, useSettingsStyles } from "../SettingsPage";
import AppButton from "../AppButton";
import BiometricSettingsCard from "../BiometricSettingsCard";
import { useTheme } from "../../theme/ThemeProvider";
import { LEGAL, openExternalUrl } from "../../constants/legal";
import { getUser } from "../../storage/session";

const sections = [
  { title: "SECURITY & PRIVACY", rows: [
    { title: "Verification & security", icon: "shield-checkmark-outline", subtitle: "Identity verification and account protection", copy: "Agent verification, password changes and session management will be available when agent accounts launch. No identity documents are collected in this preview." },
    { title: "Download my data", icon: "download-outline", subtitle: "A copy of your profile and transactions", copy: "Your export will include your agent profile, requests, job history and transactions. Data export is not connected in this preview." },
    { title: "Device permissions", icon: "options-outline", subtitle: "Manage photos, location and notifications", copy: "Manage permissions in your device settings. Only grant access needed for the features you use. This preview does not track your location." },
  ] },
  { title: "SAFETY & SUPPORT", rows: [
    { title: "Report a safety concern", icon: "flag-outline", subtitle: "Child safety, abuse or prohibited content", copy: "Describe the concern and include the relevant profile, post or job reference. Do not upload or forward illegal content. This preview does not submit reports." },
    { title: "Blocked accounts", icon: "ban-outline", subtitle: "Manage accounts you have blocked", copy: "No blocked accounts in this agent preview. Blocking and unblocking will be connected to your agent account before launch." },
  ] },
  { title: "ACCOUNT ACCESS", rows: [
    { title: "Deactivate account", icon: "pause-circle-outline", subtitle: "Temporarily pause your agent account", copy: "Deactivation pauses your agent account; it does not delete your data. Reactivation rules will be shown before confirmation. This preview cannot deactivate an account." },
    { title: "Delete account", icon: "trash-outline", subtitle: "Permanently delete your agent account and data", copy: "Deletion permanently removes your agent account and associated data, except records legally required to be retained. Any retention reasons and periods must be shown before confirmation. This preview cannot delete an account." },
  ] },
] as const;
type Row = typeof sections[number]["rows"][number];
export default function AgentAccountControls() {
  const [selected, setSelected] = useState<Row | null>(null);
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const s = useSettingsStyles(); const { colors } = useTheme();
  useEffect(() => {
    void getUser().then((user) => {
      setEmail(String(user?.user_email || user?.email || user?.business_email || "").trim());
    });
  }, []);
  return <>
    <BiometricSettingsCard email={email} accountType="agent" />
    {sections.map(section => <View key={section.title}><Text style={s.section}>{section.title}</Text><View style={s.card}>{section.rows.map((row, i) => <SettingsNavRow key={row.title} title={row.title} subtitle={row.subtitle} icon={row.icon} danger={row.title === "Delete account"} last={i === section.rows.length - 1} onPress={() => { setDetails(""); setSelected(row); }} />)}</View></View>)}
    <View style={s.card}><SettingsNavRow title="Contact support" subtitle={LEGAL.supportEmail} icon="mail-outline" last onPress={() => void openExternalUrl(LEGAL.support)} /></View>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: 20 }}><View style={{ backgroundColor: colors.card, padding: 22, borderRadius: 18, maxHeight: "85%", gap: 16 }}><ScrollView><Text style={s.rowTitle}>{selected?.title}</Text><Text style={[s.rowMeta, { marginVertical: 16 }]}>{selected?.copy}</Text>
      {selected?.title === "Report a safety concern" && <TextInput accessibilityLabel="Safety concern details (preview)" placeholder="Describe your concern (preview only)" placeholderTextColor={colors.textMuted} multiline value={details} onChangeText={setDetails} style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, minHeight: 100, padding: 12 }} />}
      {selected?.title === "Verification & security" && <Text style={s.rowMeta}>Verification: Not submitted. The purple badge shown elsewhere is a design preview.</Text>}
      {selected?.title === "Device permissions" ? <AppButton label="Open device settings" onPress={() => void Linking.openSettings()} /> : selected?.title !== "Blocked accounts" && <AppButton label="Not available in preview" disabled onPress={() => undefined} />}
      {selected?.title === "Report a safety concern" && <AppButton label="Contact support" variant="secondary" onPress={() => void openExternalUrl(LEGAL.support)} />}
      </ScrollView><AppButton label="Close" variant="secondary" onPress={() => setSelected(null)} /></View></View></Modal>
  </>;
}
