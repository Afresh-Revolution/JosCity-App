import { StyleSheet, Text, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { formatNaira } from "../../utils/format";

type Props = {
  price: number;
  salePrice?: number | null;
  discountPercent?: number | null;
  offerText?: string | null;
  unit?: string | null;
  colors: Palette;
  size?: "sm" | "md";
};

export function chargedAmount(
  price: number,
  salePrice?: number | null,
  discountPercent?: number | null
) {
  const list = Number(price) || 0;
  const percent = Number(discountPercent) || 0;
  if (salePrice != null && Number.isFinite(Number(salePrice))) {
    const sale = Number(salePrice);
    if (sale >= 0 && (percent <= 0 || sale < list)) return sale;
  }
  if (percent > 0) {
    const clamped = Math.min(100, percent);
    return Math.max(0, Math.round((list * (100 - clamped)) / 100));
  }
  return list;
}

export default function ListingPrice({
  price,
  salePrice,
  discountPercent,
  offerText,
  unit,
  colors,
  size = "md",
}: Props) {
  const styles = makeStyles(colors, size);
  const charged = chargedAmount(price, salePrice, discountPercent);
  const percent = Number(discountPercent) || 0;
  const discounted = percent > 0 && charged < price;
  const offer = String(offerText || "").trim();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.price}>
          {formatNaira(charged)}
          {unit ? ` · ${unit}` : ""}
        </Text>
        {discounted ? <Text style={styles.was}>{formatNaira(price)}</Text> : null}
        {percent > 0 ? <Text style={styles.tag}>{percent}% off</Text> : null}
      </View>
      {offer ? <Text style={styles.offer}>Offer: {offer}</Text> : null}
    </View>
  );
}

function makeStyles(colors: Palette, size: "sm" | "md") {
  return StyleSheet.create({
    wrap: { gap: 4 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    price: {
      fontFamily: "Montserrat_700Bold",
      fontSize: size === "sm" ? 14 : 16,
      color: colors.primary,
    },
    was: {
      fontFamily: "Montserrat_500Medium",
      fontSize: size === "sm" ? 12 : 13,
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    tag: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.primary,
      backgroundColor: colors.iconSoft,
      borderRadius: 999,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    offer: {
      alignSelf: "flex-start",
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.primary,
      backgroundColor: colors.iconSoft,
      borderRadius: 999,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
  });
}
