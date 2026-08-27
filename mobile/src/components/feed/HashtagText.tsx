import { useMemo } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";

type Props = {
  value: string;
  style?: StyleProp<TextStyle>;
  tagColor?: string;
};

export default function HashtagText({ value, style, tagColor }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          fontFamily: "Montserrat_400Regular",
          fontSize: 15,
          lineHeight: 22,
          color: colors.text,
        },
        tag: {
          fontFamily: "Montserrat_600SemiBold",
          color: colors.primary,
        },
      }),
    [colors]
  );
  const parts = value.split(/([#@][A-Za-z0-9_]+)/g);

  return (
    <Text style={[styles.body, style]}>
      {parts.map((part, index) =>
        part.startsWith("#") || part.startsWith("@") ? (
          <Text
            key={`${part}-${index}`}
            style={[styles.tag, tagColor ? { color: tagColor } : null]}
            onPress={
              part.startsWith("#")
                ? () =>
                    router.push({
                      pathname: "/hashtag/[tag]",
                      params: { tag: part.replace(/^#+/, "") },
                    })
                : undefined
            }
          >
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}
