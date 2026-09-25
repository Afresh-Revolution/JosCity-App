import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AvatarCircle from "./AvatarCircle";
import BusinessVerifiedBadge from "../BusinessVerifiedBadge";
import FollowBusinessButton from "./FollowBusinessButton";
import FriendActionButton from "./FriendActionButton";
import { type DirectoryUser } from "../../api/social";
import { getMutualFriendCount } from "../../state/friendGraph";
import { useI18n } from "../../i18n/I18nProvider";
import {
  friendshipAllowed,
  getAccountType,
  getUser,
  isDedicatedAgentAccount,
} from "../../storage/session";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { openMemberProfile } from "../../utils/openProfile";

type Props = {
  people: DirectoryUser[];
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
};

export function personName(person: DirectoryUser): string {
  const isBiz = String(person.account_type || "").toLowerCase() === "business";
  if (isBiz && person.business_name?.trim()) return person.business_name.trim();
  return (
    person.display_name?.trim() ||
    [person.user_firstname, person.user_lastname].filter(Boolean).join(" ").trim() ||
    "JosCity member"
  );
}

function MutualFriendsLabel({
  userId,
  knownCount,
}: {
  userId: number;
  knownCount?: number;
}) {
  const { t } = useI18n();
  const [count, setCount] = useState<number | null>(
    typeof knownCount === "number" ? Math.max(0, knownCount) : null
  );

  useEffect(() => {
    if (typeof knownCount === "number") {
      setCount(Math.max(0, knownCount));
      return;
    }
    let live = true;
    void getMutualFriendCount(userId).then((next) => {
      if (live) setCount(next);
    });
    return () => {
      live = false;
    };
  }, [userId, knownCount]);

  if (count == null) return null;
  if (count === 1) return <>{t("friends.mutualOne")}</>;
  if (count > 1) return <>{t("friends.mutualMany", { count })}</>;
  return <>{t("friends.mutualNone")}</>;
}

export default function PeopleRow({
  people,
  title,
  subtitle,
  seeAllLabel,
  onSeeAll,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makePeopleStyles(colors), [colors]);
  const heading = title || t("home.peopleTitle");
  const sub = subtitle || t("home.peopleSubtitle");
  const seeAll = seeAllLabel || t("common.seeAll");
  if (!people.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.subtitle}>{sub}</Text>
        </View>
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={seeAll}
        >
          <Text style={styles.seeAll}>{seeAll}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroller}
      >
        {people.map((person) => (
          <PersonCard key={person.user_id} person={person} />
        ))}
      </ScrollView>
    </View>
  );
}

function useCanFriend(person: DirectoryUser) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([getUser(), getAccountType()]).then(([user, type]) => {
      if (!live) return;
      setAllowed(friendshipAllowed(user, type, person, person.account_type));
    });
    return () => {
      live = false;
    };
  }, [person]);
  if (isDedicatedAgentAccount(person, person.account_type)) return false;
  return allowed;
}

export function PersonCard({ person }: { person: DirectoryUser }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makePeopleStyles(colors), [colors]);
  const router = useRouter();
  const name = personName(person);
  const isBiz = String(person.account_type || "").toLowerCase() === "business";
  const canFriend = useCanFriend(person);

  return (
    <Pressable
      onPress={() =>
        openMemberProfile(router, person.user_id, person.account_type, "push", {
          name,
          picture: person.user_picture,
        })
      }
      style={styles.card}
    >
      <AvatarCircle name={name} uri={person.user_picture} size={64} />
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <BusinessVerifiedBadge
          color={person.badge_color}
          hasCac={Boolean(person.cac_verified)}
          verified={Boolean(person.user_verified || person.is_verified)}
          accountType={person.account_type}
          size={14}
        />
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {isBiz
          ? person.business_type || t("nav.business")
          : isDedicatedAgentAccount(person, person.account_type)
            ? t("member.agentKicker")
            : <MutualFriendsLabel userId={person.user_id} knownCount={person.mutual_count} />}
      </Text>
      {isBiz ? (
        <FollowBusinessButton userId={person.user_id} name={name} compact />
      ) : canFriend ? (
        <FriendActionButton
          userId={person.user_id}
          name={name}
          compact
          accountType={person.account_type}
          agentType={person.agent_type}
          signupIntent={person.signup_intent}
        />
      ) : null}
    </Pressable>
  );
}

export function PersonListRow({ person }: { person: DirectoryUser }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makePeopleStyles(colors), [colors]);
  const router = useRouter();
  const name = personName(person);
  const isBiz = String(person.account_type || "").toLowerCase() === "business";
  const canFriend = useCanFriend(person);

  return (
    <Pressable
      onPress={() =>
        openMemberProfile(router, person.user_id, person.account_type, "push", {
          name,
          picture: person.user_picture,
        })
      }
      style={styles.listRow}
    >
      <AvatarCircle name={name} uri={person.user_picture} size={52} />
      <View style={styles.listCopy}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>
            {name}
          </Text>
          <BusinessVerifiedBadge
            color={person.badge_color}
            hasCac={Boolean(person.cac_verified)}
            verified={Boolean(person.user_verified || person.is_verified)}
            accountType={person.account_type}
            size={16}
          />
        </View>
        <Text style={styles.listMeta} numberOfLines={1}>
          {isBiz
            ? person.business_type || t("nav.business")
            : isDedicatedAgentAccount(person, person.account_type)
              ? t("member.agentKicker")
              : <MutualFriendsLabel userId={person.user_id} knownCount={person.mutual_count} />}
        </Text>
      </View>
      {isBiz ? (
        <FollowBusinessButton userId={person.user_id} name={name} />
      ) : canFriend ? (
        <FriendActionButton
          userId={person.user_id}
          name={name}
          accountType={person.account_type}
          agentType={person.agent_type}
          signupIntent={person.signup_intent}
        />
      ) : null}
    </Pressable>
  );
}

function makePeopleStyles(colors: Palette) {
  return StyleSheet.create({
  section: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  heading: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  headingCopy: {
    flex: 1,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  seeAll: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  scroller: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: 132,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  name: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
    flexShrink: 1,
  },
  nameRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
  },
  meta: {
    marginTop: 2,
    marginBottom: 10,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    width: "100%",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listCopy: {
    flex: 1,
  },
  listName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
    flexShrink: 1,
  },
  listNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listMeta: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  });
}
