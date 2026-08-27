import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  eventLocation,
  eventTitle,
  isGatewavEvent,
  isPaidJosCityEvent,
  type ExploreEvent,
} from "../../api/explore";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { firstMediaUrl, formatEventWhen } from "../../utils/format";

type Props = {
  event: ExploreEvent;
  compact?: boolean;
  onPress?: () => void;
};

export default function EventCard({ event, compact = false, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const image = firstMediaUrl(event.image || event.event_cover);
  const when = formatEventWhen(event.date || event.event_date);
  const price = Number(event.event_price_naira || 0);
  const badge = isGatewavEvent(event)
    ? "Gatewav"
    : isPaidJosCityEvent(event)
      ? `₦${price.toLocaleString("en-NG")}`
      : event.organizer_type === "admin"
        ? "JOSCITY"
        : "Business";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [pressed && onPress ? styles.pressed : null]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={eventTitle(event)}
    >
      {image ? (
        <Image source={{ uri: image }} style={[styles.image, compact && styles.imageCompact]} />
      ) : (
        <View style={[styles.image, compact && styles.imageCompact, styles.fallback]} />
      )}
      {when ? <Text style={styles.when}>{when}</Text> : null}
      <Text style={styles.title}>{eventTitle(event)}</Text>
      <Text style={styles.meta}>{eventLocation(event)}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    pressed: { opacity: 0.82 },
    image: {
      width: "100%",
      height: 168,
      borderRadius: 16,
      backgroundColor: colors.cream,
      marginTop: 10,
    },
    imageCompact: {
      height: 140,
      marginTop: 0,
    },
    fallback: {
      backgroundColor: colors.border,
    },
    when: {
      marginTop: 10,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    title: {
      marginTop: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    meta: {
      marginTop: 4,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    badge: {
      alignSelf: "flex-start",
      marginTop: 8,
      borderRadius: 999,
      backgroundColor: colors.navActive,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.primary,
    },
  });
}
