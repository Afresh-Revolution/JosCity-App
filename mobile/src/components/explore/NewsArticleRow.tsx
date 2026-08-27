import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NewsItem } from "../../api/explore";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { firstMediaUrl, timeAgo } from "../../utils/format";
import { newsMetaLabel } from "../../utils/news";
import { useMemo } from "react";

type Props = {
  item: NewsItem;
  bordered?: boolean;
  onPress?: () => void;
};

export default function NewsArticleRow({ item, bordered = true, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const image = firstMediaUrl(item.image_urls);
  const meta = newsMetaLabel(timeAgo(item.created_at));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        bordered && styles.bordered,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={3}>
          {item.title || "JOSCITY News"}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      {image ? (
        <Image source={{ uri: image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.fallback]} />
      )}
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      gap: 14,
    },
    bordered: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pressed: { opacity: 0.82 },
    copy: {
      flex: 1,
      paddingRight: 4,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
    },
    meta: {
      marginTop: 8,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    thumb: {
      width: 86,
      height: 78,
      borderRadius: 12,
      backgroundColor: colors.cream,
    },
    fallback: {
      backgroundColor: colors.border,
    },
  });
}
