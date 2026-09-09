import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage, { SettingsNavRow, useSettingsStyles } from "../components/SettingsPage";
import TextField from "../components/TextField";
import {
  getSupportContent,
  sendAppFeedback,
  sendProblemReport,
  type SupportContent,
  type SupportFaq,
} from "../api/support";
import { LEGAL, openExternalUrl } from "../constants/legal";
import ReportSheet from "../components/ReportSheet";
import { useI18n } from "../i18n/I18nProvider";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

function digitsOnly(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export default function HelpSupportScreen() {
  const s = useSettingsStyles();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useI18n();
  const router = useRouter();
  const allowed = useRequirePersonalAccount();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<SupportContent | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [problemSaving, setProblemSaving] = useState(false);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await getSupportContent();
    if (result.data) {
      const content = result.data;
      setContent(content);
      setCategory((current) => current || content.categories[0]?.label || "");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  if (!allowed) return null;

  const emails = content?.emails?.length
    ? content.emails
    : [{ id: 0, kind: "email" as const, label: t("help.email"), value: LEGAL.supportEmail }];
  const phones = content?.phones || [];
  const faqs = content?.faqs || [];
  const categories = content?.categories || [];
  const chatHours = content?.chat_hours || "";
  const chatUrl = content?.chat_url || "";
  const guide = content?.member_guide;
  const firstEmail = emails[0]?.value;

  const onChat = () => {
    if (chatUrl) {
      void openExternalUrl(chatUrl);
      return;
    }
    if (firstEmail) void openExternalUrl(`mailto:${firstEmail}`);
  };

  const onGuide = () => {
    if (guide?.url) {
      void openExternalUrl(guide.url);
      return;
    }
    if (guide?.body) {
      Alert.alert(guide.title || t("help.guide"), guide.body);
    }
  };

  const onSendProblem = async () => {
    setProblemError(null);
    if (!category) {
      setProblemError(t("help.problemCategoryError"));
      return;
    }
    setProblemSaving(true);
    const result = await sendProblemReport(category, problem);
    setProblemSaving(false);
    if (!result.success) {
      setProblemError(result.message || t("help.problemError"));
      return;
    }
    setProblem("");
    Alert.alert(t("help.problemSentTitle"), result.message || t("help.problemSent"));
  };

  const onSendFeedback = async () => {
    setFeedbackError(null);
    if (rating < 1) {
      setFeedbackError(t("help.ratingError"));
      return;
    }
    setFeedbackSaving(true);
    const result = await sendAppFeedback(rating, feedback);
    setFeedbackSaving(false);
    if (!result.success) {
      setFeedbackError(result.message || t("help.feedbackError"));
      return;
    }
    setFeedback("");
    setRating(0);
    Alert.alert(t("help.feedbackSentTitle"), result.message || t("help.feedbackSent"));
  };

  return (
    <SettingsPage
      kicker={content?.kicker || t("help.kicker")}
      title={content?.title || t("help.title")}
      loading={loading}
      keyboard
    >
      <FadeIn>
        <View style={s.card}>
          <SettingsNavRow
            icon="chatbubble-ellipses-outline"
            title={t("help.chat")}
            subtitle={chatHours || undefined}
            onPress={onChat}
          />
          {phones.map((phone) => (
            <SettingsNavRow
              key={`phone-${phone.id}`}
              icon="call-outline"
              title={phone.label || t("help.call")}
              subtitle={phone.value}
              onPress={() => void openExternalUrl(`tel:${digitsOnly(phone.value)}`)}
            />
          ))}
          {emails.map((email) => (
            <SettingsNavRow
              key={`email-${email.id}`}
              icon="mail-outline"
              title={email.label || t("help.email")}
              subtitle={email.value}
              onPress={() => void openExternalUrl(`mailto:${email.value}`)}
            />
          ))}
          <SettingsNavRow
            icon="shield-checkmark-outline"
            title={t("help.safety")}
            subtitle={t("help.safetySub")}
            onPress={() => setSafetyOpen(true)}
          />
          <SettingsNavRow
            icon="mail-outline"
            title={t("help.childSafetyEmail")}
            subtitle="child-safety@joscity.com"
            onPress={() => void openExternalUrl("mailto:child-safety@joscity.com")}
          />
          <SettingsNavRow
            icon="document-text-outline"
            title={t("help.legal")}
            last={!guide?.title && !guide?.body && !guide?.url}
            onPress={() => router.push("/profile/legal")}
          />
          {guide?.title && (guide.url || guide.body) ? (
            <SettingsNavRow
              icon="book-outline"
              title={guide.title}
              subtitle={guide.body || undefined}
              last
              onPress={onGuide}
            />
          ) : null}
        </View>

        <Text style={s.section}>{t("help.faqSection")}</Text>
        <View style={s.card}>
          {!faqs.length ? (
            <Text style={[s.empty, { paddingHorizontal: 14 }]}>{t("help.faqEmpty")}</Text>
          ) : (
            faqs.map((item, index) => (
              <FaqRow
                key={item.id}
                item={item}
                last={index === faqs.length - 1}
                open={openFaq === item.id}
                onToggle={() => setOpenFaq((current) => (current === item.id ? null : item.id))}
              />
            ))
          )}
        </View>

        <Text style={[s.section, { marginTop: 20 }]}>{t("help.problemSection")}</Text>
        <Text style={styles.intro}>{t("help.problemIntro")}</Text>
        <Text style={styles.fieldLabel}>{t("help.problemAbout")}</Text>
        <Pressable
          onPress={() => setCategoryOpen(true)}
          style={styles.select}
          accessibilityRole="button"
          accessibilityLabel={t("help.problemAbout")}
        >
          <Text style={styles.selectValue}>{category || t("help.problemAbout")}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
        <TextField
          label={t("help.problemDescribe")}
          value={problem}
          onChangeText={setProblem}
          multiline
          placeholder={t("help.problemPlaceholder")}
          style={{ minHeight: 110, textAlignVertical: "top" }}
        />
        {problemError ? <Text style={s.error}>{problemError}</Text> : null}
        <SendButton
          label={t("help.sendReport")}
          icon="paper-plane-outline"
          loading={problemSaving}
          onPress={() => void onSendProblem()}
        />

        <View style={[s.card, styles.feedbackCard]}>
          <Text style={s.rowTitle}>{t("help.feedbackTitle")}</Text>
          <Text style={styles.intro}>{t("help.feedbackPrompt")}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t("help.star", { count: value })}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={28}
                  color={value <= rating ? colors.primary : colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
          <TextField
            label={t("help.feedbackImprove")}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            placeholder={t("help.optional")}
            style={{ minHeight: 90, textAlignVertical: "top" }}
          />
          {feedbackError ? <Text style={s.error}>{feedbackError}</Text> : null}
          <SendButton
            label={t("help.sendFeedback")}
            loading={feedbackSaving}
            onPress={() => void onSendFeedback()}
          />
        </View>
      </FadeIn>

      <Modal visible={categoryOpen} transparent animationType="fade" onRequestClose={() => setCategoryOpen(false)}>
        <Pressable style={styles.dim} onPress={() => setCategoryOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("help.problemAbout")}</Text>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setCategory(item.label);
                  setCategoryOpen(false);
                }}
                style={styles.sheetRow}
              >
                <Text style={styles.sheetLabel}>{item.label}</Text>
                {category === item.label ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <ReportSheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        contentType="general"
      />
    </SettingsPage>
  );
}

function FaqRow({
  item,
  last,
  open,
  onToggle,
}: {
  item: SupportFaq;
  last: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const s = useSettingsStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={[s.navRow, last && s.rowLast, { alignItems: "flex-start" }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={s.rowTitle}>{item.question}</Text>
        {open ? <Text style={[s.rowMeta, { marginTop: 8 }]}>{item.answer}</Text> : null}
      </View>
      <Ionicons
        name={open ? "chevron-up" : "chevron-down"}
        size={18}
        color={colors.textMuted}
        style={{ marginTop: 4 }}
      />
    </Pressable>
  );
}

function SendButton({
  label,
  icon,
  loading,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [styles.send, pressed && styles.sendPressed, loading && styles.sendDisabled]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.white} /> : null}
      <Text style={styles.sendLabel}>{loading ? "…" : label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 14,
    },
    fieldLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    select: {
      minHeight: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    selectValue: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    send: {
      minHeight: 54,
      borderRadius: 28,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 22,
    },
    sendPressed: {
      backgroundColor: colors.primaryPressed,
    },
    sendDisabled: {
      opacity: 0.65,
    },
    sendLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.white,
    },
    feedbackCard: {
      padding: 16,
      marginTop: 8,
    },
    stars: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    dim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 28,
    },
    sheetTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
      marginBottom: 8,
    },
    sheetRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sheetLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.text,
    },
  });
}
