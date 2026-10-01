import { publicUsername } from "../../utils/accountNames";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AvatarCircle from "./AvatarCircle";
import { useI18n } from "../../i18n/I18nProvider";
import {
  getActiveSession,
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
    String(user.business_name || publicUsername(user.user_name) || publicUsername(user.username) || "").trim() ||
    "You"
  );
}

/** Top-left entry for the currently selected account profile. */
export default function HeaderProfileButton({ size = 32 }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const opening = useRef(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          borderRadius: size / 2,
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [size]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getActiveSession().then((session) => {
        if (active) setUser(session?.user || null);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const openProfile = async () => {
    if (opening.current) return;
    opening.current = true;
    try {
      // Resolve on tap: this header can survive an account switch in the stack.
      const session = await getActiveSession();
      if (!session) {
        router.push("/login");
        return;
      }
      if (isBusinessAccountType(session.accountType)) {
        router.push("/business/profile");
      } else if (isDedicatedAgentAccount(session.user, session.accountType)) {
        router.push("/agents/profile");
      } else {
        router.push("/profile");
      }
    } finally {
      opening.current = false;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("nav.profile")}
      hitSlop={6}
      onPress={() => void openProfile()}
      style={styles.btn}
    >
      <AvatarCircle name={displayName(user)} uri={pickUserPicture(user)} size={size} />
    </Pressable>
  );
}
