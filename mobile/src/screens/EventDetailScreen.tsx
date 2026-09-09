import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import TextField from "../components/TextField";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  eventDescription,
  eventId,
  eventLocation,
  eventTitle,
  getEvent,
  getMyEventPaymentRequest,
  isPaidJosCityEvent,
  submitEventPaymentRequest,
  type EventPaymentRequest,
  type ExploreEvent,
} from "../api/explore";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getCachedOpenEvent } from "../state/openEvent";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { firstMediaUrl, formatEventWhen } from "../utils/format";

export default function EventDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id || 0);
  const [event, setEvent] = useState<ExploreEvent | null>(() => getCachedOpenEvent(id));
  const [payment, setPayment] = useState<EventPaymentRequest | null>(null);
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(!event);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [row, request] = await Promise.all([
      getEvent(id),
      getMyEventPaymentRequest(id),
    ]);
    if (row) setEvent(row);
    setPayment(request);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const copy = async (value?: string | null, label?: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert(t("explore.copied"), label || value);
  };

  const onPay = async () => {
    if (!id || saving) return;
    setSaving(true);
    const result = await submitEventPaymentRequest(id, accountName.trim());
    setSaving(false);
    if (!result.success) {
      Alert.alert(t("explore.eventsTitle"), result.message || t("explore.payError"));
      return;
    }
    Alert.alert(t("explore.eventsTitle"), result.message || t("explore.paySent"));
    setAccountName("");
    void load();
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  const image = firstMediaUrl(event?.image || event?.event_cover);
  const when = formatEventWhen(event?.date || event?.event_date);
  const price = Number(event?.event_price_naira || 0);
  const paid = event ? isPaidJosCityEvent(event) : false;
  const status = String(payment?.status || "").toLowerCase();

  return (
    <FeedShell
      tab="explore"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/events"))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event ? eventTitle(event) : t("explore.eventsTitle")}
          </Text>
        </View>
      }
    >
      {loading && !event ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : !event ? (
        <Text style={styles.empty}>{t("explore.eventMissing")}</Text>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <FadeIn>
              {image ? (
                <Image source={{ uri: image }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.fallback]} />
              )}
              {when ? <Text style={styles.when}>{when}</Text> : null}
              <Text style={styles.title}>{eventTitle(event)}</Text>
              <Text style={styles.meta}>{eventLocation(event)}</Text>
              {eventDescription(event) ? (
                <Text style={styles.body}>{eventDescription(event)}</Text>
              ) : null}
            </FadeIn>

            {paid ? (
              <FadeIn delay={80} style={styles.payBox}>
                <Text style={styles.payKicker}>{t("explore.ticketFee")}</Text>
                <Text style={styles.price}>₦{price.toLocaleString("en-NG")}</Text>
                <Text style={styles.payHint}>{t("explore.payHint")}</Text>
                {[
                  [t("explore.payEmail"), event.payment_contact_email],
                  [t("explore.payBank"), event.payment_bank_name],
                  [t("explore.payAccountName"), event.payment_account_name],
                  [t("explore.payAccountNumber"), event.payment_account_number],
                ].map(([label, value]) =>
                  value ? (
                    <Pressable
                      key={label}
                      onPress={() => void copy(value, label ?? undefined)}
                      style={styles.payRow}
                    >
                      <View style={styles.payCopy}>
                        <Text style={styles.payLabel}>{label}</Text>
                        <Text style={styles.payValue}>{value}</Text>
                      </View>
                      <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null
                )}
                {status === "accepted" ? (
                  <Text style={styles.statusOk}>
                    {t("explore.payAccepted")}
                    {payment?.ticket_number ? ` · ${payment.ticket_number}` : ""}
                  </Text>
                ) : status === "pending" ? (
                  <Text style={styles.statusWait}>{t("explore.payPending")}</Text>
                ) : (
                  <>
                    <TextField
                      label={t("explore.yourAccountName")}
                      value={accountName}
                      onChangeText={setAccountName}
                      autoCapitalize="words"
                    />
                    <AppButton
                      label={t("explore.feePaid")}
                      onPress={() => void onPay()}
                      loading={saving}
                      disabled={!accountName.trim()}
                    />
                  </>
                )}
              </FadeIn>
            ) : (
              <Text style={styles.freeNote}>{t("explore.freeEvent")}</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingBottom: 10,
      gap: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
      paddingRight: 16,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    image: {
      width: "100%",
      height: 200,
      borderRadius: 18,
      backgroundColor: colors.cream,
      marginBottom: 14,
    },
    fallback: {
      backgroundColor: colors.border,
    },
    when: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    title: {
      marginTop: 6,
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      color: colors.text,
    },
    meta: {
      marginTop: 6,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    body: {
      marginTop: 14,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    empty: {
      textAlign: "center",
      marginTop: 48,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    payBox: {
      marginTop: 22,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
    },
    payKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.7,
      color: colors.textMuted,
    },
    price: {
      marginTop: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
    },
    payHint: {
      marginTop: 8,
      marginBottom: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 10,
    },
    payCopy: { flex: 1 },
    payLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
    },
    payValue: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    statusOk: {
      marginTop: 14,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.success,
    },
    statusWait: {
      marginTop: 14,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.primary,
    },
    freeNote: {
      marginTop: 20,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
