import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { agentApi, jobTitle, type Job } from "../../api/agent";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import AppButton from "../AppButton";

const STAR_GOLD = "#E8B923";

export default function AgentRatingSheet({
  job,
  onClose,
  onDone,
}: {
  job: Job | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setRating(0);
    setComment("");
    setError("");
    setBusy(false);
    onClose();
  };

  const submit = async () => {
    if (!job) return;
    if (rating < 1) {
      setError("Choose 1 to 5 stars.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await agentApi.review(job.job_id, { rating, comment: comment.trim() });
      setRating(0);
      setComment("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit this rating.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(job)} animationType="fade" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <Pressable style={styles.dim} onPress={close} />
        <View style={styles.sheet}>
          <Text style={styles.kicker}>Rate your agent</Text>
          <Text style={styles.title}>{job ? jobTitle(job) : ""}</Text>
          <Text style={styles.copy}>Stars are public on the agent’s profile. Hate speech and curse words are not allowed.</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                onPress={() => setRating(value)}
                hitSlop={8}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={36}
                  color={value <= rating ? STAR_GOLD : c.textMuted}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="How did this job go? (optional)"
            placeholderTextColor={c.textMuted}
            multiline
            style={styles.input}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton label={busy ? "Sending…" : "Submit rating"} onPress={() => void submit()} loading={busy} disabled={busy} />
          <Pressable onPress={close} disabled={busy} style={styles.later}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      gap: 12,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.primary,
    },
    title: { fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: c.text },
    copy: { fontFamily: "Montserrat_400Regular", fontSize: 13, lineHeight: 19, color: c.textMuted },
    stars: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 6 },
    input: {
      minHeight: 88,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: c.text,
      textAlignVertical: "top",
    },
    error: { fontFamily: "Montserrat_400Regular", fontSize: 13, color: c.error },
    later: { minHeight: 40, alignItems: "center", justifyContent: "center" },
    laterText: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: c.textMuted },
  });
}
