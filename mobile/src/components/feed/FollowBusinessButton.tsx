import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { toggleBusinessFollow } from "../../api/marketplace";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  userId: number;
  name: string;
  following?: boolean;
  compact?: boolean;
  onChange?: (following: boolean) => void;
};

export default function FollowBusinessButton({
  userId,
  name,
  following = false,
  compact = false,
  onChange,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isFollowing, setIsFollowing] = useState(following);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIsFollowing(following);
  }, [following, userId]);

  const run = async () => {
    if (busy || !userId) return;
    setBusy(true);
    const next = await toggleBusinessFollow(userId);
    setBusy(false);
    if (next == null) {
      Alert.alert(t("business.followFailed"));
      return;
    }
    setIsFollowing(next);
    onChange?.(next);
  };

  const onPress = () => {
    if (busy) return;
    if (isFollowing) {
      Alert.alert(t("business.unfollowTitle"), t("business.unfollowBody", { name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("business.unfollow"),
          style: "destructive",
          onPress: () => void run(),
        },
      ]);
      return;
    }
    void run();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.btn, compact && styles.btnCompact, isFollowing && styles.btnOn]}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? t("business.following") : t("business.follow")}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isFollowing ? colors.primary : colors.white} />
      ) : (
        <>
          <Ionicons
            name={isFollowing ? "checkmark" : "person-add"}
            size={14}
            color={isFollowing ? colors.primary : colors.white}
          />
          <Text style={[styles.label, isFollowing && styles.labelOn]}>
            {isFollowing ? t("business.following") : t("business.follow")}
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
    btnOn: {
      backgroundColor: colors.navActive,
    },
    label: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.white,
    },
    labelOn: {
      color: colors.primary,
    },
  });
}
