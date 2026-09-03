import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import { ErrorBanner, showNotice } from "../components/AppNotice";
import SettingsPage, { SettingsNavRow, useSettingsStyles } from "../components/SettingsPage";
import ReportSheet from "../components/ReportSheet";
import TextField from "../components/TextField";
import {
  deactivateAccount,
  deleteAccount,
  getAccount,
  type AccountInfo,
} from "../api/account";
import { loadAccountExport, shareAccountExcel } from "../utils/exportAccountExcel";
import { getBusinessPage, updateBusinessHours } from "../api/marketplace";
import { useI18n } from "../i18n/I18nProvider";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { unregisterPushTokenOnLogout } from "../push/pushNotifications";
import {
  clearSession,
  getUser,
  isBusinessAccountType,
  isPersonalAccountType,
} from "../storage/session";
import {
  accountStatusKind,
  accountStatusLabel,
  accountStatusTone,
} from "../utils/accountStatus";

function displayName(info: AccountInfo | null) {
  const fromApi = String(info?.name || "").trim();
  if (fromApi) return fromApi;
  const combined = [info?.first_name, info?.last_name].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return String(info?.email || "").trim() || "—";
}

function accountTypeLabel(type: string | undefined, t: (key: string) => string) {
  if (isBusinessAccountType(type)) return t("profile.statusBusiness");
  if (isPersonalAccountType(type)) return t("profile.statusPersonal");
  return "";
}

const HOUR_DAYS = [
  { id: "sun", key: "account.daySun" },
  { id: "mon", key: "account.dayMon" },
  { id: "tue", key: "account.dayTue" },
  { id: "wed", key: "account.dayWed" },
  { id: "thu", key: "account.dayThu" },
  { id: "fri", key: "account.dayFri" },
  { id: "sat", key: "account.daySat" },
] as const;

export default function AccountSettingsScreen() {
  const s = useSettingsStyles();
  const { t } = useI18n();
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState<null | "delete" | "deactivate">(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState("");
  const [hoursClose, setHoursClose] = useState("");
  const [hoursDays, setHoursDays] = useState<string[]>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursMessage, setHoursMessage] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const isBusiness = isBusinessAccountType(info?.account_type);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void Promise.all([getAccount(), getUser()])
        .then(async ([result, sessionUser]) => {
          const data = result.data;
          const sessionName = [
            sessionUser?.business_name,
            sessionUser?.display_name,
            [sessionUser?.first_name || sessionUser?.user_firstname, sessionUser?.last_name || sessionUser?.user_lastname]
              .filter(Boolean)
              .join(" ")
              .trim(),
          ]
            .map((value) => String(value || "").trim())
            .find(Boolean);
          const accountType = String(data?.account_type || sessionUser?.account_type || "").trim();
          setInfo({
            email: data?.email || sessionUser?.email || "",
            first_name: data?.first_name || String(sessionUser?.first_name || sessionUser?.user_firstname || ""),
            last_name: data?.last_name || String(sessionUser?.last_name || sessionUser?.user_lastname || ""),
            name: data?.name || sessionName || "",
            banned: Boolean(data?.banned),
            account_status: data?.account_status || "approved",
            account_type: accountType,
            member_since: data?.member_since || null,
            nin_verified: Boolean(data?.nin_verified),
          });
          if (isBusinessAccountType(accountType)) {
            const page = await getBusinessPage().catch(() => null);
            setHoursOpen(String(page?.profile.hours_open || "").trim());
            setHoursClose(String(page?.profile.hours_close || "").trim());
            setHoursDays(Array.isArray(page?.profile.hours_days) ? page.profile.hours_days : []);
          }
        })
        .finally(() => setLoading(false));
    }, [allowed])
  );

  const onDownload = async () => {
    setError(null);
    setExporting(true);
    try {
      const payload = await loadAccountExport();
      await shareAccountExcel(payload);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      if (/cancel|dismiss/i.test(message)) return;
      setError(t("account.downloadError"));
    } finally {
      setExporting(false);
    }
  };

  const onDeletePress = () => {
    setError(null);
    Alert.alert(t("account.deleteTitle"), t("account.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.deleteContinue"),
        style: "destructive",
        onPress: () => {
          setPassword("");
          setConfirming("delete");
        },
      },
    ]);
  };

  const onDeactivatePress = () => {
    setError(null);
    Alert.alert(t("account.deactivateTitle"), t("account.deactivateBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("account.deactivateContinue"),
        style: "destructive",
        onPress: () => {
          setPassword("");
          setConfirming("deactivate");
        },
      },
    ]);
  };

  const onConfirm = async () => {
    if (!password.trim()) {
      setError(
        confirming === "deactivate" ? t("account.deactivatePassword") : t("account.deletePassword")
      );
      return;
    }
    setSaving(true);
    setError(null);

    if (confirming === "delete") {
      await unregisterPushTokenOnLogout();
      const result = await deleteAccount(password);
      const passwordWrong =
        result.status === 400 ||
        /password is incorrect|incorrect password/i.test(String(result.message || ""));
      const passed =
        result.success ||
        result.status === 401 ||
        result.status === 404 ||
        Boolean(result.timeout);
      if (!passed) {
        setSaving(false);
        setError(
          passwordWrong
            ? result.message || t("account.deletePassword")
            : result.message || t("account.deleteError")
        );
        return;
      }
      await clearSession();
      router.replace("/welcome");
      return;
    }

    const result = await deactivateAccount(password);
    setSaving(false);
    if (!result.success) {
      setError(result.message || t("account.deactivateError"));
      return;
    }
    showNotice({
      title: t("account.deactivateSuccess"),
      message: result.message || t("account.deactivateSuccessBody"),
      tone: "success",
    });
    await unregisterPushTokenOnLogout();
    await clearSession();
    router.replace("/welcome");
  };

  const toggleHourDay = (id: string) => {
    setHoursDays((current) =>
      current.includes(id) ? current.filter((day) => day !== id) : [...current, id]
    );
    setHoursMessage(null);
  };

  const onSaveHours = async () => {
    const open = hoursOpen.trim();
    const close = hoursClose.trim();
    const days = HOUR_DAYS.map((day) => day.id).filter((id) => hoursDays.includes(id));
    if ((open || close || days.length) && (!open || !close || !days.length)) {
      setHoursMessage(t("account.hoursInvalid"));
      return;
    }
    setHoursSaving(true);
    setHoursMessage(null);
    const result = await updateBusinessHours({
      hours_open: open,
      hours_close: close,
      hours_days: days,
    });
    setHoursSaving(false);
    if (!result.success) {
      setHoursMessage(result.message || t("account.hoursError"));
      return;
    }
    setHoursOpen(String(result.data?.open || open).trim());
    setHoursClose(String(result.data?.close || close).trim());
    setHoursDays(Array.isArray(result.data?.days) ? result.data.days : days);
    setHoursMessage(null);
    showNotice({ title: t("account.hoursSaved"), tone: "success" });
  };

  if (!allowed) return null;

  const kind = accountStatusKind(info);
  const tone = accountStatusTone(kind);

  return (
    <SettingsPage kicker={t("account.kicker")} title={t("account.title")} loading={loading} keyboard>
      <FadeIn>
        <View style={s.identityCard}>
          <View style={s.identityCopy}>
            <Text style={s.identityEmail} numberOfLines={1}>
              {displayName(info)}
            </Text>
            <Text style={s.identityType}>{accountTypeLabel(info?.account_type, t)}</Text>
          </View>
          <View
            style={[
              s.statusBadge,
              tone === "danger" && s.statusBadgeBanned,
              tone !== "ok" && tone !== "danger" && s.statusBadgeMuted,
            ]}
          >
            <Text
              style={[
                s.statusBadgeText,
                tone === "danger" && s.statusBadgeTextBanned,
                tone !== "ok" && tone !== "danger" && s.statusBadgeTextMuted,
              ]}
            >
              {accountStatusLabel(kind, t)}
            </Text>
          </View>
        </View>

        {isBusiness ? (
          <>
            <Text style={s.section}>{t("account.hoursTitle")}</Text>
            <View style={[s.card, { overflow: "visible" }]}>
              <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 }}>
                <Text style={s.rowMeta}>{t("account.hoursBody")}</Text>
                <View style={[s.chipRow, { marginTop: 12 }]}>
                  {HOUR_DAYS.map((day) => {
                    const on = hoursDays.includes(day.id);
                    return (
                      <Pressable
                        key={day.id}
                        onPress={() => toggleHourDay(day.id)}
                        style={[s.chip, on && s.chipOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>{t(day.key)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextField
                  label={t("account.hoursOpen")}
                  value={hoursOpen}
                  onChangeText={(value) => {
                    setHoursOpen(value);
                    setHoursMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="09:00"
                />
                <TextField
                  label={t("account.hoursClose")}
                  value={hoursClose}
                  onChangeText={(value) => {
                    setHoursClose(value);
                    setHoursMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="18:00"
                />
                <View style={{ marginTop: 8 }}>
                  <AppButton
                    label={t("account.hoursSave")}
                    onPress={() => void onSaveHours()}
                    loading={hoursSaving}
                    disabled={hoursSaving}
                  />
                </View>
                {hoursMessage ? (
                  <View style={{ marginTop: 14 }}>
                    <ErrorBanner message={hoursMessage} />
                  </View>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        <View style={s.card}>
          <SettingsNavRow
            icon="person-outline"
            title={t("account.personalDetails")}
            onPress={() => router.push("/profile/personal-details")}
          />
          <SettingsNavRow
            icon="shield-checkmark-outline"
            title={t("account.verification")}
            onPress={() => router.push("/profile/verification")}
          />
          <SettingsNavRow
            icon="notifications-outline"
            title={t("account.notifications")}
            last
            onPress={() => router.push("/notifications-settings")}
          />
        </View>

        <View style={s.card}>
          <SettingsNavRow
            icon="download-outline"
            title={t("account.download")}
            subtitle={exporting ? t("account.downloadBusy") : t("account.downloadSub")}
            disabled={exporting}
            onPress={() => void onDownload()}
          />
          <SettingsNavRow
            icon="document-text-outline"
            title={t("account.legal")}
            last
            onPress={() => router.push("/profile/legal")}
          />
        </View>

        <View style={s.card}>
          <SettingsNavRow
            icon="shield-checkmark-outline"
            title={t("help.safety")}
            subtitle={t("help.safetySub")}
            onPress={() => setSafetyOpen(true)}
          />
          <SettingsNavRow
            icon="mail-outline"
            title={t("account.support")}
            last
            onPress={() => router.push("/profile/help")}
          />
        </View>

        <View style={s.card}>
          <SettingsNavRow
            icon="pause-circle-outline"
            title={t("account.deactivate")}
            subtitle={t("account.deactivateSub")}
            onPress={onDeactivatePress}
          />
          <SettingsNavRow
            icon="trash-outline"
            title={t("account.delete")}
            subtitle={t("account.deleteSub")}
            last
            danger
            onPress={onDeletePress}
          />
        </View>

        {confirming ? (
          <View>
            <Text style={s.rowMeta}>
              {confirming === "deactivate"
                ? t("account.deactivatePassword")
                : t("account.deletePassword")}
            </Text>
            <TextField
              label={t("account.password")}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              secureTextEntry
            />
            {error ? (
              <View style={{ marginTop: 4 }}>
                <ErrorBanner message={error} />
              </View>
            ) : null}
            <AppButton
              label={
                confirming === "deactivate"
                  ? t("account.deactivateConfirm")
                  : t("account.deleteConfirm")
              }
              variant="secondary"
              onPress={() => void onConfirm()}
              loading={saving}
              disabled={saving}
            />
          </View>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : null}
      </FadeIn>
      <ReportSheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        contentType="general"
      />
    </SettingsPage>
  );
}
