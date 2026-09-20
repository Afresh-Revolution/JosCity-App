import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { agentApi, type AgentProfile } from "../api/agent";
import { agentRequest } from "../api/agentTransport";
import { becomePayloadFromSignup, type PendingAgentApplication } from "../api/agentSignup";
import {
  clearPendingAgentApplication,
  loadPendingAgentApplication,
  savePendingAgentApplication,
} from "../storage/pendingAgent";
import { getAuthToken } from "../storage/session";
import { updateAgentPreview } from "./agentPreview";

export type AgentDashboardStats = {
  active_jobs: number;
  held_agent_fees: number;
  completed_today: number;
  pending_quotes: number;
  pending_payouts: number;
};

export function useAgentActivation() {
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsDetails, setNeedsDetails] = useState(false);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState<AgentDashboardStats | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const becoming = useRef(false);
  const refresh = useCallback(async () => {
    const token = await getAuthToken();
    setAuthenticated(Boolean(token));
    if (!token) {
      setStatus(null);
      setNeedsDetails(false);
      setProfile(null);
      setStats(null);
      setWalletBalance(null);
      return;
    }
    if (becoming.current) return;
    setBusy(true);
    setError("");
    try {
      const me = await agentApi.me();
      setProfile(me);
      if (me.agent_type) {
        setStatus(me.agent_status || null);
        setNeedsDetails(false);
        await clearPendingAgentApplication();
        updateAgentPreview({
          firstName: me.user_firstname || "",
          lastName: me.user_lastname || "",
          username: String(me.user_name || "").replace(/^@/, ""),
          avatar: me.user_picture || "",
          address: me.agent_base_address || "",
          bio: me.agent_bio || "",
          category: me.categories?.map((item) => item.name).join(", ") || "",
          workingAreas: (me.agent_working_areas || []).join(", "),
          services:
            me.agent_type === "both"
              ? ["Help me buy", "Help me deliver"]
              : me.agent_type === "deliver"
                ? ["Help me deliver"]
                : ["Help me buy"],
          accepting: me.agent_accepting_requests,
          requests: [],
        });
        try {
          const [dash, wallet, jobs] = await Promise.all([
            agentApi.dashboard(),
            agentRequest<{ balance: number }>("/account/wallet", { auth: true }),
            agentApi.jobs("agent", 1),
          ]);
          setStats({
            ...dash,
            pending_payouts: jobs.filter((job) => job.payout_pending_manual).length,
          });
          setWalletBalance(Number(wallet.balance || 0));
        } catch {
          setStats(null);
          setWalletBalance(null);
        }
        return;
      }
      const pending = await loadPendingAgentApplication();
      if (!pending || (!pending.bio && !pending.category && !pending.nin)) {
        setStatus(null);
        setNeedsDetails(true);
        return;
      }
      becoming.current = true;
      try {
        await agentApi.become(becomePayloadFromSignup(pending));
        await clearPendingAgentApplication();
        setNeedsDetails(false);
        setNotice("Your agent details from signup are now on your account.");
        becoming.current = false;
        await refresh();
        return;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to activate agent services.";
        if (/already exists/i.test(message)) {
          await clearPendingAgentApplication();
          setNeedsDetails(false);
        } else {
          becoming.current = false;
          setError(message);
          setNeedsDetails(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to activate agent services.");
      setNeedsDetails(true);
    } finally {
      becoming.current = false;
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const confirm = async (code: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await agentApi.confirmOtp(code.trim());
      setNotice(
        result.agentStatus === "active"
          ? "Your agent account is active."
          : "Email confirmed. NIN verification is still pending."
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code could not be confirmed.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await agentApi.resendOtp();
      setNotice("A new code was sent to your email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resend the code.");
    } finally {
      setBusy(false);
    }
  };

  const setAccepting = async (accepting: boolean) => {
    updateAgentPreview({ accepting });
    try {
      await agentApi.updateMe({ accepting });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update availability.");
    }
  };

  const saveDetails = async (draft: PendingAgentApplication) => {
    setBusy(true);
    setError("");
    try {
      await savePendingAgentApplication(draft);
      await agentApi.become(becomePayloadFromSignup(draft));
      await clearPendingAgentApplication();
      setStatus("pending_review");
      setNeedsDetails(false);
      setNotice("Your agent details from signup are now on your account.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save agent details.");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return {
    authenticated,
    status,
    error,
    notice,
    busy,
    needsDetails,
    setNeedsDetails,
    profile,
    stats,
    walletBalance,
    refresh,
    confirm,
    resend,
    saveDetails,
    setAccepting,
  };
}
