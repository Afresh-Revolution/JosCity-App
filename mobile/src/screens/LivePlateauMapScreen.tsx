import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
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
import { placeUrl, usePlateauMap } from "../state/usePlateauMap";
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
  const mapOffset = useRef(0);

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
          m.setNotice("You can browse the map without location access.");
        }
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      m.locate({ lat: result.coords.latitude, lng: result.coords.longitude });
    } catch {
      m.setError("Could not find your location. Check device location services and try again.");
    } finally {
      setLocating(false);
    }
  };

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
          m.setError("Location permission is needed to share your agent location.");
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
              m.setError(e.message);
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
        m.setError("Location sharing could not start.");
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
        nestedScrollEnabled
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
                style={styles.searchInput}
              />
            </View>
          ) : null}
          {m.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {m.error}
            </Text>
          ) : null}
          {m.notice ? <Text style={styles.notice}>{m.notice}</Text> : null}
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
                    void m.run(
                      () =>
                        api.jobLocations(job.job_id, {
                          [mode === "agent" ? "pickup" : "destination"]: { ...m.selection, address },
                        }),
                      "Job location saved."
                    )
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
                ? `Publish a named pin for ₦${m.config.listing_price.toLocaleString("en-NG")}, paid from your wallet.`
                : "Map listing payments have not been enabled yet."}
            </Text>
            <Pressable
              disabled={!m.selection || m.busy}
              onPress={() => void m.run(() => api.createPin(m.selection!), "Position saved. Name and pay below to publish.")}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Save selected position</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Business location name"
              placeholder="Business location name"
              value={label}
              onChangeText={setLabel}
              placeholderTextColor={colors.textMuted}
              style={styles.field}
            />
            {m.mine.map((pin) => (
              <View key={String(pin.id)} style={{ gap: 8 }}>
                <Text style={styles.body}>
                  {pin.label || "Unnamed location"} · {pin.payment_status}
                </Text>
                {pin.payment_status !== "paid" ? (
                  <Pressable
                    disabled={!m.config.listing_price || !label.trim() || m.busy}
                    onPress={() =>
                      Alert.alert(
                        "Publish location?",
                        `Charge ₦${m.config.listing_price} from your wallet for “${label.trim()}”?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Pay and publish",
                            onPress: () =>
                              void m.run(
                                () => api.payPin(pin.id, label, m.config.listing_price!),
                                "Your business pin is published."
                              ),
                          },
                        ]
                      )
                    }
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryBtnText}>Pay and publish</Text>
                  </Pressable>
                ) : null}
              </View>
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
