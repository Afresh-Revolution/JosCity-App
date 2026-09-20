import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../AppButton";
import TextField from "../TextField";
import AgentServiceChecks from "./AgentServiceChecks";
import { updateAgentPreview, useAgentPreview } from "../../state/agentPreview";
import { useTheme } from "../../theme/ThemeProvider";
import { type PendingAgentApplication } from "../../api/agentSignup";
import { usernameError } from "../../utils/accountNames";

export default function AgentProfileEditor({
  onClose,
  onSave,
  title = "Edit profile",
  copy = "These are the same fields from your agent account.",
}: {
  onClose: () => void;
  onSave?: (draft: PendingAgentApplication) => Promise<void>;
  title?: string;
  copy?: string;
}) {
  const profile = useAgentPreview();
  const [draft, setDraft] = useState({ ...profile, nin: profile.nin || "", username: profile.username || "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 620, alignSelf: "center", gap: 12 }}>
          <Text style={{ fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, color: colors.text }}>{title}</Text>
          <Text style={{ color: colors.textMuted }}>{copy}</Text>
          {([["firstName", "First name"], ["lastName", "Last name"], ["username", "Username"], ["email", "Email address"], ["phone", "Phone number"], ["gender", "Gender (optional)"], ["address", "Address / service area"], ["bio", "Agent bio"], ["category", "Categories / specialties"], ["nin", "NIN number (optional)"]] as const).map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              value={draft[key]}
              onChangeText={(value) =>
                setDraft({
                  ...draft,
                  [key]:
                    key === "nin"
                      ? value.replace(/\D/g, "").slice(0, 11)
                      : key === "username"
                        ? value.replace(/^@+/, "")
                        : value,
                })
              }
              multiline={key === "bio"}
              keyboardType={key === "email" ? "email-address" : key === "phone" || key === "nin" ? "phone-pad" : "default"}
              autoCapitalize={key === "email" || key === "username" ? "none" : "sentences"}
              autoCorrect={key !== "username"}
              helper={
                key === "username"
                  ? "Letters, numbers, underscores or periods."
                  : undefined
              }
            />
          ))}
          <Text style={{ color: colors.text, fontFamily: "Montserrat_600SemiBold" }}>Services offered</Text>
          <AgentServiceChecks
            services={draft.services}
            onChange={(services) => setDraft({ ...draft, services })}
          />
          {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
          <AppButton
            label={busy ? "Saving…" : "Save changes"}
            disabled={busy}
            onPress={() => {
              if (!draft.firstName.trim() || !draft.lastName.trim()) {
                setError("Enter your first and last name.");
                return;
              }
              const handleMessage = usernameError(draft.username);
              if (handleMessage) {
                setError(handleMessage);
                return;
              }
              if (onSave && !draft.bio.trim()) {
                setError("Tell customers how you can help.");
                return;
              }
              if (onSave && !draft.category.trim()) {
                setError("Add at least one category or specialty.");
                return;
              }
              if (onSave && !draft.services.length) {
                setError("Choose Help me buy, Help me deliver, or both.");
                return;
              }
              if (onSave && draft.nin.replace(/\D/g, "").length > 0 && draft.nin.replace(/\D/g, "").length !== 11) {
                setError("NIN must be 11 digits if you add it.");
                return;
              }
              updateAgentPreview({
                firstName: draft.firstName.trim(),
                lastName: draft.lastName.trim(),
                username: String(draft.username || "").replace(/^@+/, "").trim(),
                email: draft.email,
                phone: draft.phone,
                gender: draft.gender,
                address: draft.address,
                bio: draft.bio,
                category: draft.category,
                services: draft.services,
                nin: draft.nin.replace(/\D/g, ""),
              });
              if (!onSave) {
                onClose();
                return;
              }
              setBusy(true);
              void onSave({
                bio: draft.bio,
                category: draft.category,
                services: draft.services,
                nin: draft.nin.replace(/\D/g, ""),
              })
                .then(onClose)
                .catch((err) => setError(err instanceof Error ? err.message : "Unable to save."))
                .finally(() => setBusy(false));
            }}
          />
          <AppButton label="Cancel" variant="secondary" disabled={busy} onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
