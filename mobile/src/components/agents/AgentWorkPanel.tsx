import { useCallback, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { agentApi, type AgentRequest, type Job, type Service } from "../../api/agent";
import { formatAgentAmount, useAgentPreview } from "../../state/agentPreview";
import { useQuoteFee } from "../../state/useQuoteFee";
import { formatFeePercent, quoteFeeForAmount } from "../../utils/agentFee";
import { ensureBlockedUsers, filterUnblocked } from "../../storage/blockedUsers";
import { formatMoneyInput, parseMoneyInput } from "../../utils/format";
import AppButton from "../AppButton";
import TextField from "../TextField";
import AgentFeeBenefit from "./AgentFeeBenefit";
import AgentJobCard from "./AgentJobCard";
import AgentVendorPaySheet from "./AgentVendorPaySheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";

function money(value: unknown) {
  return `NGN ${formatAgentAmount(Number(value || 0))}`;
}

function serviceOf(request: AgentRequest): Service {
  return request.source_type === "delivery" ? "delivery" : "buy";
}

function requestKey(request: AgentRequest) {
  return `${request.source_type || "request"}-${request.request_id}`;
}

type QuoteDraft = {
  request: AgentRequest;
  service: Service;
  productPrice: string;
  chargeAmount: string;
  note: string;
  etaNote: string;
};

export default function AgentWorkPanel() {
  const { colors: c } = useTheme();
  const preview = useAgentPreview();
  const accepting = preview.accepting;
  const [tab, setTab] = useState("Active");
  const [detail, setDetail] = useState<string | null>(null);
  const [pending, setPending] = useState<AgentRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [declined, setDeclined] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [payJob, setPayJob] = useState<Job | null>(null);
  const quoteFee = useQuoteFee(draft?.service === "buy" ? draft.productPrice : "");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [buyResult, deliveryResult, jobsResult] = await Promise.allSettled([
        agentApi.requests("buy", "agent"),
        agentApi.requests("delivery", "agent"),
        agentApi.jobs("agent"),
      ]);
      await ensureBlockedUsers();
      const buy = buyResult.status === "fulfilled" ? buyResult.value : [];
      const delivery = deliveryResult.status === "fulfilled" ? deliveryResult.value : [];
      setPending(filterUnblocked([
        ...buy.map((item) => ({ ...item, source_type: "buy" as const })),
        ...delivery.map((item) => ({ ...item, source_type: "delivery" as const })),
      ], (item) => Number(item.requester_user_id || 0)));
      setJobs(filterUnblocked(jobsResult.status === "fulfilled" ? jobsResult.value : [], (job) => Number(job.requester_user_id || 0)));
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
  const pendingPayouts = jobs.filter((job) => job.payout_pending_manual).length;
  const visiblePending = useMemo(
    () => pending.filter((request) => !declined.includes(requestKey(request))),
    [pending, declined]
  );

  const rejectRequest = async (request: AgentRequest) => {
    const key = requestKey(request);
    setDeclined((current) => current.includes(key) ? current : [...current, key]);
    if (detail === key) setDetail(null);
    try {
      await agentApi.withdrawQuote(serviceOf(request), request.request_id);
    } catch {
      // Local hide still applies when there is no quote to withdraw.
    }
  };

  const openAccept = async (request: AgentRequest) => {
    if (!accepting) return;
    const key = requestKey(request);
    const service = serviceOf(request);
    setActing(key);
    setError("");
    try {
      const quote = await agentApi.myQuote(service, request.request_id);
      setDraft({
        request,
        service,
        productPrice: formatMoneyInput(quote?.product_price ?? request.target_budget ?? ""),
        chargeAmount: formatMoneyInput(quote?.charge_amount ?? request.target_budget ?? ""),
        note: quote?.note || "",
        etaNote: quote?.eta_note || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open this request.");
    } finally {
      setActing(null);
    }
  };

  const submitAccept = async () => {
    if (!draft) return;
    const key = requestKey(draft.request);
    setActing(key);
    setError("");
    try {
      const claimed = draft.service === "buy"
        ? await (async () => {
            const productPrice = parseMoneyInput(draft.productPrice);
            if (productPrice == null || Number.isNaN(productPrice) || productPrice <= 0) {
              throw new Error("Enter a product price to accept this request.");
            }
            return agentApi.claim("buy", draft.request.request_id, { productPrice, note: draft.note.trim() || undefined });
          })()
        : await (async () => {
            const chargeAmount = parseMoneyInput(draft.chargeAmount);
            if (chargeAmount == null || Number.isNaN(chargeAmount) || chargeAmount <= 0) {
              throw new Error("Enter a delivery charge to accept this request.");
            }
            return agentApi.claim("delivery", draft.request.request_id, { chargeAmount, etaNote: draft.etaNote.trim() || undefined });
          })();
      setDraft(null);
      setTab("Active");
      if (claimed.job?.job_id) setDetail(String(claimed.job.job_id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to accept this request.");
    } finally {
      setActing(null);
    }
  };

  const advanceJob = async (job: Job) => {
    setActing(String(job.job_id));
    setError("");
    try {
      await agentApi.advance(job.job_id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update this job.");
    } finally {
      setActing(null);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <Text style={{ ...text, fontSize: 22 }}>Requests</Text>
      <Text style={muted}>Open buy and delivery requests. Accepting one takes the job and hides it from other agents.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: c.error }}>{error}</Text> : null}
      {busy ? <Text style={muted}>Loading requests…</Text> : null}
      {!busy && !error && !visiblePending.length ? <Text style={muted}>No pending requests yet.</Text> : null}
      {visiblePending.map((r) => {
        const key = requestKey(r);
        const kind = r.source_type === "delivery" ? "Help me deliver" : r.source_type === "buy" ? "Help me buy" : "Request";
        const locked = Boolean(acting) || busy;
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
                {r.source_type !== "delivery" && r.target_budget ? (
                  <Text style={{ ...muted, fontSize: 11 }}>
                    Agent fee {formatFeePercent(quoteFeeForAmount(Number(r.target_budget)).feePercent)}%
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${r.title || "request"}`}
                onPress={() => setDetail(detail === key ? null : key)}
                style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ ...text, fontSize: 12 }}>{detail === key ? "Hide" : "View"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reject ${r.title || "request"}`}
                accessibilityState={{ disabled: locked }}
                disabled={locked}
                onPress={() => void rejectRequest(r)}
                style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: locked ? 0.5 : 1 }}
              >
                <Text style={{ ...muted, fontSize: 12 }}>Reject</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Accept ${r.title || "request"}`}
                accessibilityState={{ disabled: !accepting || locked }}
                disabled={!accepting || locked}
                onPress={() => void openAccept(r)}
                style={{ flex: 1, minHeight: 44, backgroundColor: c.brand, borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: accepting && !locked ? 1 : 0.5 }}
              >
                <Text style={{ ...text, color: c.white, fontSize: 12 }}>{acting === key ? "…" : "Accept"}</Text>
              </Pressable>
            </View>
            {detail === key ? (
              <View style={{ gap: 8 }}>
                {r.pickup_address ? <Text style={muted}>Pickup: {r.pickup_address}</Text> : null}
                {r.destination_address ? <Text style={muted}>Delivery: {r.destination_address}</Text> : null}
                <Text style={muted}>{r.description || r.package_description || "No extra details yet."}</Text>
              </View>
            ) : null}
            {!accepting ? <Text style={muted}>You are not accepting new requests.</Text> : null}
          </View>
        );
      })}
      {declined.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Restore ${declined.length} rejected ${declined.length === 1 ? "request" : "requests"}`}
          onPress={() => setDeclined([])}
          style={({ pressed }) => ({
            ...card,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
            backgroundColor: pressed ? c.navActive : c.card,
          })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.iconSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-undo-outline" size={20} color={c.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...text, fontSize: 14 }}>Restore rejected {declined.length === 1 ? "request" : "requests"}</Text>
            <Text style={{ ...muted, fontSize: 12, lineHeight: 18 }}>
              {declined.length} hidden on this dashboard
            </Text>
          </View>
          <View style={{ backgroundColor: c.brand, borderRadius: 12, paddingHorizontal: 14, minHeight: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...text, color: c.white, fontSize: 12 }}>Restore</Text>
          </View>
        </Pressable>
      ) : null}

      <Text style={{ ...text, fontSize: 22 }}>Jobs</Text>
      {pendingPayouts ? <Text style={muted}>{pendingPayouts} vendor payout{pendingPayouts === 1 ? "" : "s"} pending — status stays Pending until admin marks it paid.</Text> : null}
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
          <AgentJobCard
            key={key}
            job={job}
            expanded={detail === key}
            advancing={acting === key}
            onToggle={() => setDetail(detail === key ? null : key)}
            onAdvance={() => void advanceJob(job)}
            onPurchase={() => setPayJob(job)}
          />
        );
      })}

      <Modal visible={Boolean(draft)} animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.background, padding: 20, justifyContent: "center" }}>
          <View style={{ ...card, gap: 12 }}>
            <Text style={{ ...text, fontSize: 18 }}>Accept this request</Text>
            <Text style={muted}>
              {draft?.service === "delivery"
                ? "Set your delivery charge. Accepting takes this job and hides it from other agents."
                : "Confirm the product price. Accepting takes this job, hides it from other agents, and notifies the customer."}
            </Text>
            {draft?.service === "buy" ? (
              <>
                <TextField
                  label="Product price (NGN)"
                  value={draft.productPrice}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setDraft({ ...draft, productPrice: formatMoneyInput(value) })}
                />
                <View>
                  <TextField
                    label="Agent fee (%)"
                    value={quoteFee.fee ? formatFeePercent(quoteFee.fee.feePercent) : quoteFee.loading ? "…" : ""}
                    editable={false}
                  />
                  <AgentFeeBenefit
                    feeAmount={quoteFee.fee?.feeAmount}
                    totalPrice={quoteFee.fee?.totalPrice}
                    formatAmount={money}
                  />
                </View>
                <TextField
                  label="Note (optional)"
                  value={draft.note}
                  onChangeText={(value) => setDraft({ ...draft, note: value })}
                />
              </>
            ) : draft ? (
              <>
                <TextField
                  label="Delivery charge (NGN)"
                  value={draft.chargeAmount}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setDraft({ ...draft, chargeAmount: formatMoneyInput(value) })}
                />
                <TextField
                  label="Pickup estimate (optional)"
                  value={draft.etaNote}
                  onChangeText={(value) => setDraft({ ...draft, etaNote: value })}
                />
              </>
            ) : null}
            <AppButton label={acting ? "Sending…" : "Accept"} onPress={() => void submitAccept()} loading={Boolean(acting)} disabled={Boolean(acting)} />
            <AppButton label="Cancel" variant="secondary" onPress={() => setDraft(null)} disabled={Boolean(acting)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <AgentVendorPaySheet
        job={payJob}
        onClose={() => setPayJob(null)}
        onDone={() => {
          setPayJob(null);
          void load();
        }}
      />
    </View>
  );
}
