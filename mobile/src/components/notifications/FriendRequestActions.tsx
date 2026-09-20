import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import JosCityLoader from "../JosCityLoader";
import { useI18n } from "../../i18n/I18nProvider";
import {
  acceptIncoming,
  declineIncoming,
  ensureFriendGraph,
  getFriendGraphSnapshot,
  subscribeFriendGraph,
} from "../../state/friendGraph";
import { getAccountType, isDedicatedAgentAccount, getUser } from "../../storage/session";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  userId: number;
  name: string;
  requestId?: number;
  onResolved?: (accepted: boolean) => void;
};

export default function FriendRequestActions({
  userId,
  name,
  requestId,
  onResolved,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => subscribeFriendGraph(() => setTick((value) => value + 1)), []);
  useEffect(() => {
    void ensureFriendGraph();
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([getUser(), getAccountType()]).then(([user, type]) => {
      if (live) setAllowed(!isDedicatedAgentAccount(user, type));
    });
    return () => {
      live = false;
    };
  }, []);

  const status = getFriendGraphSnapshot().statusByUser[userId] || "none";
  if (!allowed) return null;
  if (resolved === "declined") return null;
  if (status === "friends" || resolved === "accepted") {
    return <Text style={styles.resolved}>{t("friends.friends")}</Text>;
  }
  if (status === "none" && busy === null && requestId == null) {
    return null;
  }

  const run = async (kind: "accept" | "decline") => {
    if (busy) return;
    setBusy(kind);
    const ok =
      kind === "accept"
        ? await acceptIncoming(userId, requestId)
        : await declineIncoming(userId, requestId);
    setBusy(null);
    if (!ok) {
      Alert.alert(kind === "accept" ? t("friends.acceptFailed") : t("friends.declineFailed"));
      return;
    }
    setResolved(kind === "accept" ? "accepted" : "declined");
    onResolved?.(kind === "accept");
  };

  return (
    <View
      style={styles.row}
      onStartShouldSetResponder={() => true}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          void run("decline");
        }}
        disabled={Boolean(busy)}
        style={styles.decline}
        accessibilityRole="button"
        accessibilityLabel={`${t("friends.decline")} ${name}`}
      >
        {busy === "decline" ? (
          <JosCityLoader size="small" color={colors.primary} />
        ) : (
          <Text style={styles.declineText}>{t("friends.decline")}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          void run("accept");
        }}
        disabled={Boolean(busy)}
        style={styles.accept}
        accessibilityRole="button"
        accessibilityLabel={`${t("friends.accept")} ${name}`}
      >
        {busy === "accept" ? (
          <JosCityLoader size="small" color={colors.white} />
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
      marginTop: 10,
      flexDirection: "row",
      gap: 8,
    },
    decline: {
      minHeight: 34,
      minWidth: 88,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.navActive,
      alignItems: "center",
      justifyContent: "center",
    },
    declineText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.primary,
    },
    accept: {
      minHeight: 34,
      minWidth: 92,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    acceptText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.white,
    },
    resolved: {
      marginTop: 10,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.primary,
    },
  });
}
