import { Pressable, StyleSheet, Text, View } from "react-native";
import AvatarCircle from "../feed/AvatarCircle";
import { forumReplyLabel, type ForumThread } from "../../api/forum";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { timeAgo } from "../../utils/format";
import { useMemo } from "react";

export default function ForumThreadRow({
  thread,
  showCategory = false,
  onPress,
}: {
  thread: ForumThread;
  showCategory?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ago = timeAgo(thread.last_reply_at || thread.created_at);
  const meta = [
    showCategory ? thread.category_name : null,
    forumReplyLabel(thread.reply_count),
    ago,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <AvatarCircle name={thread.author?.name} uri={thread.author?.picture} size={36} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {thread.title}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pressed: { opacity: 0.72 },
    copy: { flex: 1 },
    title: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
    },
    meta: {
      marginTop: 5,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
  });
}
