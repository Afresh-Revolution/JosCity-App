import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function SignOutSheet({
  visible,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(420)).current;
  const styles = useMemo(() => makeStyles(), []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheet, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    overlay.setValue(0);
    sheet.setValue(420);
  }, [overlay, sheet, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose}>
          <Animated.View style={[styles.dim, { opacity: overlay }]} />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY: sheet }],
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{t("profile.signOutTitle")}</Text>
          <Text style={styles.subtitle}>{t("profile.signOutBody")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.signOut")}
            onPress={onConfirm}
            disabled={busy}
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.signOutLabel}>{t("profile.signOut")}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>{t("common.cancel")}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheet: {
      backgroundColor: "#F4F1EA",
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
      marginBottom: 22,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      lineHeight: 28,
      color: "#141414",
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: "#7A7A7A",
      textAlign: "center",
      marginBottom: 24,
    },
    signOutBtn: {
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: "#E11D48",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    signOutLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: "#FFFFFF",
    },
    cancelBtn: {
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#DDD8D0",
      alignItems: "center",
      justifyContent: "center",
    },
    cancelLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: "#141414",
    },
    pressed: {
      opacity: 0.86,
    },
    disabled: {
      opacity: 0.7,
    },
  });
}
