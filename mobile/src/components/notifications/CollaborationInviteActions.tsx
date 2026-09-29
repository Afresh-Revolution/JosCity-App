import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import JosCityLoader from "../JosCityLoader";
import {
  acceptCollaboration,
  declineCollaboration,
} from "../../api/feed";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  postId: number;
  onResolved?: (accepted: boolean) => void;
};

export default function CollaborationInviteActions({ postId, onResolved }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);

  if (!postId) return null;
  if (resolved === "declined") return null;
  if (resolved === "accepted") {
    return <Text style={styles.done}>{t("collab.accepted")}</Text>;
  }

  const run = async (kind: "accept" | "decline") => {
    if (busy) return;
    setBusy(kind);
    const ok =
      kind === "accept"
        ? await acceptCollaboration(postId)
        : await declineCollaboration(postId);
    setBusy(null);
    if (!ok) {
      Alert.alert(
        kind === "accept" ? t("collab.acceptFailed") : t("collab.declineFailed")
      );
      return;
    }
    setResolved(kind === "accept" ? "accepted" : "declined");
    onResolved?.(kind === "accept");
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void run("decline")}
        disabled={Boolean(busy)}
        style={styles.decline}
        accessibilityRole="button"
        accessibilityLabel={t("friends.decline")}
      >
        {busy === "decline" ? (
          <JosCityLoader color={colors.textMuted} size="small" />
        ) : (
          <Text style={styles.declineText}>{t("friends.decline")}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => void run("accept")}
        disabled={Boolean(busy)}
        style={styles.accept}
        accessibilityRole="button"
        accessibilityLabel={t("friends.accept")}
      >
        {busy === "accept" ? (
          <JosCityLoader color={colors.white} size="small" />
        ) : (
          <Text style={styles.acceptText}>{t("friends.accept")}</Text>
        )}
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    decline: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
    },
    declineText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    accept: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      borderRadius: 10,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
    },
    acceptText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.white,
    },
    done: {
      marginTop: 8,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.primary,
    },
  });
}
