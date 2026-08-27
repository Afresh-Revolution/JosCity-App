import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { type DirectoryUser } from "../../api/social";
import BusinessVerifiedBadge from "../BusinessVerifiedBadge";
import { personName } from "../feed/PeopleRow";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { firstMediaUrl, initials } from "../../utils/format";

export default function BusinessRow({ shop }: { shop: DirectoryUser }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const name = personName(shop);
  const image = firstMediaUrl(shop.user_picture);
  const place = shop.address || shop.business_location || "";

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/business/[id]",
          params: {
            id: String(shop.user_id),
            name,
            source: "discover",
            ...(image ? { picture: image } : {}),
          },
        })
      }
      style={styles.row}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.fallback]}>
          <Text style={styles.initials}>{initials(name)}</Text>
        </View>
      )}
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <BusinessVerifiedBadge
            color={shop.badge_color}
            hasCac={Boolean(shop.cac_verified)}
            verified={Boolean(shop.user_verified || shop.is_verified)}
            accountType={shop.account_type || "business"}
            size={16}
          />
        </View>
        <Text style={styles.type} numberOfLines={1}>
          {shop.business_type || "Business"}
        </Text>
        {place ? (
          <Text style={styles.meta} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.sheet,
    },
    fallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.iconSoft,
    },
    initials: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.primary,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      flexShrink: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    type: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.text,
    },
    meta: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
