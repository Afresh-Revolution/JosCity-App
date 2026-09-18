import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedShell from "../components/feed/FeedShell";
import { useTheme } from "../theme/ThemeProvider";
import { addPreviewRequest, JOB_STEPS, SAMPLE_AGENTS, useAgentPreview } from "../state/agentPreview";
export default function AgentServicesScreen({ directory = false }: { directory?: boolean }) {
 const { colors: c } = useTheme(); const router = useRouter(); const inset = useSafeAreaInsets();
 const params = useLocalSearchParams<{ service?: string; agent?: string }>(); const state = useAgentPreview();
 const [service, setService] = useState(params.service === "deliver" ? "Help me deliver" : "Help me buy");
 const [query, setQuery] = useState(""); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState(""); const [budget, setBudget] = useState(""); const [pickup, setPickup] = useState(""); const [destination, setDestination] = useState(""); const [deadline, setDeadline] = useState(""); const [images, setImages] = useState<string[]>([]); const [error, setError] = useState(""); const [sentId, setSentId] = useState<string | null>(null); const [target, setTarget] = useState(params.agent || ""); const [direct, setDirect] = useState(Boolean(params.agent));
 const agents = SAMPLE_AGENTS.map(a => a.id === "john" ? { ...a, accepting: state.accepting, category: state.category, bio: state.bio } : a).sort((a, b) => b.rating - a.rating || b.jobs - a.jobs);
 const selected = agents.find(a => a.id === target); const sent = state.requests.find(r => r.id === sentId);
 const text = { color: c.text, fontFamily: "Montserrat_600SemiBold" }; const muted = { color: c.textMuted, fontFamily: "Montserrat_400Regular", lineHeight: 22 };
 const card = { backgroundColor: c.card, padding: 18, gap: 14, borderWidth: 1, borderColor: c.border, borderRadius: 20 } as const;
 const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 46, padding: 14, borderRadius: 14, backgroundColor: c.navActive, opacity: disabled ? 0.45 : 1 }}><Text style={{ ...text, color: c.primary }}>{label}</Text></Pressable>;
 const field = (label: string, value: string, change: (value: string) => void, multiline = false, numeric = false) => <View style={{ gap: 8 }}><Text style={text}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multiline} keyboardType={numeric ? "decimal-pad" : "default"} placeholderTextColor={c.textMuted} style={{ padding: 14, minHeight: multiline ? 105 : 48, borderRadius: 14, borderWidth: 1, borderColor: c.fieldBorder, backgroundColor: c.fieldBg, color: c.text, textAlignVertical: "top" }} /></View>;
 const pick = async () => {
  try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 3 - images.length, quality: 0.8 }); if (!result.canceled) setImages(current => [...current, ...result.assets.map(a => a.uri)].slice(0, 3)); }
  catch { setError("Could not open photos. Please check photo permissions and try again."); }
 };
 const send = () => {
  if (![title, description, category, budget, destination, deadline].every(v => v.trim()) || (service === "Help me deliver" && !pickup.trim())) { setError("Complete the request details, budget, destination and deadline."); return; }
  if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) { setError("Enter a budget greater than zero."); return; }
  if (direct && (!selected || !selected.accepting)) { setError("Choose an agent who is accepting requests."); return; }
  const id = `preview-${Date.now()}`;
  addPreviewRequest({ id, title, description, category, budget, pickup: pickup || "Agent to source locally", destination, deadline, images, service, customer: "You (preview)", target: direct ? selected?.name : undefined, stage: -1 }); setSentId(id); setError("");
 };
 return <FeedShell tab="explore" header={<View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={{ ...text, fontSize: 20 }}>{directory ? "Find an agent" : "Request an agent"}</Text></View>}>
 <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 120 + inset.bottom, gap: 20, maxWidth: 850, width: "100%", alignSelf: "center" }}>
 <Text style={muted}>UI preview - sample agents and local requests. No request or notification is sent.</Text>
 {directory ? <>
 <Text style={{ ...text, fontSize: 25 }}>Local experts, ready to help</Text><Text style={muted}>Highest rated first, then completed jobs. Agents keep their ranking when not accepting requests.</Text>
 {field("Search name, category, bio or location", query, setQuery)}
 {agents.filter(a => `${a.name} ${a.category} ${a.bio}`.toLowerCase().includes(query.toLowerCase().trim())).map(a => <View style={card} key={a.id}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ ...text, fontSize: 19 }}>{a.name}</Text><Ionicons name="checkmark-circle" color="#8B5CF6" size={21} /></View><Text style={text}>{a.rating} stars - {a.jobs} completed jobs</Text><Text style={muted}>{a.category}</Text><Text style={muted}>{a.bio}</Text><Text style={{ ...text, color: a.accepting ? c.primary : c.textMuted }}>{a.accepting ? "Accepting requests" : "Not accepting new requests"}</Text>{button("Request this agent", () => router.push({ pathname: "/agent-services/request" as never, params: { agent: a.id } }), !a.accepting)}</View>)}
 {!agents.some(a => `${a.name} ${a.category} ${a.bio}`.toLowerCase().includes(query.toLowerCase().trim())) && <Text style={muted}>No agents match. Try another category or name.</Text>}
 </> : sent ? <>
 <Text style={{ ...text, fontSize: 25 }}>Request preview created</Text><Text style={text}>{sent.title}</Text><Text style={muted}>{sent.target ? `Direct to ${sent.target}` : "Available to nearby agents"}</Text>
 <View style={card}><Text style={text}>{sent.stage < 0 ? "Waiting for an agent" : `${sent.agent} - ${JOB_STEPS[sent.stage]}`}</Text>{JOB_STEPS.map((step, index) => <Text style={index <= sent.stage ? text : muted} key={step}>{index <= sent.stage ? "[done]" : "[pending]"} {step}</Text>)}</View>
 <View style={card}><Text style={text}>Notification & push preview</Text><Text style={muted}>{sent.stage < 0 ? "When an agent accepts: John Musa accepted your request. Current step: Accepted." : `${sent.agent} updated your request: ${JOB_STEPS[sent.stage]}.`}</Text><Text style={muted}>Real in-app and push updates will be connected when agent services launch.</Text></View>
 {button("Open agent dashboard preview", () => router.push("/agents" as never))}{button("Create another request", () => { setSentId(null); setTitle(""); setDescription(""); setImages([]); })}
 </> : <>
 <View style={{ flexDirection: "row", gap: 10 }}>{["Help me buy", "Help me deliver"].map(label => <View style={{ flex: 1 }} key={label}>{button(`${service === label ? "[selected] " : ""}${label}`, () => setService(label))}</View>)}</View>
 {field(service === "Help me buy" ? "Item to buy" : "Item to deliver", title, setTitle)}
 {field("Category", category, setCategory)}{field("Description and special instructions", description, setDescription, true)}
 {field(service === "Help me buy" ? "Budget (NGN)" : "Delivery budget (NGN)", budget, setBudget, false, true)}
 {field(service === "Help me buy" ? "Preferred source (optional)" : "Pickup address", pickup, setPickup)}{field("Delivery address / area", destination, setDestination)}{field("When do you need it?", deadline, setDeadline)}
 <View style={card}><Text style={text}>Reference images ({images.length}/3)</Text><Text style={muted}>Choose up to three product or package photos. Images stay in this preview.</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{images.map((uri, index) => <View key={`${uri}-${index}`} style={{ gap: 5 }}><Image source={{ uri }} style={{ width: 95, height: 95, borderRadius: 12 }} />{button(`Remove ${index + 1}`, () => setImages(images.filter((_, i) => i !== index)))}</View>)}</View>{button("Choose images", () => void pick(), images.length >= 3)}</View>
 <View style={card}><Text style={text}>Who should receive this request?</Text>{button(direct ? "Send to nearby agents" : "[selected] Nearby agents", () => setDirect(false))}{button(direct ? "[selected] Choose an agent" : "Choose an agent directly", () => setDirect(true))}{direct && agents.map(a => <View key={a.id}>{button(`${target === a.id ? "[selected] " : ""}${a.name} - ${a.rating} stars${a.accepting ? "" : " - Not accepting"}`, () => setTarget(a.id), !a.accepting)}</View>)}</View>
 {error ? <Text accessibilityRole="alert" style={{ color: c.error }}>{error}</Text> : null}
 {button("Send request (preview)", send)}
 </>}
 </ScrollView></FeedShell>;
}
