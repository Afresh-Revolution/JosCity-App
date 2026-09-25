import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  findNodeHandle,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PlateauMapView from "../components/PlateauMapView";
import FadeIn from "../components/FadeIn";
import { useTheme } from "../theme/ThemeProvider";
import { requestMapLocationAccess } from "../location/permissions";
import { agentApi as api } from "../api/agent";
import { showNotice } from "../components/AppNotice";
import { placeUrl, usePlateauMap } from "../state/usePlateauMap";
import { useKeyboardOverlap } from "../hooks/useKeyboardOverlap";
import type { Palette } from "../theme/colors";

const LAYERS = ["Places", "Businesses", "Deliveries"] as const;

export default function LivePlateauMapScreen({
  mode = "personal",
}: {
  mode?: "personal" | "business" | "agent";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const m = usePlateauMap(mode);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const lastSent = useRef(0);
  const [focused, setFocused] = useState(true);
  const located = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const mapOffset = useRef(0);
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
        const limit = Dimensions.get("window").height - covered - 20;
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

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await requestMapLocationAccess(true);
      if (!permission?.granted) {
        if (permission && !permission.canAskAgain) {
          Alert.alert("Location access is off", "Enable location access in device settings.", [
            { text: "Cancel", style: "cancel" },
            { text: "Open settings", onPress: () => void Linking.openSettings() },
          ]);
        } else {
          showNotice({
            title: "Location stays off",
            message: "You can still browse the Plateau map. Turn location on if you want directions from where you are.",
            tone: "info",
          });
        }
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      m.locate({ lat: result.coords.latitude, lng: result.coords.longitude });
    } catch {
      showNotice({
        title: "Location not found",
        message: "Check that location services are on for this phone, then try the target button again.",
        tone: "error",
      });
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (m.error) {
      showNotice({
        title: "Map update failed",
        message: m.error,
        tone: "error",
      });
      m.setError("");
    } else if (m.notice) {
      showNotice({
        title: "Plateau map",
        message: m.notice,
        tone: "info",
      });
      m.setNotice("");
    }
  }, [m.error, m.notice, m.setError, m.setNotice]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (!located.current) {
        located.current = true;
        void locate();
      }
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (!focused || !m.sharing || !m.accepting || mode !== "agent") return;
    let watcher: Location.LocationSubscription | undefined;
    let disposed = false;
    let starting = false;
    let sending = false;
    const stop = () => {
      watcher?.remove();
      watcher = undefined;
    };
    const start = async () => {
      if (watcher || starting || AppState.currentState !== "active") return;
      starting = true;
      try {
        const permission = await requestMapLocationAccess(true);
        if (!permission?.granted) {
          m.setSharing(false);
          showNotice({
            title: "Location permission needed",
            message: "Allow location access so customers can see you while you are accepting requests.",
            tone: "error",
          });
          return;
        }
        if (disposed || AppState.currentState !== "active") return;
        const send = (lat: number, lng: number) => {
          if (disposed || AppState.currentState !== "active" || sending || Date.now() - lastSent.current < 30000) return;
          lastSent.current = Date.now();
          sending = true;
          void api
            .liveLocation({ lat, lng })
            .catch((e) => {
              showNotice({
                title: "Location sharing stopped",
                message: e instanceof Error ? e.message : "Your live position could not be sent. Sharing is off.",
                tone: "error",
              });
              m.setSharing(false);
            })
            .finally(() => {
              sending = false;
            });
        };
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          send(current.coords.latitude, current.coords.longitude);
        } catch {
          /* watch below still starts */
        }
        if (disposed || AppState.currentState !== "active") return;
        const next = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 100 },
          (position) => send(position.coords.latitude, position.coords.longitude)
        );
        if (disposed || AppState.currentState !== "active") next.remove();
        else watcher = next;
      } catch {
        m.setSharing(false);
        showNotice({
          title: "Sharing did not start",
          message: "Your live position could not be shared. Check location access and try the switch again.",
          tone: "error",
        });
      } finally {
        starting = false;
      }
    };
    void start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void start();
      else stop();
    });
    return () => {
      disposed = true;
      stop();
      subscription.remove();
    };
  }, [focused, m.sharing, m.accepting, mode]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((mode === "business" ? "/business" : mode === "agent" ? "/agents" : "/home") as never);
  };

  return (
    <FeedShell
      tab={mode === "business" ? "overview" : "explore"}
      header={
        <View style={styles.header}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Plateau map</Text>
        </View>
      }
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        nestedScrollEnabled
        style={styles.scroll}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_SPACE + 28 + keyboard.overlap },
        ]}
      >
        <FadeIn style={styles.topBlock}>
          <Text style={styles.intro}>Find places, businesses, and delivery pins across Jos and Plateau.</Text>
          <View style={styles.layers}>
            {LAYERS.map((layer) => {
              const on = m.layer === layer;
              return (
                <Pressable
                  key={layer}
                  onPress={() => m.setLayer(layer)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.layerChip, on && styles.layerChipOn]}
                >
                  <Text style={[styles.layerText, on && styles.layerTextOn]}>{layer}</Text>
                </Pressable>
              );
            })}
          </View>
          {m.layer !== "Deliveries" ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Search Plateau places"
                placeholder={m.layer === "Places" ? "Search a place, e.g. Tasty Fingers" : "Search businesses"}
                placeholderTextColor={colors.textMuted}
                value={m.query}
                onChangeText={m.setQuery}
                returnKeyType="search"
                onSubmitEditing={m.searchNow}
                onFocus={revealInput}
                style={styles.searchInput}
              />
            </View>
          ) : null}
        </FadeIn>

        <View
          style={styles.mapWrap}
          onLayout={(event) => {
            mapOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <PlateauMapView
            pins={m.pins}
            point={m.point}
            me={m.me}
            selection={m.selection}
            route={m.route}
            bounds={m.config.bounds}
            onSelect={m.select}
          />
          <Pressable
            onPress={() => void locate()}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="My location"
            style={({ pressed }) => [styles.locateFab, pressed && styles.pressed]}
          >
            {locating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="locate" size={20} color={colors.white} />
            )}
          </Pressable>
        </View>

        {m.destination && m.layer === "Places" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{m.destination.label}</Text>
            {m.destination.address ? <Text style={styles.body}>{m.destination.address}</Text> : null}
            {m.routing ? <Text style={styles.meta}>Getting the driving route from your location…</Text> : null}
            {!m.routing && m.route ? (
              <Text style={styles.body}>
                {m.route.durationText || "Route ready"}
                {m.route.distanceText ? ` · ${m.route.distanceText}` : ""} from your location.
              </Text>
            ) : null}
            {!m.me ? <Text style={styles.meta}>Turn on location to draw the route from where you are.</Text> : null}
          </View>
        ) : null}

        <Text style={styles.hint}>Tap the map to drop a pin. You can browse without sharing your location.</Text>
        {m.selection ? (
          <Text selectable style={styles.meta}>
            Selected {m.selection.lat.toFixed(5)}, {m.selection.lng.toFixed(5)}
          </Text>
        ) : null}

        {mode === "agent" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Share my location</Text>
            <Text style={styles.body}>Share your position for nearby matching while this map is open.</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{m.sharing ? "Sharing is on" : "Sharing is off"}</Text>
              <Switch accessibilityLabel="Share agent location" value={m.sharing} onValueChange={(on) => void m.setSharing(on)} />
            </View>
          </View>
        ) : null}

        {m.loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
        {!m.loading && !m.pins.length && !m.error ? (
          <Text style={styles.meta}>
            {m.layer === "Places" ? "Type at least two letters to search places." : "No pins in this layer yet."}
          </Text>
        ) : null}

        {m.pins.map((pin) => (
          <View key={String(pin.id)} style={styles.card}>
            <Text style={styles.cardTitle}>{pin.label}</Text>
            {pin.address ? <Text style={styles.body}>{pin.address}</Text> : null}
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => void Linking.openURL(placeUrl(pin))}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>Show on map</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  m.select(pin);
                  if (pin.address) setAddress(pin.address);
                  scrollRef.current?.scrollTo({ y: Math.max(0, mapOffset.current - 8), animated: true });
                  if (!m.me) void locate();
                }}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>Directions</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {m.layer === "Deliveries" ? (
          <View style={styles.section}>
            <Text style={styles.meta}>Only your active jobs appear here. Customer addresses stay private.</Text>
            <TextInput
              accessibilityLabel="Address for selected position"
              placeholder="Address for the selected pin"
              value={address}
              onChangeText={setAddress}
              onFocus={revealInput}
              placeholderTextColor={colors.textMuted}
              style={styles.field}
            />
            {m.jobs.map((job) => (
              <View key={job.job_id} style={styles.card}>
                <Text style={styles.cardTitle}>Job #{job.job_id}</Text>
                <Text style={styles.body}>Pickup: {job.pickup_address || "Not set"}</Text>
                <Text style={styles.body}>Delivery: {job.destination_address || "Not set"}</Text>
                <Pressable
                  disabled={!m.selection || !address.trim() || m.busy}
                  onPress={() =>
                    void m.run(async () => {
                      const kind = mode === "agent" ? "pickup" : "destination";
                      await api.jobLocations(job.job_id, {
                        [kind]: { ...m.selection, address },
                      });
                      showNotice({
                        title: kind === "pickup" ? "Pickup saved" : "Delivery saved",
                        message: `Job #${job.job_id} now uses “${address.trim()}” at ${m.selection!.lat.toFixed(5)}, ${m.selection!.lng.toFixed(5)}.`,
                        tone: "success",
                      });
                    }, "")
                  }
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryBtnText}>
                    {mode === "agent" ? "Set pickup here" : "Set delivery here"}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {mode === "business" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add to map</Text>
            <Text style={styles.body}>
              {m.config.listing_price
                ? `A named pin costs ₦${m.config.listing_price.toLocaleString("en-NG")} from your wallet. It stays off the map until you pay.`
                : "Map listing payments have not been enabled yet."}
            </Text>
            <Pressable
              disabled={!m.selection || m.busy}
              onPress={() => {
                const price = m.config.listing_price;
                const where = `${m.selection!.lat.toFixed(5)}, ${m.selection!.lng.toFixed(5)}`;
                showNotice({
                  title: price ? "Payment required" : "Payments are off",
                  message: price
                    ? `Selected ${where}. This position is not saved on the map until you pay ₦${price.toLocaleString("en-NG")} from your wallet. Enter a location name, then tap Pay and publish.`
                    : "Map listing payments have not been enabled yet, so this position cannot be published.",
                  tone: price ? "info" : "error",
                });
              }}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Save selected position</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Business location name"
              placeholder="Business location name"
              value={label}
              onChangeText={setLabel}
              onFocus={revealInput}
              placeholderTextColor={colors.textMuted}
              style={styles.field}
            />
            <Pressable
              disabled={!m.selection || !m.config.listing_price || !label.trim() || m.busy}
              onPress={() =>
                Alert.alert(
                  "Publish location?",
                  `Charge ₦${m.config.listing_price} from your wallet for “${label.trim()}”? It is not on the map until this payment succeeds.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Pay and publish",
                      onPress: () =>
                        void m.run(async () => {
                          const name = label.trim();
                          await api.publishPin(m.selection!, name, m.config.listing_price!);
                          showNotice({
                            title: "Pin published",
                            message: `${name} is now on the Plateau map at ${m.selection!.lat.toFixed(5)}, ${m.selection!.lng.toFixed(5)}. ₦${m.config.listing_price!.toLocaleString("en-NG")} was charged from your wallet.`,
                            tone: "success",
                          });
                        }, ""),
                    },
                  ]
                )
              }
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Pay and publish</Text>
            </Pressable>
            {m.mine
              .filter((pin) => pin.payment_status === "paid")
              .map((pin) => (
                <Text key={String(pin.id)} style={styles.body}>
                  {pin.label || "Location"} · on the map
                </Text>
              ))}
            <Pressable
              onPress={() => router.push("/business/wallet" as never)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Wallet / top up</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingBottom: 10,
      gap: 4,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 2,
    },
    backText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.text,
    },
    headerTitle: {
      flex: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: TAB_BAR_SPACE + 28,
      gap: 16,
    },
    topBlock: {
      gap: 16,
    },
    section: {
      gap: 16,
    },
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    layers: {
      flexDirection: "row",
      gap: 10,
    },
    layerChip: {
      flex: 1,
      minHeight: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    layerChipOn: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    layerText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    layerTextOn: {
      color: colors.white,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 2,
    },
    searchInput: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      paddingVertical: 12,
    },
    error: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.error,
    },
    notice: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.text,
    },
    mapWrap: {
      borderRadius: 18,
      overflow: "hidden",
      marginTop: 4,
    },
    locateFab: {
      position: "absolute",
      right: 12,
      bottom: 12,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 4,
    },
    hint: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    meta: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
    },
    cardTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    body: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    rowActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    primaryBtn: {
      marginTop: 4,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    primaryBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.white,
    },
    secondaryBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    secondaryBtnText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    field: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    switchLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
