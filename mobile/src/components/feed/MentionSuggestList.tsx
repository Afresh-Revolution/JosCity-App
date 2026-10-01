import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AvatarCircle from "./AvatarCircle";
import BusinessVerifiedBadge from "../BusinessVerifiedBadge";
import { personName } from "./PeopleRow";
import type { DirectoryUser } from "../../api/social";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { mentionHandle } from "../../utils/mentions";

type Props = {
  people: DirectoryUser[];
  onSelect: (person: DirectoryUser) => void;
  max?: number;
};

export default function MentionSuggestList({ people, onSelect, max = 6 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!people.length) return null;

  return (
    <View style={styles.box}>
      {people.slice(0, max).map((person) => (
        <Pressable
          key={person.user_id}
          onPress={() => onSelect(person)}
          style={styles.row}
        >
          <AvatarCircle name={personName(person)} uri={person.user_picture} size={32} />
          <View style={styles.copy}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {personName(person)}
              </Text>
              <BusinessVerifiedBadge
                color={person.badge_color}
                hasCac={Boolean(person.has_cac || person.cac_verified)}
                verified={Boolean(person.user_verified || person.is_verified)}
                accountType={person.account_type}
                signupIntent={person.signup_intent}
                agentType={person.agent_type}
                ninVerified={person.nin_verified}
                ninNumber={person.nin_number}
                roleBadge
                size={14}
              />
            </View>
            <Text style={styles.handle} numberOfLines={1}>
              @{mentionHandle(person)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    box: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    copy: { flex: 1, minWidth: 0 },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    name: {
      flexShrink: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    handle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
  });
}
