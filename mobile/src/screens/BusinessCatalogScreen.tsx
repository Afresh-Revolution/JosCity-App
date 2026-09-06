import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getMyListings, type MarketplaceListing } from "../api/marketplace";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../utils/format";
import { openListing } from "../utils/openListing";

export default function BusinessCatalogScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "replace" | "refresh" = "replace") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      setListings(await getMyListings());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load();
    }, [allowed, load])
  );

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab="manage" header={<View />}>
      {loading && listings.length === 0 ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />
          }
        >
          <FadeIn>
            <Pressable onPress={() => router.back()} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={styles.backText}>{t("business.manageTitle")}</Text>
            </Pressable>
            <Text style={styles.title}>{t("business.manageCatalog")}</Text>
            <Text style={styles.body}>{t("business.manageCatalogBody")}</Text>
            <Pressable
              onPress={() => router.push("/business/new-listing")}
              style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.addChipText}>{t("business.addListing")}</Text>
            </Pressable>
          </FadeIn>
          {listings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t("business.manageEmpty")}</Text>
              <Pressable
                onPress={() => router.push("/business/new-listing")}
                style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.addChipText}>{t("business.addListing")}</Text>
              </Pressable>
            </View>
          ) : (
            listings.map((listing) => {
              const image = absoluteUrl(listing.image_url);
              const service = listing.listing_kind === "service";
              return (
                <Pressable
                  key={listing.id}
                  onPress={() => openListing(router, listing.id)}
                  style={styles.card}
                >
                  {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                  ) : (
                    <View style={styles.imageFallback}>
                      <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.copy}>
                    <Text numberOfLines={1} style={styles.listingTitle}>
                      {listing.title}
                    </Text>
                    {listing.listing_status === "draft" ? (
                      <Text style={styles.draft}>{t("business.draftBadge")}</Text>
                    ) : null}
                    <Text style={styles.price}>{formatNaira(listing.price)}</Text>
                    <Text style={styles.meta}>
                      {service
                        ? [
                            listing.unit,
                            listing.duration_note,
                            listing.service_area,
                          ]
                            .filter(Boolean)
                            .join(" · ") || t("business.untracked")
                        : listing.quantity_tracked
                          ? [
                              t("business.stock", { count: listing.stock ?? 0 }),
                              listing.unit,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : listing.unit || listing.category || t("business.untracked")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE + 16,
    },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 8,
      marginTop: 4,
    },
    backText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
      marginBottom: 6,
    },
    body: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 12,
    },
    addChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.brand,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 16,
    },
    addChipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.white,
    },
    pressed: {
      opacity: 0.88,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 48,
      gap: 10,
    },
    emptyTitle: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    image: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    imageFallback: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      marginLeft: 12,
    },
    listingTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    draft: {
      marginTop: 2,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    price: {
      marginTop: 2,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.primary,
    },
    meta: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
