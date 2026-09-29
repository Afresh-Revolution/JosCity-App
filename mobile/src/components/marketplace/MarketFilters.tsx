import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { LISTING_CATEGORIES } from "../../constants/listingCategories";
import { useI18n } from "../../i18n/I18nProvider";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type ListingKindFilter = "all" | "service" | "goods";

type Props = {
  kind: ListingKindFilter;
  onKindChange: (next: ListingKindFilter) => void;
  category?: string;
  onCategoryChange?: (next: string) => void;
  categories?: readonly string[];
  showCategories?: boolean;
  compact?: boolean;
};

const KIND_ICONS: Record<ListingKindFilter, IoniconName> = {
  all: "grid-outline",
  service: "briefcase-outline",
  goods: "cube-outline",
};

const CATEGORY_ICONS: Record<string, IoniconName> = {
  All: "apps-outline",
  "Agriculture & Farming": "leaf-outline",
  "Apparel & accessories": "shirt-outline",
  "Autos & vehicles": "car-outline",
  "Baby & children's products": "happy-outline",
  "Beauty products & services": "sparkles-outline",
  "Computers & peripherals": "laptop-outline",
  "Consumers & Electronics": "phone-portrait-outline",
  "Food & groceries": "nutrition-outline",
  "Gifts & Occasions": "gift-outline",
  "Home & Garden": "home-outline",
  "Photography & video": "camera-outline",
  "Tailoring & fashion": "cut-outline",
  "Home & repair services": "construct-outline",
  "Events & entertainment": "musical-notes-outline",
  Services: "briefcase-outline",
  Other: "ellipsis-horizontal-outline",
};

function categoryIcon(name: string): IoniconName {
  return CATEGORY_ICONS[name] || "pricetag-outline";
}

export { categoryIcon };

export default function MarketFilters({
  kind,
  onKindChange,
  category = "All",
  onCategoryChange,
  categories = LISTING_CATEGORIES,
  showCategories = true,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);

  const kinds: { id: ListingKindFilter; label: string }[] = [
    { id: "all", label: t("explore.filterAll") },
    { id: "service", label: t("explore.filterServices") },
    { id: "goods", label: t("explore.filterProducts") },
  ];

  const categoryChips = ["All", ...categories];

  return (
    <View style={styles.wrap}>
      <View style={styles.kindTrack} accessibilityRole="tablist">
        {kinds.map((item) => {
          const active = kind === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onKindChange(item.id)}
              style={[styles.kindSegment, active && styles.kindSegmentActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={KIND_ICONS[item.id]}
                size={compact ? 15 : 16}
                color={active ? colors.white : colors.textMuted}
              />
              <Text style={[styles.kindLabel, active && styles.kindLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showCategories && onCategoryChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categoryChips.map((item) => {
            const active = item === category;
            const label = item === "All" ? t("explore.marketAll") : item;
            return (
              <Pressable
                key={item}
                onPress={() => onCategoryChange(item)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={categoryIcon(item)}
                  size={14}
                  color={active ? colors.white : colors.primary}
                />
                <Text
                  style={[styles.categoryText, active && styles.categoryTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function makeStyles(colors: Palette, compact: boolean) {
  return StyleSheet.create({
    wrap: {
      gap: compact ? 10 : 12,
    },
    kindTrack: {
      flexDirection: "row",
      alignItems: "center",
      padding: 4,
      borderRadius: 14,
      backgroundColor: colors.sheet,
      gap: 4,
    },
    kindSegment: {
      flex: 1,
      minHeight: compact ? 38 : 42,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8,
    },
    kindSegmentActive: {
      backgroundColor: colors.primary,
      shadowColor: "#0C3D26",
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    kindLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: compact ? 12 : 13,
      color: colors.textMuted,
    },
    kindLabelActive: {
      color: colors.white,
      fontFamily: "Montserrat_700Bold",
    },
    categoryRow: {
      gap: 8,
      paddingVertical: 2,
      paddingRight: 4,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: compact ? 34 : 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: compact ? 12 : 13,
      color: colors.text,
      maxWidth: 160,
    },
    categoryTextActive: {
      color: colors.white,
    },
  });
}
