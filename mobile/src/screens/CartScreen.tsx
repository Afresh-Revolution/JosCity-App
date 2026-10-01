import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  findNodeHandle,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { AppAlert } from "../components/AppDialog";
import Ionicons from "@expo/vector-icons/Ionicons";
import JosCityLoader from "../components/JosCityLoader";
import AppButton from "../components/AppButton";
import TextField from "../components/TextField";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getWallet } from "../api/account";
import CbcTapPayPanel from "../components/wallet/CbcTapPayPanel";
import {
  checkoutListing,
  getListingCart,
  payListingWallet,
  removeListingCartItem,
  updateListingCartItem,
  type ListingCartItem,
  type ListingCheckoutOrder,
} from "../api/marketplace";
import { NfcReadError, readCardTap, type NfcCardRead } from "../nfc/readCbcCard";
import { useKeyboardOverlap } from "../hooks/useKeyboardOverlap";
import { useI18n } from "../i18n/I18nProvider";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import ListingPrice from "../components/marketplace/ListingPrice";
import { absoluteUrl, formatNaira } from "../utils/format";
import {
  fieldErrorMap,
  missingFields,
  requiredGuideMessage,
  scrollToFormError,
  type FieldCheck,
} from "../utils/formValidation";

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
  const [errorRequired, setErrorRequired] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tapSheet, setTapSheet] = useState(false);
  const [tapOrders, setTapOrders] = useState<ListingCheckoutOrder[] | null>(null);
  const [tapBusy, setTapBusy] = useState(false);
  const [orderStatus, setOrderStatus] = useState<Record<number, "paid">>({});
  const [pendingRead, setPendingRead] = useState<{ id: number; tag: NfcCardRead } | null>(null);
  const [pendingError, setPendingError] = useState<{ id: number; message: string } | null>(null);
  const readSerial = useRef(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Jos");
  const [stateName, setStateName] = useState("Plateau");
  const [notes, setNotes] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const errorBannerRef = useRef<View>(null);
  const scrollOffset = useRef(0);
  const sheetScrollOffset = useRef(0);

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
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

  const revealSheetPin = (event?: NativeSyntheticEvent<TextInputFocusEventData>) => {
    const target = event?.nativeEvent.target;
    const lift = () => {
      const handle = typeof target === "number" ? target : target ? findNodeHandle(target) : null;
      const covered = Math.max(keyboardRef.current.screenCover, keyboardRef.current.keyboardHeight, 280);
      const limit = Dimensions.get("screen").height - covered - 20;
      if (!handle) {
        sheetScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      UIManager.measureInWindow(handle, (_x, y, _w, height) => {
        const bottom = y + height;
        if (bottom > limit) {
          sheetScrollRef.current?.scrollTo({
            y: sheetScrollOffset.current + (bottom - limit),
            animated: true,
          });
        }
      });
    };
    setTimeout(lift, 80);
    setTimeout(lift, Platform.OS === "ios" ? 320 : 220);
  };

  const load = useCallback(async () => {
    const [cart, user] = await Promise.all([getListingCart(), getUser()]);
    setItems(cart);
    setFullName((current) => current || buyerName(user));
    setPhone((current) => current || String(user?.user_phone || user?.phone || "").trim());
    setEmail((current) => current || String(user?.user_email || user?.email || "").trim());
    setAddress(
      (current) =>
        current ||
        String(user?.address || user?.user_address || user?.location || "").trim()
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const needsDelivery = items.some((item) => item.listing.listing_kind !== "service");

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

  const contactReady = () => {
    const checks: FieldCheck[] = [
      { key: "fullName", label: t("listing.fullName"), ok: !!fullName.trim() },
      { key: "phone", label: t("listing.phone"), ok: !!phone.trim() },
      { key: "email", label: t("listing.email"), ok: !!email.trim() },
    ];
    if (needsDelivery) {
      checks.push(
        { key: "address", label: t("listing.address"), ok: !!address.trim() },
        { key: "city", label: t("listing.city"), ok: !!city.trim() },
        { key: "state", label: t("listing.state"), ok: !!stateName.trim() }
      );
    }
    const missing = missingFields(checks);
    if (!missing.length) {
      setError(null);
      setErrorRequired([]);
      setFieldErrors({});
      return true;
    }
    setFieldErrors(fieldErrorMap(missing));
    setErrorRequired(missing.map((item) => item.label));
    setError(t("listing.checkoutMissingGuide") || requiredGuideMessage(missing.length));
    scrollToFormError(scrollRef, errorBannerRef);
    return false;
  };

  const checkoutPayload = () => ({
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: email.trim(),
    address: address.trim(),
    city: city.trim(),
    state: stateName.trim(),
    notes: notes.trim(),
  });

  const pay = async () => {
    if (paying || tapBusy || !items.length) return;
    if (!contactReady()) return;
    setPaying(true);
    setError(null);
    const wallet = await getWallet();
    const balance = wallet.success && wallet.data ? Number(wallet.data.balance || 0) : 0;
    if (balance < total) {
      setPaying(false);
      setErrorRequired([]);
      setError(t("listing.walletNeedFund"));
      scrollToFormError(scrollRef, errorBannerRef);
      return;
    }
    const checkout = await checkoutListing(checkoutPayload());
    if (!checkout.success || !checkout.data?.orders?.length) {
      setPaying(false);
      setErrorRequired([]);
      setError(checkout.message || t("listing.checkoutFailed"));
      scrollToFormError(scrollRef, errorBannerRef);
      return;
    }
    for (const order of checkout.data.orders) {
      const paid = await payListingWallet(order.id);
      if (!paid.success) {
        setPaying(false);
        setErrorRequired([]);
        setError(paid.message || t("listing.checkoutFailed"));
        scrollToFormError(scrollRef, errorBannerRef);
        void load();
        return;
      }
    }
    setItems([]);
    setPaying(false);
    showNotice({ title: t("listing.paySuccess"), message: t("explore.cartPaid"), tone: "success" });
    router.back();
  };

  const tapPay = () => {
    if (paying || tapBusy || !items.length || !contactReady()) return;
    const id = readSerial.current + 1;
    readSerial.current = id;
    const scan = readCardTap(new AbortController().signal);
    setPendingRead(null);
    setPendingError(null);
    setTapBusy(true);
    const orderPromise = checkoutListing(checkoutPayload());
    void (async () => {
      try {
        const tag = await scan;
        const result = await orderPromise;
        if (!result.success || !result.data?.orders?.length) {
          AppAlert.alert(t("listing.payError"), result.message || t("listing.checkoutFailed"));
          return;
        }
        setTapOrders(result.data.orders);
        setPendingRead({ id, tag });
        setTapSheet(true);
      } catch (caught) {
        const message =
          caught instanceof NfcReadError && caught.code === "aborted"
            ? "The card reader closed before a card was read. Try CBC NFC pay again and hold the card to the phone."
            : caught instanceof Error
              ? caught.message
              : "Could not read the card. Try again.";
        setPendingError({ id, message });
        const result = await orderPromise.catch(() => null);
        if (result?.success && result.data?.orders?.length) {
          setTapOrders(result.data.orders);
          setTapSheet(true);
        } else {
          AppAlert.alert(t("listing.payError"), message);
        }
      } finally {
        setTapBusy(false);
      }
    })();
  };

  return (
    <FeedShell
      tab="market"
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
          {error ? (
            <ErrorBanner
              ref={errorBannerRef}
              title={errorRequired.length ? t("form.almostThere") : undefined}
              message={error}
              required={errorRequired}
            />
          ) : null}
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
                      <ListingPrice
                        price={(item.list_price ?? item.listing.price) * item.quantity}
                        salePrice={item.price * item.quantity}
                        discountPercent={item.discount_percent ?? item.listing.discount_percent}
                        offerText={item.offer_text || item.listing.offer_text}
                        colors={colors}
                        size="sm"
                      />
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
              <TextField
                label={t("listing.fullName")}
                value={fullName}
                onChangeText={(value) => {
                  setFullName(value);
                  clearFieldError("fullName");
                }}
                error={fieldErrors.fullName}
                onFocus={revealInput}
              />
              <TextField
                label={t("listing.phone")}
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  clearFieldError("phone");
                }}
                error={fieldErrors.phone}
                keyboardType="phone-pad"
                onFocus={revealInput}
              />
              <TextField
                label={t("listing.email")}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearFieldError("email");
                }}
                error={fieldErrors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={revealInput}
              />
              {needsDelivery ? (
                <>
                  <TextField
                    label={t("listing.address")}
                    value={address}
                    onChangeText={(value) => {
                      setAddress(value);
                      clearFieldError("address");
                    }}
                    error={fieldErrors.address}
                    onFocus={revealInput}
                  />
                  <TextField
                    label={t("listing.city")}
                    value={city}
                    onChangeText={(value) => {
                      setCity(value);
                      clearFieldError("city");
                    }}
                    error={fieldErrors.city}
                    onFocus={revealInput}
                  />
                  <TextField
                    label={t("listing.state")}
                    value={stateName}
                    onChangeText={(value) => {
                      setStateName(value);
                      clearFieldError("state");
                    }}
                    error={fieldErrors.state}
                    onFocus={revealInput}
                  />
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
              <View style={styles.payRow}>
                <AppButton
                  label={
                    paying
                      ? t("explore.cartPaying")
                      : t("explore.cartPay", { amount: formatNaira(total) })
                  }
                  onPress={() => void pay()}
                  loading={paying}
                  disabled={paying || tapBusy}
                  style={styles.payHalf}
                />
                <AppButton
                  label={tapBusy ? t("explore.cartPaying") : t("explore.cartTap")}
                  onPress={tapPay}
                  loading={tapBusy}
                  disabled={paying || tapBusy}
                  style={styles.payHalf}
                />
              </View>
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      )}
      <Modal visible={tapSheet} animationType="slide" transparent onRequestClose={() => !tapBusy && setTapSheet(false)}>
        <View style={styles.sheetWrap}>
          <Pressable style={styles.sheetDim} onPress={() => !tapBusy && setTapSheet(false)} />
          <View
            style={[
              styles.sheet,
              keyboard.screenCover > 0
                ? {
                    marginBottom: keyboard.screenCover,
                    maxHeight: Math.max(240, Dimensions.get("screen").height - keyboard.screenCover - 12),
                  }
                : null,
            ]}
          >
            <Text style={styles.sheetTitle}>{t("explore.cartTap")}</Text>
            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetBody}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                sheetScrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {(tapOrders || []).map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  {orderStatus[order.id] === "paid" ? (
                    <Text style={styles.paid}>{t("listing.paySuccessBody", { amount: formatNaira(order.totalNaira) })}</Text>
                  ) : (
                    <CbcTapPayPanel
                      orderId={order.id}
                      amountNaira={order.totalNaira}
                      disabled={tapBusy}
                      onBusyChange={setTapBusy}
                      onPinFocus={revealSheetPin}
                      pendingRead={pendingRead}
                      pendingError={pendingError}
                      onPaid={() => {
                        setOrderStatus((current) => {
                          const next = { ...current, [order.id]: "paid" as const };
                          const orders = tapOrders || [];
                          if (orders.length && orders.every((row) => next[row.id] === "paid")) {
                            setItems([]);
                            setTapSheet(false);
                            showNotice({
                              title: t("listing.paySuccess"),
                              message: t("explore.cartPaid"),
                              tone: "success",
                            });
                            router.back();
                          }
                          return next;
                        });
                      }}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    row: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 12,
    },
    image: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.sheet },
    meta: { flex: 1, gap: 4 },
    name: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: colors.text },
    price: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sheet },
    qty: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: colors.text, minWidth: 16, textAlign: "center" },
    remove: { marginLeft: 8, fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: colors.badge },
    note: { fontFamily: "Montserrat_400Regular", fontSize: 13, lineHeight: 18, color: colors.textMuted },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
      marginBottom: 20,
    },
    payHalf: { flex: 1 },
    sheetWrap: { flex: 1, justifyContent: "flex-end" },
    sheetDim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      maxHeight: "88%",
      overflow: "hidden",
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 16,
      paddingHorizontal: 16,
    },
    sheetScroll: { flexGrow: 0, flexShrink: 1 },
    sheetTitle: { fontFamily: "Montserrat_700Bold", fontSize: 18, color: colors.text, marginBottom: 8 },
    sheetBody: { gap: 12, paddingBottom: 28 },
    orderCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 12,
    },
    paid: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.primary },
  });
}
