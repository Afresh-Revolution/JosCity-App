import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AvatarCircle from "./AvatarCircle";
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
            <Text style={styles.name} numberOfLines={1}>
              {personName(person)}
            </Text>
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
      backgroundColor: colors.surface,
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
    name: {
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
