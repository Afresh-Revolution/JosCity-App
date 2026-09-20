import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { payVendorFromEscrow, type Job } from "../../api/agent";
import { formatAgentAmount } from "../../state/agentPreview";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import AppButton from "../AppButton";
import TextField from "../TextField";

export default function AgentVendorPaySheet({
  job,
  onClose,
  onDone,
}: {
  job: Job | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [vendorEmail, setVendorEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setVendorEmail("");
    setBankName("");
    setAccountNumber("");
    setAccountName("");
    setBankCode("");
    setError("");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const message = await payVendorFromEscrow(job.job_id, {
        vendorEmail,
        bankName,
        accountNumber,
        accountName,
        bankCode,
      });
      reset();
      onDone(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to pay the vendor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(job)} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Pay the vendor</Text>
          <Text style={styles.copy}>
            Product {`NGN ${formatAgentAmount(Number(job?.product_amount || 0))}`} leaves escrow now. Your commission stays held until the customer confirms delivery.
          </Text>
          <TextField
            label="JosCity business email"
            value={vendorEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setVendorEmail}
          />
          <Text style={styles.or}>or pay a vendor who is not on JosCity</Text>
          <TextField label="Bank name" value={bankName} onChangeText={setBankName} />
          <TextField
            label="Account number"
            value={accountNumber}
            keyboardType="number-pad"
            onChangeText={setAccountNumber}
          />
          <TextField label="Account name" value={accountName} onChangeText={setAccountName} />
          <TextField label="Paystack bank code (optional)" value={bankCode} onChangeText={setBankCode} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton label={busy ? "Paying…" : "Pay from escrow"} onPress={() => void submit()} loading={busy} disabled={busy} />
          <Pressable onPress={close} disabled={busy} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    card: { padding: 20, gap: 12, paddingBottom: 40 },
    title: { fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: c.text },
    copy: { fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 21, color: c.textMuted },
    or: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
    error: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: c.error },
    cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    cancelText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: c.textMuted },
  });
}
