import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "./JosCityLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showError, showNotice } from "./AppNotice";
import {
  REPORT_REASONS,
  submitSafetyReport,
  type SafetyContentType,
} from "../api/safetyReports";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

type Props = {
  visible: boolean;
  onClose: () => void;
  contentType: SafetyContentType;
  contentId?: string | number | null;
  reportedUserId?: number | null;
};

export default function ReportSheet({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [reason, setReason] = useState("child_safety");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const result = await submitSafetyReport({
      contentType,
      contentId,
      reportedUserId,
      reason,
      description,
    });
    setBusy(false);
    if (!result.success) {
      showError(result.message || t("report.failed"));
      return;
    }
    showNotice({
      title: t("report.sentTitle"),
      message: result.already_reported ? t("report.already") : t("report.sent"),
      tone: "success",
    });
    setDescription("");
    setReason("child_safety");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.dim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("report.title")}</Text>
          <ScrollView style={styles.reasons} keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setReason(item.id)}
                style={[styles.reason, reason === item.id && styles.reasonOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === item.id }}
              >
                <Text style={[styles.reasonText, reason === item.id && styles.reasonTextOn]}>
                  {t(`report.reason.${item.id}`)}
                </Text>
              </Pressable>
            ))}
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("report.details")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              style={styles.input}
            />
            <Text style={styles.hint}>{t("report.hint")}</Text>
          </ScrollView>
          <Pressable
            onPress={() => void submit()}
            disabled={busy}
            style={[styles.submit, busy && styles.submitBusy]}
            accessibilityRole="button"
            accessibilityLabel={t("report.submit")}
          >
            {busy ? (
              <JosCityLoader color={colors.white} />
            ) : (
              <Text style={styles.submitText}>{t("report.submit")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 16,
      maxHeight: "86%",
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
      marginBottom: 12,
    },
    reasons: { maxHeight: 420 },
    reason: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    reasonOn: { borderColor: colors.primary, backgroundColor: colors.sheet },
    reasonText: { fontFamily: "Montserrat_500Medium", color: colors.text, fontSize: 15 },
    reasonTextOn: { color: colors.primary },
    input: {
      minHeight: 80,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      color: colors.text,
      fontFamily: "Montserrat_400Regular",
      marginTop: 8,
    },
    hint: {
      marginTop: 8,
      marginBottom: 12,
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: "Montserrat_400Regular",
    },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    submitBusy: { opacity: 0.7 },
    submitText: { color: colors.white, fontFamily: "Montserrat_700Bold", fontSize: 16 },
  });
}
