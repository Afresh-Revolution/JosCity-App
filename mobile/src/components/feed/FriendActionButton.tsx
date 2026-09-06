import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import JosCityLoader from "../JosCityLoader";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useI18n } from "../../i18n/I18nProvider";
import {
  acceptIncoming,
  addFriend,
  cancelOutgoing,
  declineIncoming,
  ensureFriendGraph,
  getFriendGraphSnapshot,
  removeFriend,
  subscribeFriendGraph,
} from "../../state/friendGraph";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import type { FriendStatus } from "../../api/social";
import { playFriendRequestSound } from "../../utils/uiSounds";

type Props = {
  userId: number;
  name: string;
  compact?: boolean;
  layout?: "chip" | "bar";
};

export default function FriendActionButton({
  userId,
  name,
  compact = false,
  layout = "chip",
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeFriendGraph(() => setTick((value) => value + 1)), []);
  useEffect(() => {
    void ensureFriendGraph();
  }, []);

  const graph = getFriendGraphSnapshot();
  const status: FriendStatus = graph.statusByUser[userId] || "none";

  const label =
    status === "friends"
      ? t("friends.friends")
      : status === "sent"
        ? t("friends.cancel")
        : status === "pending"
          ? t("friends.respond")
          : layout === "bar"
            ? t("friends.addFriend")
            : t("friends.add");
  const icon: keyof typeof Ionicons.glyphMap =
    status === "friends"
      ? "people"
      : status === "sent"
        ? "close"
        : status === "pending"
          ? "time-outline"
          : "person-add";

  const run = async (action: () => Promise<boolean>, failKey: string) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (!ok) Alert.alert(t(failKey));
  };

  const onPress = () => {
    if (busy) return;
    if (status === "none") {
      void (async () => {
        setBusy(true);
        const ok = await addFriend(userId);
        setBusy(false);
        if (ok) playFriendRequestSound();
        else Alert.alert(t("friends.addFailed"));
      })();
      return;
    }
    if (status === "sent") {
      void run(() => cancelOutgoing(userId), "friends.cancelFailed");
      return;
    }
    if (status === "friends") {
      Alert.alert(t("friends.unfriendTitle"), t("friends.unfriendBody", { name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("friends.unfriend"),
          style: "destructive",
          onPress: () => void run(() => removeFriend(userId), "friends.unfriendFailed"),
        },
      ]);
      return;
    }
    Alert.alert(t("friends.respondTitle"), t("friends.respondBody", { name }), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("friends.decline"),
        style: "destructive",
        onPress: () => void run(() => declineIncoming(userId), "friends.declineFailed"),
      },
      {
        text: t("friends.accept"),
        onPress: () => void run(() => acceptIncoming(userId), "friends.acceptFailed"),
      },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        layout === "bar" && styles.btnBar,
        status === "friends" && styles.btnFriends,
        status === "sent" && styles.btnCancel,
        status === "pending" && styles.btnPending,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <JosCityLoader
          size="small"
          color={status === "none" ? colors.white : colors.primary}
        />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={layout === "bar" ? 16 : 14}
            color={status === "none" ? colors.white : colors.primary}
          />
          <Text
            style={[
              styles.label,
              layout === "bar" && styles.labelBar,
              status !== "none" && styles.labelAlt,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: 12,
      minWidth: 92,
      minHeight: 32,
    },
    btnCompact: {
      minWidth: 86,
    },
    btnBar: {
      flex: 1,
      minHeight: 44,
      minWidth: 0,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    labelBar: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
    },
    btnFriends: {
      backgroundColor: colors.navActive,
    },
    btnCancel: {
      backgroundColor: colors.navActive,
    },
    btnPending: {
      backgroundColor: colors.greetingBg,
    },
    label: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.white,
    },
    labelAlt: {
      color: colors.primary,
    },
  });
}
