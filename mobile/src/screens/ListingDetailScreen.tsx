import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  findNodeHandle,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInputFocusEventData,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import TextField from "../components/TextField";
import CbcCardPayForm from "../components/wallet/CbcCardPayForm";
import CbcTapPayPanel from "../components/wallet/CbcTapPayPanel";
import { NfcReadError, prepareCardReader, readCardTap, type NfcCardRead } from "../nfc/readCbcCard";
import { ErrorBanner } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import ReportSheet from "../components/ReportSheet";
import { getWallet, getWalletFunding, type WalletFundingOptions } from "../api/account";
import {
  checkoutListing,
  getListing,
  payListingCbcCard,
  payListingWallet,
  type ListingCheckoutOrder,
  type MarketplaceListing,
} from "../api/marketplace";
import { SERVICE_PLACES } from "../constants/listingCategories";
import { useKeyboardOverlap } from "../hooks/useKeyboardOverlap";
import { useI18n } from "../i18n/I18nProvider";
import {
  getAccountType,
  getUser,
  hasSession,
  isBusinessAccountType,
  type StoredUser,
} from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../utils/format";
import { formatDurationNote } from "../utils/listingDisplay";
import type { FeedTab } from "../components/feed/FeedTabBar";

function buyerName(user: StoredUser | null): string {
  return (
    String(user?.display_name || "").trim() ||
    [user?.user_firstname || user?.first_name, user?.user_lastname || user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

function orderPayLabel(order: Pick<ListingCheckoutOrder, "items">) {
  const titles = order.items
    .map((item) => {
      const title = String(item.title || "").trim();
      if (!title) return "";
      return item.quantity > 1 ? `${title} × ${item.quantity}` : title;
    })
    .filter(Boolean);
  return titles[0] || "Your order";
}

function placeLabel(value?: string | null): string {
  const id = String(value || "").trim();
  return SERVICE_PLACES.find((row) => row.id === id)?.label || id;
}

function isPlatformPayee(value?: string | null): boolean {
  const name = String(value || "").trim().toLowerCase();
  return name === "joscity" || name === "jos city" || name === "jos smart city";
}

function payeeName(
  listing: MarketplaceListing | null,
  order?: ListingCheckoutOrder | null
): string {
  const fromSeller = String(order?.sellerName || "").trim();
  if (fromSeller && !isPlatformPayee(fromSeller)) return fromSeller;
  const fromContact = String(listing?.contact?.name || "").trim();
  if (fromContact && !isPlatformPayee(fromContact)) return fromContact;
  const fromBank = String(order?.sellerBank?.bankAccountName || "").trim();
  if (fromBank && !isPlatformPayee(fromBank)) return fromBank;
  return fromSeller || fromContact || "the seller";
}

function listingImages(listing: MarketplaceListing): string[] {
  const urls = (listing.media || [])
    .map((item) => absoluteUrl(item.url) || item.url)
    .filter(Boolean);
  const cover = absoluteUrl(listing.image_url) || listing.image_url;
  if (cover && !urls.includes(cover)) urls.unshift(cover);
  return [...new Set(urls)];
}

export default function ListingDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; source?: string | string[] }>();
  const listingId = String(Array.isArray(params.id) ? params.id[0] : params.id || "");
  const source = String(Array.isArray(params.source) ? params.source[0] : params.source || "direct");

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<FeedTab>("explore");
  const [isBusiness, setIsBusiness] = useState(false);
  const [userId, setUserId] = useState(0);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [readerAway, setReaderAway] = useState(false);
  const [pendingRead, setPendingRead] = useState<{ id: number; tag: NfcCardRead } | null>(null);
  const [pendingError, setPendingError] = useState<{ id: number; message: string } | null>(null);
  const readSerial = useRef(0);
  const sheetScrollRef = useRef<ScrollView>(null);
  const sheetScrollOffset = useRef(0);
  const keyboard = useKeyboardOverlap();
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;
  const sheetLift = Platform.OS === "android" ? keyboard.overlap : 0;

  const revealPin = (event?: NativeSyntheticEvent<TextInputFocusEventData>) => {
    const target = event?.nativeEvent.target;
    const lift = () => {
      const handle = typeof target === "number" ? target : target ? findNodeHandle(target) : null;
      if (!handle) {
        sheetScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      UIManager.measureInWindow(handle, (_x, y, _w, height) => {
        const latest = keyboardRef.current;
        const covered = Math.max(latest.overlap, latest.keyboardHeight, 280);
        const limit = Dimensions.get("window").height - covered - 24;
        const bottom = y + height;
        if (bottom > limit) {
          sheetScrollRef.current?.scrollTo({
            y: sheetScrollOffset.current + (bottom - limit),
            animated: true,
          });
        }
      });
    };
    setTimeout(lift, 180);
    setTimeout(lift, 420);
  };
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<ListingCheckoutOrder[] | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Jos");
  const [stateName, setStateName] = useState("Plateau");
  const [preferredAt, setPreferredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [funding, setFunding] = useState<WalletFundingOptions | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [payBusy, setPayBusy] = useState(false);
  const [tapBusy, setTapBusy] = useState(false);
  const [orderStatus, setOrderStatus] = useState<Record<number, "paid" | "pending">>({});
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    prepareCardReader();
  }, []);

  useEffect(() => {
    if (!sheet || Platform.OS !== "android") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (saving || payBusy || tapBusy) return true;
      setSheet(false);
      return true;
    });
    return () => sub.remove();
  }, [sheet, saving, payBusy, tapBusy]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const ok = await hasSession();
        if (!ok) {
          router.replace("/login");
          return;
        }
        const [type, stored] = await Promise.all([getAccountType(), getUser()]);
        if (cancelled) return;
        setIsBusiness(isBusinessAccountType(type));
        setTab(isBusinessAccountType(type) ? "manage" : "explore");
        setUserId(Number(stored?.user_id || 0));
        setUser(stored);
        setFullName((current) => current || buyerName(stored));
        setEmail((current) => current || String(stored?.user_email || stored?.email || "").trim());
        setPhone(
          (current) =>
            current || String(stored?.user_phone || stored?.business_phone || "").trim()
        );
        const [fund, wallet] = await Promise.all([getWalletFunding(), getWallet()]);
        if (!cancelled && fund.success && fund.data) setFunding(fund.data);
        if (!cancelled && wallet.success && wallet.data) setWalletBalance(Number(wallet.data.balance || 0));
        setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [router])
  );

  const load = useCallback(async () => {
    if (!listingId) return;
    setError(null);
    const row = await getListing(listingId, source);
    if (!row) {
      setError(t("listing.notFound"));
      setListing(null);
      return;
    }
    setListing(row);
    setQty(1);
  }, [listingId, source, t]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void load().finally(() => setLoading(false));
    }, [load, ready])
  );

  const isService = listing?.listing_kind === "service";
  const owner = Boolean(listing?.seller_user_id && Number(listing.seller_user_id) === userId);
  const maxQty = listing?.quantity_tracked
    ? Math.max(1, Number(listing.stock || 1))
    : isService
      ? 20
      : 99;
  const images = listing ? listingImages(listing) : [];
  const unavailable = Boolean(
    listing &&
      (listing.can_purchase === false ||
        (!isService &&
          (listing.is_sold_out || (listing.quantity_tracked && (listing.stock ?? 0) <= 0))))
  );
  const unitLower = String(listing?.unit || "").toLowerCase();
  const qtyLabel = isService
    ? unitLower.includes("minute") || unitLower.includes("min")
      ? t("listing.minutes")
      : unitLower.includes("hour")
      ? t("listing.hours")
      : unitLower.includes("day")
        ? t("listing.days")
        : t("listing.sessions")
    : t("listing.qty");
  const cta = isService ? t("listing.book") : t("listing.buy");
  const total = (listing?.price || 0) * qty;
  const sellerName = payeeName(listing, orders?.[0] || null);

  const openCheckout = () => {
    if (!listing) return;
    if (owner) return;
    if (isBusiness) {
      Alert.alert(t("listing.personalOnlyTitle"), t("listing.personalOnlyBody"));
      return;
    }
    if (unavailable) {
      Alert.alert(t("listing.unavailableTitle"), t("listing.unavailableBody"));
      return;
    }
    setFormError(null);
    setOrders(null);
    setOrderStatus({});
    setSheet(true);
  };

  const submit = async () => {
    if (!listing || saving) return;
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setFormError(t("listing.contactRequired"));
      return;
    }
    if (!isService && (!address.trim() || !city.trim() || !stateName.trim())) {
      setFormError(t("listing.addressRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await checkoutListing({
      listingId: listing.id,
      quantity: qty,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      notes: notes.trim(),
      preferredAt: preferredAt.trim(),
    });
    setSaving(false);
    if (!result.success || !result.data?.orders?.length) {
      setFormError(result.message || t("listing.checkoutFailed"));
      return;
    }
    setOrders(result.data.orders);
    if (result.data.funding) setFunding(result.data.funding);
    const wallet = await getWallet();
    if (wallet.success && wallet.data) setWalletBalance(Number(wallet.data.balance || 0));
  };

  const payWithCbcCard = async (
    order: ListingCheckoutOrder,
    details: { cardNumber: string; cvc: string; cardPin: string }
  ) => {
    if (payBusy || tapBusy) return;
    setPayBusy(true);
    const result = await payListingCbcCard(order.id, details);
    setPayBusy(false);
    if (!result.success) {
      Alert.alert(t("listing.payError"), result.message || t("listing.checkoutFailed"));
      return;
    }
    setOrderStatus((current) => ({ ...current, [order.id]: "paid" }));
    Alert.alert(
      t("listing.paySuccess"),
      result.data?.cbc_amount
        ? t("listing.cbcPaySuccessBody", {
            amount: formatNaira(order.totalNaira),
            cbc: Number(result.data.cbc_amount).toLocaleString("en-US", {
              maximumFractionDigits: 4,
            }),
          })
        : t("listing.paySuccessBody", { amount: formatNaira(order.totalNaira) })
    );
  };

  const payWithWallet = async (order: ListingCheckoutOrder) => {
    if (payBusy || tapBusy) return;
    if (walletBalance < order.totalNaira) {
      Alert.alert(t("listing.payError"), t("listing.walletNeedFund"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("listing.openWallet"), onPress: () => router.push("/profile/wallet") },
      ]);
      return;
    }
    setPayBusy(true);
    const result = await payListingWallet(order.id);
    setPayBusy(false);
    if (!result.success) {
      Alert.alert(t("listing.payError"), result.message || t("listing.checkoutFailed"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("listing.openWallet"), onPress: () => router.push("/profile/wallet") },
      ]);
      return;
    }
    setWalletBalance((current) => Math.max(0, current - order.totalNaira));
    setOrderStatus((current) => ({ ...current, [order.id]: "paid" }));
    Alert.alert(
      t("listing.paySuccess"),
      t("listing.paySuccessBody", { amount: formatNaira(order.totalNaira) })
    );
  };

  const shareListing = async () => {
    if (!listing) return;
    const message = `${listing.title} · ${formatNaira(listing.price)}\nhttps://joscity.com/listing/${listing.id}`;
    await Share.share({ message, title: listing.title }).catch(() => undefined);
  };

  if (!ready || (loading && !listing)) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  const requestCardRead = (openSheet = false) => {
    const id = readSerial.current + 1;
    readSerial.current = id;
    setPendingRead(null);
    setPendingError(null);
    setReaderAway(true);
    setTapBusy(true);
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      try {
        const tag = await readCardTap(new AbortController().signal);
        setPendingRead({ id, tag });
        if (openSheet) setSheet(true);
      } catch (caught) {
        const aborted = caught instanceof NfcReadError && caught.code === "aborted";
        if (!aborted) {
          setPendingError({
            id,
            message: caught instanceof Error ? caught.message : "Could not read the card. Try again.",
          });
          if (openSheet) setSheet(true);
        }
      } finally {
        setReaderAway(false);
        setTapBusy(false);
      }
    })();
  };

  const tapFromListing = () => {
    if (!listing || saving || readerAway || payBusy || unavailable || owner || isBusiness) return;
    const id = readSerial.current + 1;
    const scan = readCardTap(new AbortController().signal);
    setSheet(false);
    readSerial.current = id;
    setPendingRead(null);
    setPendingError(null);
    setReaderAway(true);
    setTapBusy(true);
    const orderPromise = checkoutListing({
      listingId: listing.id,
      quantity: qty,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      notes: notes.trim(),
      preferredAt: preferredAt.trim(),
    });
    void (async () => {
      try {
        const tag = await scan;
        const result = await orderPromise;
        if (!result.success || !result.data?.orders?.length) {
          Alert.alert(t("listing.payError"), result.message || t("listing.checkoutFailed"));
          return;
        }
        setOrders(result.data.orders);
        if (result.data.funding) setFunding(result.data.funding);
        setPendingRead({ id, tag });
        setSheet(true);
      } catch (caught) {
        const message =
          caught instanceof NfcReadError && caught.code === "aborted"
            ? "The card reader closed before a card was read. Tap to pay again and hold the card at the top of the iPhone."
            : caught instanceof Error
              ? caught.message
              : "Could not read the card. Try again.";
        setPendingError({ id, message });
        Alert.alert("Tap to pay", message);
      } finally {
        setReaderAway(false);
        setTapBusy(false);
      }
    })();
  };

  return (
    <FeedShell tab={tab} header={<View />}>
      {sheet && !readerAway ? <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving && !payBusy && !tapBusy) setSheet(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
          onLayout={keyboard.onContainerLayout}
        >
          <Pressable
            style={styles.sheetDim}
            onPress={() => !saving && !payBusy && !tapBusy && setSheet(false)}
          />
          <View
            style={[
              styles.sheet,
              sheetLift > 0
                ? { marginBottom: sheetLift, maxHeight: Dimensions.get("window").height - sheetLift - 12 }
                : null,
            ]}
          >
            <View style={styles.sheetHandle} />
            {orders?.length ? (
              <ScrollView
                ref={sheetScrollRef}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetBody}
                onScroll={(event) => {
                  sheetScrollOffset.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                <Text style={styles.sheetTitle}>
                  {isService ? t("listing.bookedTitle") : t("listing.orderedTitle")}
                </Text>
                <Text style={styles.sheetLead}>
                  {isService
                    ? t("listing.paySellerBooked", { name: sellerName })
                    : t("listing.paySellerOrdered", { name: sellerName })}
                </Text>
                {orders.map((order) => {
                  const status = orderStatus[order.id];
                  return (
                    <View key={order.id} style={styles.bankCard}>
                      <Text style={styles.bankKicker}>
                        {t("listing.orderSummary", {
                          title: orderPayLabel(order),
                          amount: formatNaira(order.totalNaira),
                        })}
                      </Text>
                      {status === "paid" ? (
                        <Text style={styles.payNote}>{t("listing.paySuccessBody", { amount: formatNaira(order.totalNaira) })}</Text>
                      ) : (
                        <>
                          <Text style={styles.payTo}>
                            {t("listing.walletBalance", { amount: formatNaira(walletBalance) })}
                          </Text>
                          <AppButton
                            label={payBusy ? t("listing.sending") : t("listing.wallet")}
                            onPress={() => void payWithWallet(order)}
                            loading={payBusy}
                            disabled={payBusy || tapBusy}
                          />
                          <CbcCardPayForm
                            amountNaira={order.totalNaira}
                            quote={funding?.cbc_quote}
                            busy={payBusy || tapBusy}
                            onPay={(details) => void payWithCbcCard(order, details)}
                            onPinFocus={revealPin}
                          />
                          <CbcTapPayPanel
                            orderId={order.id}
                            amountNaira={order.totalNaira}
                            disabled={payBusy || tapBusy}
                            onBusyChange={setTapBusy}
                            onPinFocus={() => revealPin()}
                            onRequestRead={requestCardRead}
                            pendingRead={pendingRead}
                            pendingError={pendingError}
                            onPaid={() => {
                              setOrderStatus((current) => ({ ...current, [order.id]: "paid" }));
                              Alert.alert(
                                t("listing.paySuccess"),
                                t("listing.paySuccessBody", { amount: formatNaira(order.totalNaira) })
                              );
                            }}
                          />
                        </>
                      )}
                    </View>
                  );
                })}
                <AppButton label={t("listing.done")} onPress={() => setSheet(false)} />
              </ScrollView>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetBody}
              >
                <Text style={styles.sheetTitle}>{cta}</Text>
                <Text style={styles.sheetLead}>
                  {isService
                    ? t("listing.paySellerBookIntro", { name: sellerName })
                    : t("listing.paySellerBuyIntro", { name: sellerName })}
                </Text>
                {formError ? <ErrorBanner message={formError} /> : null}
                <TextField label={t("listing.fullName")} value={fullName} onChangeText={setFullName} />
                <TextField
                  label={t("listing.phone")}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <TextField
                  label={t("listing.email")}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {isService ? (
                  <TextField
                    label={t("listing.preferredTime")}
                    value={preferredAt}
                    onChangeText={setPreferredAt}
                    placeholder={t("listing.preferredTimeHint")}
                  />
                ) : (
                  <>
                    <TextField label={t("listing.address")} value={address} onChangeText={setAddress} />
                    <TextField label={t("listing.city")} value={city} onChangeText={setCity} />
                    <TextField label={t("listing.state")} value={stateName} onChangeText={setStateName} />
                  </>
                )}
                {isService && String(listing?.service_location || "") === "client_site" ? (
                  <TextField
                    label={t("listing.serviceAddress")}
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t("listing.serviceAddressHint")}
                  />
                ) : null}
                <TextField
                  label={t("listing.notes")}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder={t("listing.notesHint")}
                />
                <AppButton
                  label={saving ? t("listing.sending") : `${cta} · ${formatNaira(total)}`}
                  onPress={() => void submit()}
                  loading={saving}
                  disabled={saving}
                />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal> : null}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={styles.backText}>{t("common.back")}</Text>
          </Pressable>
        </FadeIn>

        {error ? <ErrorBanner message={error} /> : null}

        {listing ? (
          <>
            <FadeIn delay={40}>
              {images.length ? (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
                  {images.map((uri, index) => (
                    <Pressable
                      key={uri}
                      onPress={() => setViewerIndex(index)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={t("listing.openPhoto")}
                    >
                      <Image source={{ uri }} style={styles.hero} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons name={isService ? "calendar-outline" : "cube-outline"} size={36} color={colors.textMuted} />
                </View>
              )}
            </FadeIn>

            <FadeIn delay={80}>
              <View style={styles.kindRow}>
                <View style={styles.kindPill}>
                  <Text style={styles.kindText}>
                    {isService ? t("listing.shopKindService") : t("listing.shopKindGoods")}
                  </Text>
                </View>
                {listing.category ? <Text style={styles.category}>{listing.category}</Text> : null}
              </View>
              <Text style={styles.title}>{listing.title}</Text>
              <Text style={styles.price}>
                {formatNaira(listing.price)}
                {listing.unit ? ` · ${listing.unit}` : ""}
              </Text>
              {listing.description ? <Text selectable style={styles.body}>{listing.description}</Text> : null}
            </FadeIn>

            <FadeIn delay={110}>
              <View style={styles.facts}>
                {isService && listing.duration_note ? (
                  <Fact
                    label={t("listing.shopDuration")}
                    value={formatDurationNote(listing.duration_note, listing.unit)}
                    styles={styles}
                  />
                ) : null}
                {isService && (listing.service_area || listing.service_location) ? (
                  <Fact
                    label={t("listing.where")}
                    value={listing.service_area || placeLabel(listing.service_location)}
                    styles={styles}
                  />
                ) : null}
                {listing.availability_note ? (
                  <Fact label={t("listing.availability")} value={listing.availability_note} styles={styles} />
                ) : null}
                {!isService && listing.quantity_tracked ? (
                  <Fact
                    label={t("listing.stockLabel")}
                    value={
                      listing.is_sold_out
                        ? t("listing.soldOut")
                        : t("business.stock", { count: listing.stock ?? 0 })
                    }
                    styles={styles}
                  />
                ) : null}
              </View>
            </FadeIn>

            {listing.contact?.phone || listing.contact?.whatsapp ? (
              <FadeIn delay={130}>
                <View style={styles.contactRow}>
                  {listing.contact.phone ? (
                    <Pressable
                      onPress={() => void Linking.openURL(`tel:${listing.contact?.phone}`)}
                      style={styles.contactBtn}
                    >
                      <Ionicons name="call-outline" size={16} color={colors.text} />
                      <Text style={styles.contactText}>{t("business.profileCall")}</Text>
                    </Pressable>
                  ) : null}
                  {listing.contact.whatsapp ? (
                    <Pressable
                      onPress={() =>
                        void Linking.openURL(
                          `https://wa.me/${String(listing.contact?.whatsapp || "").replace(/[^\d]/g, "")}`
                        )
                      }
                      style={styles.contactBtn}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={colors.text} />
                      <Text style={styles.contactText}>WhatsApp</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => void shareListing()} style={styles.contactBtn}>
                    <Ionicons name="share-outline" size={16} color={colors.text} />
                    <Text style={styles.contactText}>{t("business.profileShare")}</Text>
                  </Pressable>
                </View>
              </FadeIn>
            ) : null}

            {!owner ? (
              <FadeIn delay={140}>
                <Pressable
                  onPress={() => setReportOpen(true)}
                  style={[styles.contactBtn, { marginTop: 12, alignSelf: "flex-start" }]}
                  accessibilityRole="button"
                  accessibilityLabel={t("listing.report")}
                >
                  <Ionicons name="flag-outline" size={16} color={colors.error} />
                  <Text style={[styles.contactText, { color: colors.error }]}>{t("listing.report")}</Text>
                </Pressable>
              </FadeIn>
            ) : null}

            {!owner ? (
              <FadeIn delay={160}>
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>{qtyLabel}</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => setQty((value) => Math.max(1, value - 1))}
                      style={styles.step}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qtyValue}>{qty}</Text>
                    <Pressable
                      onPress={() => setQty((value) => Math.min(maxQty, value + 1))}
                      style={styles.step}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.total}>
                  {t("listing.total")}: {formatNaira(total)}
                </Text>
                <View style={styles.payRow}>
                  <AppButton
                    style={styles.payHalf}
                    label={
                      !isService &&
                      (listing.is_sold_out || (listing.quantity_tracked && (listing.stock ?? 0) <= 0))
                        ? t("listing.soldOut")
                        : unavailable
                          ? t("listing.unavailable")
                          : cta
                    }
                    onPress={openCheckout}
                    disabled={saving || readerAway}
                  />
                  <AppButton
                    style={styles.payHalf}
                    label="Tap to pay"
                    onPress={() => void tapFromListing()}
                    loading={saving || readerAway}
                    disabled={unavailable || saving || readerAway}
                  />
                </View>
              </FadeIn>
            ) : (
              <FadeIn delay={160}>
                <View style={styles.ownerNote}>
                  <Text style={styles.ownerText}>{t("listing.ownListing")}</Text>
                </View>
              </FadeIn>
            )}
          </>
        ) : null}
      </ScrollView>
      {viewerIndex !== null ? <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewer}>
          {viewerIndex !== null && images[viewerIndex] ? (
            <Image
              source={{ uri: images[viewerIndex] }}
              style={{ width: screenW, height: screenH }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setViewerIndex(null)}
            style={styles.viewerClose}
            accessibilityRole="button"
            accessibilityLabel={t("listing.closeViewer")}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {viewerIndex !== null && images.length > 1 ? (
            <>
              <Pressable
                onPress={() =>
                  setViewerIndex((index) =>
                    index === null ? 0 : (index + images.length - 1) % images.length
                  )
                }
                style={[styles.viewerNav, styles.viewerNavLeft]}
                accessibilityRole="button"
                accessibilityLabel={t("listing.prevPhoto")}
              >
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() =>
                  setViewerIndex((index) =>
                    index === null ? 0 : (index + 1) % images.length
                  )
                }
                style={[styles.viewerNav, styles.viewerNavRight]}
                accessibilityRole="button"
                accessibilityLabel={t("listing.nextPhoto")}
              >
                <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.viewerCount}>
                {t("listing.photoOf", { n: viewerIndex + 1, total: images.length })}
              </Text>
            </>
          ) : null}
        </View>
      </Modal> : null}
      {reportOpen ? <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="listing"
        contentId={listing?.id || listingId}
        reportedUserId={Number(listing?.seller_user_id) || null}
      /> : null}
    </FeedShell>
  );
}

function Fact({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
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
      paddingBottom: TAB_BAR_SPACE + 24,
    },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
      marginBottom: 12,
    },
    backText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.text,
    },
    gallery: {
      marginBottom: 16,
    },
    hero: {
      width: 320,
      height: 220,
      borderRadius: 18,
      marginRight: 10,
      backgroundColor: colors.sheet,
    },
    heroFallback: {
      height: 180,
      borderRadius: 18,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    kindRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    kindPill: {
      backgroundColor: colors.navActive,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    kindText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.primary,
    },
    category: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 24,
      color: colors.text,
    },
    price: {
      marginTop: 6,
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.primary,
    },
    body: {
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    facts: {
      marginTop: 16,
      gap: 10,
    },
    fact: {
      backgroundColor: colors.sheet,
      borderRadius: 14,
      padding: 12,
    },
    factLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    factValue: {
      marginTop: 4,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.text,
    },
    contactRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 16,
    },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    contactText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.text,
    },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    payHalf: {
      flex: 1,
    },
    qtyRow: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    qtyLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    step: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyValue: {
      minWidth: 24,
      textAlign: "center",
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    total: {
      marginTop: 10,
      marginBottom: 14,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textMuted,
    },
    ownerNote: {
      marginTop: 22,
      backgroundColor: colors.sheet,
      borderRadius: 16,
      padding: 14,
    },
    ownerText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    sheetOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      elevation: 40,
    },
    sheetOverlayHidden: {
      opacity: 0,
    },
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetDim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    sheet: {
      zIndex: 2,
      elevation: 8,
      maxHeight: "88%",
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 16,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    sheetBody: {
      paddingHorizontal: 16,
      paddingBottom: 28,
    },
    sheetTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
      marginBottom: 6,
    },
    sheetLead: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
      marginBottom: 14,
    },
    bankCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      gap: 10,
    },
    bankKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
    },
    bankLine: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.text,
    },
    bankAccount: {
      marginVertical: 4,
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    methodBtn: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    methodBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.text,
    },
    payTo: {
      marginTop: 16,
      marginBottom: 6,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    payNote: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    proofPreview: {
      marginTop: 12,
      height: 140,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    viewer: {
      flex: 1,
      backgroundColor: "#000000",
      alignItems: "center",
      justifyContent: "center",
    },
    viewerClose: {
      position: "absolute",
      top: Platform.OS === "ios" ? 54 : 24,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    viewerNav: {
      position: "absolute",
      top: "50%",
      marginTop: -22,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    viewerNavLeft: {
      left: 12,
    },
    viewerNavRight: {
      right: 12,
    },
    viewerCount: {
      position: "absolute",
      bottom: 36,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: "#FFFFFF",
    },
  });
}
