import { useCallback, useMemo, useState } from "react";
import {
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
import DirectorySearch from "../components/explore/DirectorySearch";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import ListingThumb from "../components/marketplace/ListingThumb";
import MarketFilters from "../components/marketplace/MarketFilters";
import MarketCategorySheet from "../components/marketplace/MarketCategorySheet";
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
  const [kind, setKind] = useState<"all" | "service" | "goods">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

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

  const q = query.trim().toLowerCase();
  const visible = listings.filter((item) => {
    if (kind === "service" && item.listing_kind !== "service") return false;
    if (kind === "goods" && item.listing_kind === "service") return false;
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
      tab="market"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
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
            onPress={() => setCategoryOpen(true)}
            hitSlop={8}
            style={styles.filterBtn}
            accessibilityRole="button"
            accessibilityLabel={t("listing.category")}
          >
            <Ionicons
              name={category === ALL ? "options-outline" : "funnel"}
              size={22}
              color={colors.text}
            />
            {category !== ALL ? <View style={styles.filterDot} /> : null}
          </Pressable>
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
          <MarketFilters
            kind={kind}
            onKindChange={setKind}
            showCategories={false}
          />
          {category !== ALL ? (
            <Pressable
              onPress={() => setCategoryOpen(true)}
              style={styles.activeCategory}
              accessibilityRole="button"
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={styles.activeCategoryText} numberOfLines={1}>
                {category}
              </Text>
              <Pressable
                onPress={() => setCategory(ALL)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("explore.marketAll")}
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ) : null}
          {visible.length === 0 ? (
            <Text style={styles.empty}>
              {q ? t("explore.searchEmpty") : t("explore.marketEmpty")}
            </Text>
          ) : (
            <View style={styles.grid}>
              <View style={styles.column}>
                {visible.filter((_, index) => index % 2 === 0).map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    styles={styles}
                    colors={colors}
                    t={t}
                    addingId={addingId}
                    onOpen={openListing}
                    onAdd={addToCart}
                  />
                ))}
              </View>
              <View style={styles.column}>
                {visible.filter((_, index) => index % 2 === 1).map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    styles={styles}
                    colors={colors}
                    t={t}
                    addingId={addingId}
                    onOpen={openListing}
                    onAdd={addToCart}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
      <MarketCategorySheet
        visible={categoryOpen}
        category={category}
        categories={LISTING_CATEGORIES}
        onClose={() => setCategoryOpen(false)}
        onSelect={setCategory}
      />
    </FeedShell>
  );
}

type MarketStyles = ReturnType<typeof makeStyles>;

function ListingCard({
  item,
  styles,
  colors,
  t,
  addingId,
  onOpen,
  onAdd,
}: {
  item: MarketplaceListing;
  styles: MarketStyles;
  colors: Palette;
  t: (key: string, vars?: Record<string, string | number>) => string;
  addingId: string | null;
  onOpen: (id: string) => void;
  onAdd: (item: MarketplaceListing) => void;
}) {
  const service = item.listing_kind === "service";
  const soldOut =
    !service && Boolean(item.is_sold_out || (item.quantity_tracked && (item.stock ?? 0) <= 0));
  const image = absoluteUrl(item.image_url);
  return (
    <Pressable
      style={styles.card}
      onPress={() => onOpen(item.id)}
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
      <Text style={styles.kindLabel}>
        {service ? t("explore.filterServices") : t("explore.filterProducts")}
      </Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {item.seller_name || item.contact?.name || item.category || "Jos"}
      </Text>
      <Pressable
        onPress={() => (service ? onOpen(item.id) : onAdd(item))}
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
    </Pressable>
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
    filterBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    filterDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.background,
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
    activeCategory: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "100%",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.navActive,
    },
    activeCategoryText: {
      flexShrink: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.primary,
    },
    grid: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    column: {
      flex: 1,
      gap: 12,
    },
    empty: {
      marginTop: 24,
      textAlign: "center",
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    card: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 8,
      gap: 6,
      overflow: "hidden",
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
      minHeight: 120,
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
    kindLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.primary,
      paddingHorizontal: 4,
    },
    cardTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
      paddingHorizontal: 4,
    },
    meta: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
      paddingHorizontal: 4,
    },
    primary: {
      minHeight: 36,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
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
