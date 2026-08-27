import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export default function SoonBadge({ label = "Coming soon" }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        soonBadge: {
          borderRadius: 999,
          backgroundColor: colors.navActive,
          paddingHorizontal: 10,
          paddingVertical: 6,
          maxWidth: 140,
        },
        soonText: {
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 11,
          color: colors.primary,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.soonBadge}>
      <Text style={styles.soonText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
