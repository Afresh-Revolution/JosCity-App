import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import AvatarCircle from "./AvatarCircle";
import { personName } from "./PeopleRow";
import { getApprovedUsers, searchUsers, type DirectoryUser } from "../../api/social";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { mentionHandle } from "../../utils/mentions";

export const MAX_COLLABORATORS = 5;

type Props = {
  visible: boolean;
  selected: DirectoryUser[];
  onClose: () => void;
  onChange: (people: DirectoryUser[]) => void;
  excludeUserIds?: number[];
};

export default function CollaboratorPickerSheet({
  visible,
  selected,
  onClose,
  onChange,
  excludeUserIds = [],
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      void (query.trim()
        ? searchUsers(query.trim())
        : getApprovedUsers({ limit: 30, accountType: "all" })
      ).then((rows) => {
        const blocked = new Set(excludeUserIds.map(Number));
        setResults(rows.filter((row) => !blocked.has(Number(row.user_id))));
      });
    }, 160);
    return () => clearTimeout(handle);
  }, [excludeUserIds, query, visible]);

  const selectedIds = useMemo(
    () => new Set(selected.map((person) => Number(person.user_id))),
    [selected]
  );

  const toggle = (person: DirectoryUser) => {
    const id = Number(person.user_id);
    if (selectedIds.has(id)) {
      onChange(selected.filter((row) => Number(row.user_id) !== id));
      return;
    }
    if (selected.length >= MAX_COLLABORATORS) return;
    onChange([...selected, person]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <View style={styles.top}>
          <Text style={styles.title}>{t("collab.inviteTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.done}>{t("common.done")}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {t("collab.inviteHint", { max: MAX_COLLABORATORS })}
        </Text>
        {selected.length ? (
          <View style={styles.chips}>
            {selected.map((person) => (
              <Pressable
                key={person.user_id}
                onPress={() => toggle(person)}
                style={styles.chip}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {personName(person)}
                </Text>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("collab.searchPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.user_id)}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const on = selectedIds.has(Number(item.user_id));
            const full = !on && selected.length >= MAX_COLLABORATORS;
            return (
              <Pressable
                onPress={() => toggle(item)}
                disabled={full}
                style={[styles.row, full && styles.rowDisabled]}
              >
                <AvatarCircle name={personName(item)} uri={item.user_picture} size={40} />
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {personName(item)}
                  </Text>
                  <Text style={styles.handle} numberOfLines={1}>
                    @{mentionHandle(item)}
                  </Text>
                </View>
                <Ionicons
                  name={on ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={on ? colors.primary : colors.textMuted}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("collab.noResults")}</Text>
          }
        />
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "78%",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 17,
      color: colors.text,
    },
    done: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.primary,
    },
    subtitle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 10,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "48%",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.sheet,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    chipText: {
      flexShrink: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.primary,
    },
    search: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      marginBottom: 8,
    },
    list: { minHeight: 220 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
    },
    rowDisabled: { opacity: 0.45 },
    copy: { flex: 1, minWidth: 0 },
    name: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    handle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    empty: {
      textAlign: "center",
      paddingVertical: 28,
      fontFamily: "Montserrat_400Regular",
      color: colors.textMuted,
    },
  });
}
