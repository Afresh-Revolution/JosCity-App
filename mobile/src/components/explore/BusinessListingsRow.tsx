import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { MarketplaceListing } from "../../api/marketplace";
import ListingThumb from "../marketplace/ListingThumb";
import MarketFilters, { type ListingKindFilter } from "../marketplace/MarketFilters";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../../utils/format";

export type { ListingKindFilter };

type Props = {
  listings: MarketplaceListing[];
  title?: string;
  subtitle?: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  filter?: ListingKindFilter;
  onFilter?: (next: ListingKindFilter) => void;
};

export default function BusinessListingsRow({
  listings,
  title,
  subtitle,
  seeAllLabel,
  onSeeAll,
  filter = "all",
  onFilter,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const heading = title || t("explore.listingsTitle");
  const sub = subtitle || t("explore.listingsSubtitle");
  const seeAll = seeAllLabel || t("common.seeAll");
  const visible = listings.filter((item) => {
    if (filter === "service") return item.listing_kind === "service";
    if (filter === "goods") return item.listing_kind !== "service";
    return true;
  });
  if (!listings.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.subtitle}>{sub}</Text>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
            <Text style={styles.seeAll}>{seeAll}</Text>
          </Pressable>
        ) : null}
      </View>
      {onFilter ? (
        <View style={styles.filters}>
          <MarketFilters
            kind={filter}
            onKindChange={onFilter}
            showCategories={false}
            compact
          />
        </View>
      ) : null}
      {visible.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {visible.slice(0, 12).map((item) => {
            const image = absoluteUrl(item.image_url);
            const service = item.listing_kind === "service";
            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: "/listing/[id]", params: { id: item.id, source: "marketplace" } })
                }
                accessibilityRole="button"
              >
                <View style={styles.media}>
                  <ListingThumb
                    uri={image}
                    backgroundColor={colors.sheet}
                    style={styles.thumb}
                    fallback={
                      <View style={styles.imageFallback}>
                        <Ionicons
                          name={service ? "briefcase-outline" : "cube-outline"}
                          size={28}
                          color={colors.textMuted}
                        />
                      </View>
                    }
                  />
                  <View style={styles.pricePill}>
                    <Text style={styles.price}>{formatNaira(item.price)}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.shop} numberOfLines={1}>
                  {item.seller_name || item.contact?.name || item.category || "Jos"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>{t("explore.marketEmpty")}</Text>
      )}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    section: {
      marginTop: 8,
      marginBottom: 12,
      gap: 10,
    },
    heading: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      gap: 12,
    },
    headingCopy: { flex: 1, gap: 2 },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    subtitle: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    seeAll: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.primary,
    },
    filters: {
      paddingHorizontal: 16,
    },
    row: {
      paddingHorizontal: 16,
      gap: 12,
    },
    card: {
      width: 168,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 8,
      gap: 6,
    },
    media: {
      position: "relative",
      width: "100%",
    },
    thumb: {
      borderRadius: 12,
    },
    imageFallback: {
      width: "100%",
      height: "100%",
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
    },
    pricePill: {
      position: "absolute",
      top: 8,
      left: 8,
      backgroundColor: "rgba(12, 61, 38, 0.92)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    price: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 11,
      color: "#FFFFFF",
    },
    cardTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      lineHeight: 17,
      color: colors.text,
      paddingHorizontal: 4,
    },
    shop: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    empty: {
      paddingHorizontal: 16,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
  });
}
