import { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { agentApi, type AgentRequest, type Job } from "../../api/agent";
import { formatAgentAmount } from "../../state/agentPreview";
import AppButton from "../AppButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";

function money(value: unknown) {
  return `NGN ${formatAgentAmount(Number(value || 0))}`;
}

export default function AgentWorkPanel() {
  const { colors: c } = useTheme();
  const [tab, setTab] = useState("Active");
  const [detail, setDetail] = useState<string | null>(null);
  const [pending, setPending] = useState<AgentRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [buyResult, deliveryResult, jobsResult] = await Promise.allSettled([
        agentApi.requests("buy", "agent"),
        agentApi.requests("delivery", "agent"),
        agentApi.jobs("agent"),
      ]);
      const buy = buyResult.status === "fulfilled" ? buyResult.value : [];
      const delivery = deliveryResult.status === "fulfilled" ? deliveryResult.value : [];
      setPending([
        ...buy.map((item) => ({ ...item, source_type: "buy" as const })),
        ...delivery.map((item) => ({ ...item, source_type: "delivery" as const })),
      ]);
      setJobs(jobsResult.status === "fulfilled" ? jobsResult.value : []);
      if (buyResult.status === "rejected" && deliveryResult.status === "rejected") {
        const reason = buyResult.reason instanceof Error ? buyResult.reason.message : "Unable to load requests.";
        setError(reason);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load requests.");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const card = { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 } as const;
  const text = { color: c.text, fontFamily: "Montserrat_600SemiBold" } as const;
  const muted = { color: c.textMuted, fontFamily: "Montserrat_400Regular", lineHeight: 21 } as const;
  const visibleJobs = jobs.filter((job) => (Boolean(job.cancelled_at) || job.stage === 4) === (tab === "Completed"));

  return (
    <View style={{ gap: 18 }}>
      <Text style={{ ...text, fontSize: 22 }}>Requests</Text>
      <Text style={muted}>Open buy and delivery requests you can quote on.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: c.error }}>{error}</Text> : null}
      {busy ? <Text style={muted}>Loading requests…</Text> : null}
      {!busy && !error && !pending.length ? <Text style={muted}>No pending requests yet.</Text> : null}
      {pending.map((r) => {
        const key = `${r.source_type || "request"}-${r.request_id}`;
        const kind = r.source_type === "delivery" ? "Help me deliver" : r.source_type === "buy" ? "Help me buy" : "Request";
        return (
          <View style={card} key={key}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
                <View style={{ backgroundColor: c.iconSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ ...text, color: c.primary, fontSize: 10 }}>{kind}</Text>
                </View>
                <View style={{ backgroundColor: c.iconSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ ...text, color: c.primary, fontSize: 10 }}>{r.status || "Open"}</Text>
                </View>
              </View>
              <Text style={{ ...muted, fontSize: 11, flexShrink: 1 }}>{r.pickup_address || r.destination_address || ""}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {r.images?.[0] ? (
                <Image accessibilityLabel="Product reference" source={{ uri: r.images[0] }} style={{ width: 52, height: 56, borderRadius: 12 }} />
              ) : (
                <View style={{ width: 52, height: 56, borderRadius: 12, backgroundColor: c.iconSoft, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="cube-outline" size={26} color={c.primary} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ ...text, fontSize: 14 }}>{r.title || r.package_description || `Request #${r.request_id}`}</Text>
                <Text style={{ ...muted, fontSize: 11 }}>{r.description || ""}</Text>
                {r.target_budget ? <Text style={{ ...text, color: c.primary, fontSize: 12 }}>Budget: {money(r.target_budget)}</Text> : null}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${r.title || "request"}`}
              onPress={() => setDetail(detail === key ? null : key)}
              style={{ minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ ...text, fontSize: 12 }}>{detail === key ? "Hide" : "View"}</Text>
            </Pressable>
            {detail === key ? (
              <View style={{ gap: 8 }}>
                {r.pickup_address ? <Text style={muted}>Pickup: {r.pickup_address}</Text> : null}
                {r.destination_address ? <Text style={muted}>Delivery: {r.destination_address}</Text> : null}
                <Text style={muted}>{r.description || r.package_description || "No extra details yet."}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={{ ...text, fontSize: 22 }}>Jobs</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {["Active", "Completed"].map((label) => (
          <AppButton key={label} label={label} onPress={() => setTab(label)} variant={tab === label ? "primary" : "secondary"} style={{ flex: 1 }} />
        ))}
      </View>
      {!visibleJobs.length ? (
        <Text style={muted}>{tab === "Completed" ? "Delivered jobs will appear here." : "Accepted jobs will appear here."}</Text>
      ) : null}
      {visibleJobs.map((job) => {
        const key = String(job.job_id);
        return (
          <View style={card} key={key}>
            <Text style={text}>{job.source_type === "buy" ? "Purchase" : "Delivery"} #{job.job_id}</Text>
            <Text style={{ ...text, color: c.primary }}>{job.cancelled_at ? "Cancelled" : job.stage_label}</Text>
            <Text style={muted}>Escrow: {job.escrow_status || "Not funded"}</Text>
            <Text style={muted}>Product: {money(job.product_amount)} · Agent fee: {money(job.agent_fee_amount)}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetail(detail === key ? null : key)}
              style={{ minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ ...text, fontSize: 12 }}>{detail === key ? "Hide job" : "View job"}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
