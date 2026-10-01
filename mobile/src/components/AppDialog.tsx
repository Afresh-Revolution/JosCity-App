import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type AlertButton, type AlertOptions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../theme/ThemeProvider";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";

type Dialog = { title: string; message?: string; buttons?: AlertButton[]; options?: AlertOptions };
const queue: Dialog[] = [];
let listener: (() => void) | null = null;

/** App-owned dialogs; OS permission prompts remain managed by the operating system. */
export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    queue.push({ title, message, buttons, options });
    listener?.();
  },
};

export function AppDialogHost() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [visible, setVisible] = useState(false);
  const active = useRef(false);
  const closing = useRef(false);
  const completion = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const showNext = () => {
      if (active.current || !queue.length) return;
      active.current = true;
      closing.current = false;
      setDialog(queue.shift()!);
      setVisible(true);
    };
    listener = showNext;
    showNext();
    return () => { if (listener === showNext) listener = null; };
  }, []);

  const finish = () => {
    if (!closing.current) return;
    closing.current = false;
    active.current = false;
    setDialog(null);
    const callback = completion.current;
    completion.current = undefined;
    try { callback?.(); } finally { listener?.(); }
  };
  useEffect(() => {
    // iOS runs actions after the native presentation has dismissed.
    if (!visible && Platform.OS !== "ios") finish();
  }, [visible]);

  const close = (callback?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    completion.current = callback;
    setVisible(false);
  };
  const buttons = dialog?.buttons?.length ? dialog.buttons : [{ text: t("common.ok") }];
  const destructive = buttons.some((button) => button.style === "destructive");
  const dismiss = () => {
    if (!dialog?.options?.cancelable) return;
    close(dialog.options.onDismiss);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} onDismiss={finish} statusBarTranslucent>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessible={false} />
        <View style={styles.card}>
          <View style={[styles.icon, { backgroundColor: destructive ? colors.error + "18" : colors.iconSoft }]}>
            <Ionicons name={destructive ? "alert-circle-outline" : "information-circle-outline"} size={30} color={destructive ? colors.error : colors.primary} />
          </View>
          <ScrollView style={styles.copy} contentContainerStyle={styles.copyContent}>
            <Text style={styles.title} accessibilityRole="header">{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            {buttons.map((button, index) => (
              <Pressable key={index} accessibilityRole="button" onPress={() => close(button.onPress)}
                style={({ pressed }) => [styles.button, button.style === "cancel" ? styles.cancel : button.style === "destructive" ? styles.destructive : styles.primary, pressed && styles.pressed]}>
                <Text style={[styles.buttonText, { color: button.style === "cancel" ? colors.text : button.style === "destructive" ? colors.white : colors.background }]}>{button.text || t("common.ok")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 },
    card: { width: "100%", maxWidth: 420, maxHeight: "100%", backgroundColor: colors.card, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 22 },
    icon: { width: 54, height: 54, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 16 },
    copy: { flexShrink: 1 },
    copyContent: { gap: 10 },
    title: { fontFamily: "Montserrat_700Bold", fontSize: 21, color: colors.text },
    message: { fontFamily: "Montserrat_400Regular", fontSize: 15, lineHeight: 23, color: colors.textMuted },
    actions: { marginTop: 24, gap: 10 },
    button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
    primary: { backgroundColor: colors.primary },
    destructive: { backgroundColor: colors.error },
    cancel: { backgroundColor: colors.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    buttonText: { fontFamily: "Montserrat_600SemiBold", fontSize: 15, textAlign: "center" },
    pressed: { opacity: 0.75 },
  });
}
