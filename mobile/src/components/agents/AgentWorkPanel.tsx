import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { JOB_STEPS, updatePreviewRequest, useAgentPreview, type PreviewRequest } from "../../state/agentPreview";
import AppButton from "../AppButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";
export default function AgentWorkPanel() {
 const state = useAgentPreview(); const { colors: c } = useTheme(); const [detail, setDetail] = useState<string | null>(null); const [tab, setTab] = useState("Active");
 const [declined, setDeclined] = useState<string[]>([]);
 const card = { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 } as const;
 const text = { color: c.text, fontFamily: "Montserrat_600SemiBold" }; const muted = { color: c.textMuted, fontFamily: "Montserrat_400Regular", lineHeight: 21 };
 const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={{ backgroundColor: c.navActive, padding: 14, borderRadius: 14, opacity: disabled ? 0.5 : 1 }}><Text style={{ ...text, color: c.primary }}>{label}</Text></Pressable>;
 const details = (r: PreviewRequest) => <View style={{ gap: 12 }}><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{r.images.map(uri => <Image accessibilityLabel="Customer reference image" key={uri} source={{ uri }} resizeMode="cover" style={{ width: 140, height: 150, borderRadius: 14 }} />)}</View>{!r.images.length && <Text style={muted}>No reference images attached</Text>}<Text style={text}>{r.customer}</Text><Text style={muted}>{r.description}</Text><Text style={muted}>Category: {r.category}</Text><Text style={muted}>Pickup / source: {r.pickup}</Text><Text style={muted}>Destination: {r.destination}</Text><Text style={muted}>Needed by: {r.deadline}</Text><Text style={text}>Budget / delivery fee: NGN {r.budget}</Text><Text style={muted}>{r.target ? `Direct request to ${r.target}` : "Public request"}</Text></View>;
 const pending = state.requests.filter(r => r.stage < 0 && !declined.includes(r.id) && (!r.target || r.target === "John Musa")); const jobs = state.requests.filter(r => r.stage >= 0);
 return <View style={{ gap: 18 }}>
 <Text style={{ ...text, fontSize: 22 }}>Requests</Text><Text style={muted}>Preview requests only. Accepting here does not contact a customer.</Text>
 {!pending.length && <Text style={muted}>No pending requests in this preview.</Text>}
 {pending.map(r => <View style={card} key={r.id}>
   <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
     <View style={{ backgroundColor: c.iconSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ ...text, color: c.primary, fontSize: 10 }}>New - Preview</Text></View>
     <Text style={{ ...muted, fontSize: 11, flexShrink: 1 }}>{r.pickup}</Text>
   </View>
   <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
     {r.images[0] ? <Image accessibilityLabel="Product reference" source={{ uri: r.images[0] }} style={{ width: 52, height: 56, borderRadius: 12 }} /> : <View style={{ width: 52, height: 56, borderRadius: 12, backgroundColor: c.iconSoft, justifyContent: "center", alignItems: "center" }}><Ionicons name="cube-outline" size={26} color={c.primary} /></View>}
     <View style={{ flex: 1, gap: 4 }}><Text style={{ ...text, fontSize: 14 }}>{r.title}</Text><Text style={{ ...muted, fontSize: 11 }}>{r.category} - {r.customer}</Text><Text style={{ ...text, color: c.primary, fontSize: 12 }}>Budget: NGN {r.budget}</Text></View>
   </View>
   <View style={{ flexDirection: "row", gap: 10 }}>
     <Pressable accessibilityRole="button" accessibilityLabel={`View ${r.title}`} onPress={() => setDetail(detail === r.id ? null : r.id)} style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 14, alignItems: "center", justifyContent: "center" }}><Text style={{ ...text, fontSize: 12 }}>{detail === r.id ? "Hide" : "View"}</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={`Decline ${r.title}`} onPress={() => setDeclined(current => [...current, r.id])} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ ...muted, fontSize: 12 }}>Decline</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={`Accept ${r.title}`} accessibilityState={{ disabled: !state.accepting }} disabled={!state.accepting} onPress={() => { updatePreviewRequest(r.id, { stage: 0, agent: "John Musa" }); setDetail(r.id); setTab("Active"); }} style={{ flex: 1, minHeight: 44, backgroundColor: c.brand, borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: state.accepting ? 1 : 0.5 }}><Text style={{ ...text, color: c.white, fontSize: 12 }}>Accept</Text></Pressable>
   </View>
   {detail === r.id && details(r)}
   {!state.accepting && <Text style={muted}>You are not accepting new requests.</Text>}
 </View>)}
 {declined.length > 0 && button("Restore declined preview requests", () => setDeclined([]))}

 <Text style={{ ...text, fontSize: 22 }}>Jobs</Text><View style={{ flexDirection: "row", gap: 10 }}>{["Active", "Completed"].map(label => <AppButton key={label} label={label} onPress={() => setTab(label)} variant={tab === label ? "primary" : "secondary"} style={{ flex: 1 }} />)}</View>
 {!jobs.filter(r => (r.stage === 4) === (tab === "Completed")).length && <Text style={muted}>{tab === "Completed" ? "Delivered jobs will appear here." : "Accept a preview request to explore job updates."}</Text>}
 {jobs.filter(r => (r.stage === 4) === (tab === "Completed")).map(r => <View style={card} key={r.id}><Text style={text}>{r.title}</Text><Text style={{ ...text, color: c.primary }}>{JOB_STEPS[r.stage]}</Text>{button(detail === r.id ? "Hide job" : "View job", () => setDetail(detail === r.id ? null : r.id))}{detail === r.id && <>{details(r)}<Text style={text}>Current agent: {r.agent}</Text><Text style={text}>Job status</Text>{JOB_STEPS.map((step, index) => <Text key={step} style={index <= r.stage ? text : muted}>{index <= r.stage ? "[done]" : "[next]"} {step}</Text>)}{r.stage < 4 && !r.publicHandoff && button(`Mark ${JOB_STEPS[r.stage + 1]}`, () => { const stage = r.stage + 1; updatePreviewRequest(r.id, { stage, publicHandoff: stage === 2 && !state.services.includes("Help me buy") }); if (stage === 4) setTab("Completed"); })}{r.publicHandoff && <View style={{ padding: 16, borderRadius: 14, backgroundColor: c.iconSoft }}><Text style={text}>Public handoff preview</Text><Text style={muted}>You do not offer Help me buy. This job is now shown as available for Help me buy agents to pick up and continue. No public request has been sent.</Text>{button("Preview pickup by a Help me buy agent", () => updatePreviewRequest(r.id, { agent: "Amina Danjuma", publicHandoff: false }))}</View>}<Text style={muted}>Customer notification preview: {r.agent} {r.stage === 0 ? "accepted your request" : `updated your job to ${JOB_STEPS[r.stage]}`}. An in-app and push notification would show this update.</Text></>}</View>)}
 </View>;
}
