import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "./AppButton";
import JosCityLoader from "./JosCityLoader";
import { biometricCopy, type BiometricKind } from "../biometrics/logic";
import { colors } from "../theme/colors";

type Props = {
  visible: boolean;
  busy?: boolean;
  kind: BiometricKind;
  mode?: "setup" | "update";
  email?: string;
  onEnable: () => void;
  onSkip: () => void;
};

export default function BiometricSetupSheet({
  visible,
  busy = false,
  kind,
  mode = "setup",
  email,
  onEnable,
  onSkip,
}: Props) {
  const insets = useSafeAreaInsets();
  const copy = biometricCopy(kind);
  const styles = useMemo(() => makeStyles(), []);
  const title = mode === "update" ? `Use ${copy.noun} for this account?` : `Use ${copy.noun} next time?`;
  const body =
    mode === "update"
      ? `${copy.noun} on this phone is saved for a different JOSCITY login. Turn it on for ${email || "this account"} instead.`
      : `You can sign in to JOSCITY with ${copy.noun} instead of typing your password. Your password stays on this device.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onSkip}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onSkip} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <Ionicons name={copy.icon} size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{body}</Text>
          <AppButton
            label={busy ? "Saving…" : `Use ${copy.noun}`}
            onPress={onEnable}
            loading={busy}
            disabled={busy}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={onSkip}
            disabled={busy}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            {busy ? <JosCityLoader color={colors.textMuted} size="small" /> : <Text style={styles.skipLabel}>Not now</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.cream,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: "#D0CBC3",
      marginBottom: 18,
    },
    iconWrap: {
      alignSelf: "center",
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.iconSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      lineHeight: 28,
      color: colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 22,
    },
    skip: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },
    skipLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
