import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AvatarCircle from "./AvatarCircle";
import { useI18n } from "../../i18n/I18nProvider";
import {
  getAccountType,
  getUser,
  isBusinessAccountType,
  isDedicatedAgentAccount,
  pickUserPicture,
  type StoredUser,
} from "../../storage/session";

type Props = {
  size?: number;
};

function displayName(user: StoredUser | null): string {
  if (!user) return "You";
  return (
    String(user.display_name || "").trim() ||
    [user.user_firstname || user.first_name, user.user_lastname || user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    String(user.business_name || user.user_name || user.username || "").trim() ||
    "You"
  );
}

/** Top-left profile entry (photo or initials) for personal chrome. */
export default function HeaderProfileButton({ size = 32 }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [accountKind, setAccountKind] = useState<"personal" | "business" | "agent">("personal");
  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          borderRadius: size / 2,
        },
      }),
    [size]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([getUser(), getAccountType()]).then(([nextUser, type]) => {
        if (!active) return;
        setUser(nextUser);
        if (isDedicatedAgentAccount(nextUser, type)) setAccountKind("agent");
        else if (isBusinessAccountType(type)) setAccountKind("business");
        else setAccountKind("personal");
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const openProfile = () => {
    if (accountKind === "agent") {
      router.push("/agents/profile" as never);
      return;
    }
    if (accountKind === "business") {
      router.push("/business/profile" as never);
      return;
    }
    router.push("/profile");
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("nav.profile")}
      hitSlop={6}
      onPress={openProfile}
      style={styles.btn}
    >
      <AvatarCircle name={displayName(user)} uri={pickUserPicture(user)} size={size} />
    </Pressable>
  );
}
