import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  visible: boolean;
  onSelect: (emoji: string) => void;
};

const CATEGORIES: { title: string; emojis: string[] }[] = [
  {
    title: "Smileys",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤗", "🤔",
      "😏", "😌", "😴", "🤒", "🥳", "😎", "🤩", "😢", "😭", "😤",
      "😡", "🤯", "😱", "🥺", "😅", "🙃", "😇", "🥰", "😋", "🤐",
    ],
  },
  {
    title: "Gestures",
    emojis: [
      "👍", "👎", "👏", "🙌", "🙏", "👌", "✌️", "🤞", "🤝", "💪",
      "👋", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯",
      "🔥", "✨", "⭐", "🎉", "🎊", "💥", "👀", "💬", "🫡", "🫶",
    ],
  },
  {
    title: "Objects",
    emojis: [
      "📱", "💻", "📷", "🎵", "🎶", "📍", "🏠", "🚗", "✈️", "🛒",
      "🎁", "💰", "📈", "📝", "✅", "❌", "⚠️", "📌", "🕐", "☕",
    ],
  },
];

/** Inline emoji tray — keeps the composer keyboard focused for multi-select. */
export default function ChatEmojiPicker({ visible, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!visible) return null;

  return (
    <View style={styles.sheet}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map((category) => (
          <View key={category.title} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <View style={styles.grid}>
              {category.emojis.map((emoji, index) => (
                <Pressable
                  key={`${category.title}-${index}-${emoji}`}
                  onPress={() => onSelect(emoji)}
                  style={styles.emojiBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Insert ${emoji}`}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    sheet: {
      height: 188,
      marginTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 10,
    },
    category: { gap: 4 },
    categoryTitle: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
      paddingHorizontal: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    emojiBtn: {
      width: "12.5%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: {
      fontSize: 26,
    },
  });
}
