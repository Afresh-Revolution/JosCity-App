import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { ForumCategory } from "../../api/forum";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { useMemo } from "react";

const ICONS: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  "home-outline": "home-outline",
  "bus-outline": "bus-outline",
  "briefcase-outline": "briefcase-outline",
  "laptop-outline": "laptop-outline",
  "chatbubbles-outline": "chatbubbles-outline",
};

export default function ForumCategoryRow({
  category,
  onPress,
}: {
  category: ForumCategory;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const icon = ICONS[String(category.icon || "")] || "chatbubbles-outline";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{category.name}</Text>
        {category.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {category.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.count}>{Number(category.thread_count || 0)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pressed: { opacity: 0.72 },
    iconWrap: {
      width: 36,
      alignItems: "center",
    },
    copy: { flex: 1 },
    name: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    description: {
      marginTop: 3,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    count: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
      minWidth: 18,
      textAlign: "right",
    },
  });
}
