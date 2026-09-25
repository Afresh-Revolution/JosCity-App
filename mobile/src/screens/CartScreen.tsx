import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  findNodeHandle,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import JosCityLoader from "../components/JosCityLoader";
import AppButton from "../components/AppButton";
import TextField from "../components/TextField";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getWallet } from "../api/account";
import {
  checkoutListing,
  getListingCart,
  payListingWallet,
  removeListingCartItem,
  updateListingCartItem,
  type ListingCartItem,
} from "../api/marketplace";
import { useKeyboardOverlap } from "../hooks/useKeyboardOverlap";
import { useI18n } from "../i18n/I18nProvider";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../utils/format";

function buyerName(user: StoredUser | null): string {
  return (
    String(user?.display_name || "").trim() ||
    [user?.user_firstname || user?.first_name, user?.user_lastname || user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

export default function CartScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<ListingCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Jos");
  const [stateName, setStateName] = useState("Plateau");
  const [notes, setNotes] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const keyboard = useKeyboardOverlap();
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;

  const revealInput = (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    const target = event.nativeEvent.target;
    const lift = () => {
      const handle = typeof target === "number" ? target : findNodeHandle(target);
      if (!handle) {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      UIManager.measureInWindow(handle, (_x, y, _w, height) => {
        const latest = keyboardRef.current;
        const covered = Math.max(latest.overlap, latest.keyboardHeight, Platform.OS === "ios" ? 336 : 280);
        const limit = Dimensions.get("window").height - covered - 24;
        const bottom = y + height;
        if (bottom > limit) {
          scrollRef.current?.scrollTo({
            y: scrollOffset.current + (bottom - limit),
            animated: true,
          });
        }
      });
    };
    setTimeout(lift, Platform.OS === "ios" ? 280 : 160);
  };

  const load = useCallback(async () => {
    const [cart, user] = await Promise.all([getListingCart(), getUser()]);
    setItems(cart);
    setFullName((current) => current || buyerName(user));
    setPhone((current) => current || String(user?.user_phone || user?.phone || "").trim());
    setEmail((current) => current || String(user?.user_email || user?.email || "").trim());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const goodsOnly = items.every((item) => item.listing.listing_kind !== "service");

  const changeQty = (item: ListingCartItem, next: number) => {
    const stock = item.listing.quantity_tracked ? Number(item.listing.stock || 0) : 99;
    const quantity = Math.max(1, Math.min(stock || 1, next));
    setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, quantity } : row)));
    void updateListingCartItem(item.id, quantity).then((result) => {
      if (!result.success) {
        showError(result.message || t("explore.cartAddFailed"));
        void load();
      }
    });
  };

  const remove = (item: ListingCartItem) => {
    setItems((rows) => rows.filter((row) => row.id !== item.id));
    void removeListingCartItem(item.id).then((result) => {
      if (!result.success) {
        showError(result.message || t("explore.cartAddFailed"));
        void load();
      }
    });
  };

  const pay = async () => {
    if (paying || !items.length) return;
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setError(t("listing.contactRequired"));
      return;
    }
    if (goodsOnly && (!address.trim() || !city.trim() || !stateName.trim())) {
      setError(t("listing.addressRequired"));
      return;
    }
    setPaying(true);
    setError(null);
    const wallet = await getWallet();
    const balance = wallet.success && wallet.data ? Number(wallet.data.balance || 0) : 0;
    if (balance < total) {
      setPaying(false);
      setError(t("listing.walletNeedFund"));
      return;
    }
    const checkout = await checkoutListing({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      notes: notes.trim(),
    });
    if (!checkout.success || !checkout.data?.orders?.length) {
      setPaying(false);
      setError(checkout.message || t("listing.checkoutFailed"));
      return;
    }
    for (const order of checkout.data.orders) {
      const paid = await payListingWallet(order.id);
      if (!paid.success) {
        setPaying(false);
        setError(paid.message || t("listing.checkoutFailed"));
        void load();
        return;
      }
    }
    setItems([]);
    setPaying(false);
    showNotice({ title: t("listing.paySuccess"), message: t("explore.cartPaid"), tone: "success" });
    router.back();
  };

  return (
    <FeedShell
      tab="explore"
      header={
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("explore.cart")}</Text>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_SPACE + keyboard.overlap }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {error ? <ErrorBanner message={error} /> : null}
          {items.length === 0 ? (
            <Text style={styles.empty}>{t("explore.cartEmpty")}</Text>
          ) : (
            <>
              {items.map((item) => {
                const image = absoluteUrl(item.listing.image_url);
                return (
                  <View key={item.id} style={styles.row}>
                    {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.image} />}
                    <View style={styles.meta}>
                      <Text style={styles.name} numberOfLines={2}>{item.listing.title}</Text>
                      <Text style={styles.price}>{formatNaira(item.price * item.quantity)}</Text>
                      <View style={styles.qtyRow}>
                        <Pressable onPress={() => changeQty(item, item.quantity - 1)} style={styles.qtyBtn}>
                          <Ionicons name="remove" size={16} color={colors.text} />
                        </Pressable>
                        <Text style={styles.qty}>{item.quantity}</Text>
                        <Pressable onPress={() => changeQty(item, item.quantity + 1)} style={styles.qtyBtn}>
                          <Ionicons name="add" size={16} color={colors.text} />
                        </Pressable>
                        <Pressable onPress={() => remove(item)}>
                          <Text style={styles.remove}>{t("explore.cartRemove")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.note}>{t("explore.cartSellers")}</Text>
              <TextField label={t("listing.fullName")} value={fullName} onChangeText={setFullName} onFocus={revealInput} />
              <TextField label={t("listing.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" onFocus={revealInput} />
              <TextField label={t("listing.email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" onFocus={revealInput} />
              {goodsOnly ? (
                <>
                  <TextField label={t("listing.address")} value={address} onChangeText={setAddress} onFocus={revealInput} />
                  <TextField label={t("listing.city")} value={city} onChangeText={setCity} onFocus={revealInput} />
                  <TextField label={t("listing.state")} value={stateName} onChangeText={setStateName} onFocus={revealInput} />
                </>
              ) : null}
              <TextField
                label={t("explore.cartNotes")}
                labelAside={t("explore.cartNotesOptional")}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("explore.cartNotesHint")}
                multiline
                onFocus={revealInput}
              />
              <AppButton
                label={paying ? t("explore.cartPaying") : t("explore.cartPay", { amount: formatNaira(total) })}
                onPress={() => void pay()}
                loading={paying}
                disabled={paying}
                style={styles.pay}
              />
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    title: { fontFamily: "Montserrat_700Bold", fontSize: 22, color: colors.text },
    content: { paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE, gap: 12 },
    empty: { marginTop: 32, textAlign: "center", fontFamily: "Montserrat_500Medium", fontSize: 15, color: colors.textMuted },
    row: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12 },
    image: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.sheet },
    meta: { flex: 1, gap: 4 },
    name: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: colors.text },
    price: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sheet },
    qty: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: colors.text, minWidth: 16, textAlign: "center" },
    remove: { marginLeft: 8, fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: colors.badge },
    note: { fontFamily: "Montserrat_400Regular", fontSize: 13, lineHeight: 18, color: colors.textMuted },
    pay: { marginBottom: 20 },
  });
}
