import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AvatarCircle from "./AvatarCircle";
import type { FeedCollaborator } from "../../api/feed";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { openMemberProfile } from "../../utils/openProfile";
import { publicUsername } from "../../utils/accountNames";

type Props = {
  visible: boolean;
  authorName: string;
  authorId?: number;
  authorAccountType?: string | null;
  authorPicture?: string | null;
  collaborators: FeedCollaborator[];
  onClose: () => void;
};

export default function CollaboratorsSheet({
  visible,
  authorName,
  authorId,
  authorAccountType,
  authorPicture,
  collaborators,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const people = [
    {
      id: Number(authorId || 0),
      name: authorName,
      picture: authorPicture || null,
      account_type: authorAccountType || "personal",
      username: null as string | null,
      isAuthor: true,
    },
    ...collaborators.map((c) => ({
      id: Number(c.id || c.user_id || 0),
      name: c.name || "JosCity member",
      picture: c.picture || null,
      account_type: c.account_type || "personal",
      username: publicUsername(c.username),
      isAuthor: false,
    })),
  ].filter((p) => p.id > 0);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{t("collab.peopleTitle")}</Text>
          {people.map((person) => (
            <Pressable
              key={person.id}
              style={styles.row}
              onPress={() => {
                onClose();
                openMemberProfile(router, person.id, person.account_type, "push", {
                  name: person.name,
                  picture: person.picture,
                });
              }}
            >
              <AvatarCircle name={person.name} uri={person.picture} size={42} />
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {person.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {person.isAuthor
                    ? t("collab.authorLabel")
                    : person.username
                      ? `@${person.username}`
                      : t("collab.collaboratorLabel")}
                </Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 16,
      maxHeight: "70%",
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
    },
    copy: { flex: 1, minWidth: 0 },
    name: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    meta: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
}
