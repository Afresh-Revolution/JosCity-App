import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import JosCityLoader from "./JosCityLoader";
import { ErrorBanner } from "./AppNotice";
import { clearFriendNickname, setFriendNickname } from "../api/social";
import { useI18n } from "../i18n/I18nProvider";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: number;
  realName: string;
  nickname: string | null;
  onSaved: (next: { nickname: string | null; name: string }) => void;
};

export default function FriendNicknameSheet({
  visible,
  onClose,
  userId,
  realName,
  nickname,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(nickname || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(nickname || "");
      setError(null);
      setBusy(false);
    }
  }, [visible, nickname]);

  const save = async () => {
    const next = value.replace(/\s+/g, " ").trim();
    if (!next) {
      setError(t("friends.nicknameRequired"));
      return;
    }
    if (next.length > 60) {
      setError(t("friends.nicknameTooLong"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await setFriendNickname(userId, next);
    setBusy(false);
    if (!result.success) {
      setError(result.message || t("friends.nicknameSaveFailed"));
      return;
    }
    onSaved({ nickname: result.nickname || next, name: result.nickname || next });
    onClose();
  };

  const clear = async () => {
    setBusy(true);
    setError(null);
    const result = await clearFriendNickname(userId);
    setBusy(false);
    if (!result.success) {
      setError(result.message || t("friends.nicknameClearFailed"));
      return;
    }
    onSaved({ nickname: null, name: realName });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <Text style={styles.title}>{t("friends.nicknameTitle")}</Text>
          <Text style={styles.hint}>
            {t("friends.nicknameHint", { name: realName || t("friends.friends") })}
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={t("friends.nicknamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            maxLength={60}
            autoFocus
            style={styles.input}
            accessibilityLabel={t("friends.nicknameTitle")}
          />
          <Text style={styles.realName}>
            {t("friends.nicknameReal", { name: realName || "—" })}
          </Text>
          <Pressable
            onPress={() => void save()}
            disabled={busy}
            style={[styles.primary, busy && styles.disabled]}
            accessibilityRole="button"
          >
            {busy ? (
              <JosCityLoader color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryText}>{t("friends.nicknameSave")}</Text>
            )}
          </Pressable>
          {nickname ? (
            <Pressable
              onPress={() => void clear()}
              disabled={busy}
              style={[styles.secondary, busy && styles.disabled]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{t("friends.nicknameRemove")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} disabled={busy} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card || colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 18,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
      backgroundColor: colors.background,
    },
    realName: {
      color: colors.textMuted,
      fontSize: 12,
    },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryText: {
      color: colors.white,
      fontWeight: "700",
      fontSize: 15,
    },
    secondary: {
      borderRadius: 12,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryText: {
      color: colors.error || colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    cancel: {
      alignItems: "center",
      paddingVertical: 8,
    },
    cancelText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    disabled: {
      opacity: 0.6,
    },
  });
}
