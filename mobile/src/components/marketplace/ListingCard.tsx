import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { MarketplaceListing } from "../../api/marketplace";
import type { Palette } from "../../theme/colors";
import { absoluteUrl } from "../../utils/format";
import ListingPrice from "./ListingPrice";
import ListingThumb from "./ListingThumb";

type Props = {
  item: MarketplaceListing;
  colors: Palette;
  compact?: boolean;
  soldOut?: boolean;
  busy?: boolean;
  actionLabel?: string;
  onPress: () => void;
  onAction?: () => void;
};

export default function ListingCard({
  item,
  colors,
  compact = false,
  soldOut = false,
  busy = false,
  actionLabel = "",
  onPress,
  onAction,
}: Props) {
  const styles = makeStyles(colors, compact);
  const service = item.listing_kind === "service";
  const image = absoluteUrl(item.image_url);
  const shop = item.seller_name || item.contact?.name || item.category || "Jos";
  const kindIcon = service ? "briefcase-outline" : "cube-outline";
  const kindLabel = service ? "Service" : "Product";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.media}>
        <ListingThumb
          uri={image}
          backgroundColor={colors.sheet}
          style={styles.thumb}
          fallback={
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <Ionicons name={kindIcon} size={compact ? 22 : 26} color={colors.primary} />
              </View>
              <Text style={styles.placeholderLabel}>{kindLabel}</Text>
            </View>
          }
        />
        <View style={styles.kindBadge}>
          <Ionicons name={kindIcon} size={11} color={colors.primary} />
          <Text style={styles.kindBadgeText}>{kindLabel}</Text>
        </View>
        {soldOut ? (
          <View style={styles.soldBadge}>
            <Text style={styles.soldBadgeText}>Sold out</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <ListingPrice
          price={item.price}
          salePrice={item.sale_price}
          discountPercent={item.discount_percent}
          offerText={item.offer_text}
          colors={colors}
          size="sm"
        />
        <View style={styles.shopRow}>
          <Ionicons name="storefront-outline" size={12} color={colors.textMuted} />
          <Text style={styles.shop} numberOfLines={1}>
            {shop}
          </Text>
        </View>
        {onAction ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              if (!soldOut && !busy) onAction();
            }}
            style={({ pressed }) => [
              styles.action,
              soldOut && styles.actionDisabled,
              pressed && !soldOut && styles.actionPressed,
            ]}
            disabled={soldOut || busy}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Ionicons
              name={service ? "calendar-outline" : soldOut ? "close-circle-outline" : "cart-outline"}
              size={15}
              color={soldOut ? colors.textMuted : colors.white}
            />
            <Text style={[styles.actionText, soldOut && styles.actionTextDisabled]}>
              {busy ? "…" : actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette, compact: boolean) {
  return StyleSheet.create({
    card: {
      width: compact ? 176 : "100%",
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardPressed: {
      opacity: 0.92,
    },
    media: {
      position: "relative",
      width: "100%",
      backgroundColor: colors.sheet,
    },
    thumb: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    placeholder: {
      width: "100%",
      minHeight: compact ? 118 : 132,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 18,
    },
    placeholderIcon: {
      width: compact ? 48 : 56,
      height: compact ? 48 : 56,
      borderRadius: 999,
      backgroundColor: colors.iconSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    placeholderLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.2,
    },
    kindBadge: {
      position: "absolute",
      top: 8,
      left: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kindBadgeText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      color: colors.primary,
    },
    soldBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(20,20,20,0.72)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    soldBadgeText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      color: "#FFFFFF",
    },
    body: {
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 5,
    },
    title: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: compact ? 13 : 14,
      lineHeight: compact ? 17 : 19,
      color: colors.text,
      minHeight: compact ? 34 : 38,
    },
    price: {
      fontFamily: "Montserrat_700Bold",
      fontSize: compact ? 14 : 15,
      color: colors.primary,
    },
    shopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    shop: {
      flex: 1,
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
    },
    action: {
      marginTop: 4,
      minHeight: 34,
      borderRadius: 10,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 10,
    },
    actionPressed: {
      backgroundColor: colors.primaryPressed,
    },
    actionDisabled: {
      backgroundColor: colors.sheet,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 12,
      color: colors.white,
    },
    actionTextDisabled: {
      color: colors.textMuted,
    },
  });
}
