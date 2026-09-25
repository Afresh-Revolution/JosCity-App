import { useCallback, useState } from "react";
import { Alert, Platform, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import TextField from "./TextField";
import { useSettingsStyles } from "./SettingsPage";
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricStatus,
  type BiometricStatus,
} from "../biometrics/biometrics";
import { biometricCopy } from "../biometrics/logic";
import type { AccountType } from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  email?: string;
  accountType: AccountType;
};

export default function BiometricSettingsCard({ email, accountType }: Props) {
  const { colors } = useTheme();
  const s = useSettingsStyles();
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus(await getBiometricStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!status?.available) return null;

  const copy = biometricCopy(status.kind, Platform.OS);
  const enabled = status.enabled;

  const onToggle = async (next: boolean) => {
    if (busy) return;
    if (!next) {
      setBusy(true);
      const result = await disableBiometricLogin({ confirm: true });
      setBusy(false);
      if (!result.success) {
        Alert.alert(copy.noun, result.message || "Could not turn off biometric sign-in.");
        return;
      }
      setPassword("");
      await load();
      return;
    }
    if (!email?.includes("@")) {
      Alert.alert(copy.noun, "Your account email is needed before turning this on.");
      return;
    }
    if (!password.trim()) {
      Alert.alert(copy.noun, `Enter your password to turn on ${copy.noun}.`);
      return;
    }
    if (!status.enrolled) {
      Alert.alert(copy.noun, `Set up ${copy.noun} in your device settings first.`);
      return;
    }
    setBusy(true);
    const result = await enableBiometricLogin({
      email,
      password,
      accountType,
    });
    setBusy(false);
    if (!result.success) {
      Alert.alert(copy.noun, result.message || "Could not turn on biometric sign-in.");
      return;
    }
    setPassword("");
    await load();
  };

  return (
    <>
      <Text style={[s.section, { marginTop: 28 }]}>DEVICE UNLOCK</Text>
      <View style={s.card}>
        <View style={[s.row, s.rowLast, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{copy.noun}</Text>
            <Text style={s.rowMeta}>
              {enabled
                ? `Sign in with ${copy.noun} for ${status.hint?.email || email || "this account"}.`
                : status.enrolled
                  ? `Use ${copy.noun} on the login screen instead of typing your password.`
                  : `Set up ${copy.noun} on this phone, then turn it on here.`}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => void onToggle(value)}
            disabled={busy || (!enabled && !status.enrolled)}
            trackColor={{ false: colors.fieldBorder, true: colors.primary }}
            thumbColor={colors.white}
            accessibilityLabel={`Use ${copy.noun} to sign in`}
          />
        </View>
      </View>
      {!enabled && status.enrolled ? (
        <TextField
          label={`Password for ${copy.noun}`}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      ) : null}
    </>
  );
}
