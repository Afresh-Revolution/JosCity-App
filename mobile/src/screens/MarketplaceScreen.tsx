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
import DirectorySearch from "../components/explore/DirectorySearch";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { addListingToCart, getListingCart, getPublicListings, type MarketplaceListing } from "../api/marketplace";
import { showError, showNotice } from "../components/AppNotice";
import { LISTING_CATEGORIES } from "../constants/listingCategories";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getAccountType, homeRouteForAccount, normalizeAccountType } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../utils/format";

const ALL = "All";

export default function MarketplaceScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { t } = useI18n();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const type = await getAccountType();
    if (normalizeAccountType(type) !== "personal") {
      router.replace(homeRouteForAccount(type));
      return;
    }
    setPersonal(true);
    const [rows, cart] = await Promise.all([getPublicListings(), getListingCart()]);
    setListings(rows);
    setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const chips = [ALL, ...LISTING_CATEGORIES];
  const q = query.trim().toLowerCase();
  const visible = listings.filter((item) => {
    if (category !== ALL && item.category !== category) return false;
    if (!q) return true;
    return `${item.title} ${item.description || ""} ${item.category || ""}`
      .toLowerCase()
      .includes(q);
  });

  const openListing = (id: string) => {
    router.push({ pathname: "/listing/[id]", params: { id, source: "marketplace" } });
  };

  const addToCart = (item: MarketplaceListing) => {
    if (addingId) return;
    const soldOut = Boolean(item.is_sold_out || (item.quantity_tracked && (item.stock ?? 0) <= 0));
    if (soldOut || item.can_purchase === false) return;
    setAddingId(item.id);
    void addListingToCart(item.id, 1).then((result) => {
      setAddingId(null);
      if (!result.success) {
        showError(result.message || t("explore.cartAddFailed"));
        return;
      }
      setCartCount((count) => count + 1);
      showNotice({ title: t("explore.cartAdded"), message: item.title, tone: "success" });
    });
  };

  if (!allowed || !personal) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="explore"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.kicker}>{t("explore.marketKicker")}</Text>
            <Text style={styles.title}>{t("explore.marketTitle")}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/cart")}
            hitSlop={8}
            style={styles.cartBtn}
            accessibilityRole="button"
            accessibilityLabel={t("explore.cart")}
          >
            <Ionicons name="cart-outline" size={24} color={colors.text} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
              tintColor={colors.primary}
            />
          }
        >
          <DirectorySearch
            value={query}
            onChangeText={setQuery}
            placeholder={t("explore.marketSearch")}
          />
          <Text style={styles.intro}>{t("explore.marketIntro")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {chips.map((item) => {
              const active = item === category;
              const label = item === ALL ? t("explore.marketAll") : item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {visible.length === 0 ? (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("explore.marketEmpty")}
            </Text>
          ) : (
            visible.map((item, index) => {
              const service = item.listing_kind === "service";
              const soldOut = !service && Boolean(item.is_sold_out || (item.quantity_tracked && (item.stock ?? 0) <= 0));
              const image = absoluteUrl(item.image_url);
              return (
                <FadeIn key={item.id} delay={Math.min(index * 20, 120)}>
                  <View style={styles.card}>
                    {image ? (
                      <Image source={{ uri: image }} style={styles.image} />
                    ) : (
                      <View style={styles.imageFallback}>
                        <Text style={styles.imageFallbackText}>{t("explore.marketNoImage")}</Text>
                      </View>
                    )}
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {service
                        ? item.service_area || item.category || "Jos"
                        : item.quantity_tracked
                          ? t("explore.marketInStock", { count: item.stock || 0 })
                          : item.category || "Jos"}
                    </Text>
                    <Text style={styles.price}>{formatNaira(item.price)}</Text>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => openListing(item.id)}
                        style={styles.secondary}
                        accessibilityRole="button"
                      >
                        <Ionicons name="chevron-down" size={16} color={colors.text} />
                        <Text style={styles.secondaryText}>{t("explore.marketView")}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => (service ? openListing(item.id) : addToCart(item))}
                        style={[styles.primary, soldOut && styles.primaryDisabled]}
                        disabled={soldOut || addingId === item.id}
                        accessibilityRole="button"
                      >
                        <Text style={styles.primaryText}>
                          {soldOut
                            ? t("explore.marketSoldOut")
                            : service
                              ? t("explore.marketBook")
                              : addingId === item.id
                                ? t("explore.cartAdding")
                                : t("explore.marketBuy")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </FadeIn>
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    heading: {
      flex: 1,
    },
    cartBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    cartBadge: {
      position: "absolute",
      top: 2,
      right: 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.badge,
    },
    cartBadgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 9,
      color: colors.white,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE,
      gap: 12,
    },
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    chips: {
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.sheet,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    chipTextActive: {
      color: colors.white,
    },
    empty: {
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 18,
      padding: 14,
      gap: 8,
    },
    image: {
      width: "100%",
      height: 150,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    imageFallback: {
      width: "100%",
      height: 150,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.sheet,
    },
    imageFallbackText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    cardTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    cardBody: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    meta: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    price: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    secondary: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    secondaryText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    primary: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryDisabled: {
      backgroundColor: colors.textMuted,
    },
    primaryText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.white,
    },
  });
}
