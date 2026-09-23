import { useCallback, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import SettingsPage, { useSettingsStyles } from "../components/SettingsPage";
import TextField from "../components/TextField";
import BiometricSettingsCard from "../components/BiometricSettingsCard";
import { changePassword, getSecurity, updateTwoFactor, type SecurityInfo } from "../api/account";
import { getUserProfile } from "../api/auth";
import { updateBiometricPassword } from "../biometrics/biometrics";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import {
  getAccountType,
  getUser,
  isBusinessAccountType,
  mergeStoredUser,
  setUser,
  type StoredUser,
} from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";

function formatNin(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return digits;
}

function formatCac(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

export default function VerificationSecurityScreen() {
  const { colors } = useTheme();
  const s = useSettingsStyles();

  const allowed = useRequirePersonalAccount();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [saving2fa, setSaving2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const stored = (await getUser()) as StoredUser | null;
    const sessionType = await getAccountType();
    const [security, profile] = await Promise.all([
      getSecurity(),
      getUserProfile().catch(() => null),
    ]);

    const profileUser = profile?.user || stored;
    const accountType =
      security.data?.account_type ||
      String(profileUser?.account_type || sessionType || "personal");
    const business = isBusinessAccountType(accountType);
    setIsBusiness(business);

    const nin = business
      ? ""
      : String(security.data?.nin_number || profileUser?.nin_number || "").trim();
    const cac = business
      ? formatCac(
          security.data?.cac_number ||
            String(profileUser?.CAC_number || profileUser?.cac_number || "")
        )
      : "";

    if (profile?.user) {
      await setUser(mergeStoredUser(stored, profile.user));
    }

    setInfo({
      account_type: accountType,
      nin_number: nin,
        nin_verified: business
          ? false
          : Boolean(security.data?.nin_verified) && Boolean(nin),
      nin_masked: business ? "" : security.data?.nin_masked || "",
      cac_number: cac,
      cac_verified: business
        ? Boolean(security.data?.cac_verified) ||
          Boolean(profileUser?.cac_verified)
        : false,
      two_factor_enabled: Boolean(security.data?.two_factor_enabled),
      email: security.data?.email || String(profileUser?.user_email || profileUser?.email || ""),
      account_status: security.data?.account_status || String(profileUser?.account_status || ""),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const onChangePassword = async () => {
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setError(null);
    setSavingPassword(true);
    const result = await changePassword(current, next);
    setSavingPassword(false);
    if (!result.success) {
      setError(result.message || "Could not update password.");
      return;
    }
    await updateBiometricPassword(next).catch(() => undefined);
    setCurrent("");
    setNext("");
    setConfirm("");
    Alert.alert("Password updated");
  };

  const onToggle2fa = async (enabled: boolean) => {
    if (!password.trim()) {
      setError("Enter your password to change two-factor authentication.");
      return;
    }
    setError(null);
    setSaving2fa(true);
    const result = await updateTwoFactor(enabled, password);
    setSaving2fa(false);
    if (!result.success) {
      setError(result.message || "Could not update two-factor authentication.");
      return;
    }
    setPassword("");
    setInfo((currentInfo) =>
      currentInfo ? { ...currentInfo, two_factor_enabled: enabled } : currentInfo
    );
  };

  if (!allowed) return null;

  return (
    <SettingsPage kicker="Account" title="Verification & security" loading={loading} keyboard>
      <FadeIn>
        {isBusiness ? (
          <>
            <Text style={s.section}>CAC</Text>
            <View style={s.card}>
              <View style={[s.row, s.rowLast]}>
                <Text style={s.rowTitle}>CAC number</Text>
                <Text style={s.rowMeta}>
                  {formatCac(info?.cac_number) || "Not on file from signup"}
                </Text>
                {info?.cac_verified ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>CAC VERIFIED</Text>
                  </View>
                ) : info?.cac_number ? (
                  <View style={[s.badge, { backgroundColor: colors.sheet }]}>
                    <Text style={[s.badgeText, { color: colors.textMuted }]}>CAC pending</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={s.section}>NIN</Text>
            <View style={s.card}>
              <View style={[s.row, s.rowLast]}>
                <Text style={s.rowTitle}>National identity number</Text>
                <Text style={s.rowMeta}>
                  {formatNin(info?.nin_number) || "Not on file from signup"}
                </Text>
                {info?.nin_verified ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>NIN VERIFIED</Text>
                  </View>
                ) : info?.nin_number ? (
                  <View style={[s.badge, { backgroundColor: colors.sheet }]}>
                    <Text style={[s.badgeText, { color: colors.textMuted }]}>NIN pending</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}

        <Text style={s.section}>PASSWORD</Text>
        <TextField
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <TextField
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <TextField
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <AppButton
          label="Update password"
          onPress={() => void onChangePassword()}
          loading={savingPassword}
          disabled={!current || !next || savingPassword}
        />

        <BiometricSettingsCard
          email={info?.email}
          accountType={isBusiness ? "business" : "personal"}
        />

        <Text style={[s.section, { marginTop: 28 }]}>TWO-FACTOR AUTHENTICATION</Text>
        <View style={s.card}>
          <View style={[s.row, s.rowLast, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Email codes at sign-in</Text>
              <Text style={s.rowMeta}>
                When this is on, we email a 6-digit code after your password.
              </Text>
            </View>
            <Switch
              value={Boolean(info?.two_factor_enabled)}
              onValueChange={(value) => void onToggle2fa(value)}
              disabled={saving2fa}
              trackColor={{ false: colors.fieldBorder, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </View>
        <TextField
          label="Confirm with password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </FadeIn>
    </SettingsPage>
  );
}
