import { useMemo, useRef } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { lookupUserByUsername } from "../../api/social";
import { useTheme } from "../../theme/ThemeProvider";
import { openMemberProfile } from "../../utils/openProfile";

type Props = {
  value: string;
  style?: StyleProp<TextStyle>;
  tagColor?: string;
};

const mentionCache = new Map<
  string,
  { user_id: number; account_type?: string; display_name?: string; user_picture?: string | null }
>();

export default function HashtagText({ value, style, tagColor }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const busy = useRef(false);
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

  const openMention = async (raw: string) => {
    const handle = raw.replace(/^@/, "").trim().toLowerCase();
    if (!handle || busy.current) return;
    busy.current = true;
    try {
      const cached = mentionCache.get(handle);
      const hit = cached || (await lookupUserByUsername(handle));
      if (hit?.user_id) {
        mentionCache.set(handle, hit);
        openMemberProfile(router, hit.user_id, hit.account_type, "push", {
          name: hit.display_name,
          picture: hit.user_picture,
        });
      }
    } finally {
      busy.current = false;
    }
  };

  return (
    <Text selectable style={[styles.body, style]}>
      {parts.map((part, index) =>
        part.startsWith("#") || part.startsWith("@") ? (
          <Text
            selectable
            key={`${part}-${index}`}
            style={[styles.tag, tagColor ? { color: tagColor } : null]}
            onPress={
              part.startsWith("#")
                ? () =>
                    router.push({
                      pathname: "/hashtag/[tag]",
                      params: { tag: part.replace(/^#+/, "") },
                    })
                : () => void openMention(part)
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
