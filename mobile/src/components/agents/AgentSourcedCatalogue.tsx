import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  agentApi,
  type CatalogueItem,
  type CatalogueSourceListing,
  type UploadImage,
} from "../../api/agent";
import AppButton from "../AppButton";
import JosCityLoader from "../JosCityLoader";
import TextField from "../TextField";
import AgentFeeBenefit from "./AgentFeeBenefit";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { formatNaira } from "../../utils/format";
import { formatFeePercent } from "../../utils/agentFee";
import { useQuoteFee } from "../../state/useQuoteFee";

const emptyDraft = {
  sourceKind: "joscity" as "joscity" | "external",
  title: "",
  description: "",
  sourceName: "",
  sourceUrl: "",
  productPrice: "",
  listingId: null as number | null,
};

export default function AgentSourcedCatalogue({
  agentName,
  agentUserId,
}: {
  agentName: string;
  agentUserId?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const publicView = Number(agentUserId || 0) > 0;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogueItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [photos, setPhotos] = useState<UploadImage[]>([]);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CatalogueSourceListing[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const quoteFee = useQuoteFee(editorOpen ? draft.productPrice : "");

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(
        publicView
          ? await agentApi.catalogue({ agentUserId, limit: 40 })
          : await agentApi.myCatalogue()
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your catalogue.");
    } finally {
      setLoading(false);
    }
  }, [agentUserId, publicView]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setPhotos([]);
    setSearch("");
    setHits([]);
    setEditorOpen(true);
  };

  const openEdit = (item: CatalogueItem) => {
    setEditing(item);
    setDraft({
      sourceKind: item.source_kind === "joscity" ? "joscity" : "external",
      title: item.title || "",
      description: item.description || "",
      sourceName: item.source_name || "",
      sourceUrl: item.source_url || "",
      productPrice: String(item.product_price ?? ""),
      listingId: item.listing_id || null,
    });
    setPhotos([]);
    setSearch(item.source_kind === "joscity" ? item.title || "" : "");
    setHits([]);
    setEditorOpen(true);
  };

  const searchListings = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void agentApi
        .sourceListings(value.trim())
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 280);
  };

  const pickListing = (hit: CatalogueSourceListing) => {
    setDraft((current) => ({
      ...current,
      sourceKind: "joscity",
      listingId: hit.listing_id,
      title: hit.title,
      description: hit.description || current.description,
      sourceName: hit.business_name,
      productPrice: String(hit.price || ""),
    }));
    setHits([]);
    setSearch(hit.title);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    const asset = picked.assets[0];
    setPhotos((current) => [
      ...current,
      { uri: asset.uri, name: asset.fileName || "product.jpg", type: asset.mimeType || "image/jpeg" },
    ]);
  };

  const save = async () => {
    const price = Number(String(draft.productPrice).replace(/,/g, ""));
    if (!draft.title.trim()) {
      Alert.alert("Add a product", "Enter the product name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert("Add a product", "Enter a valid product price.");
      return;
    }
    if (draft.sourceKind === "joscity" && !draft.listingId) {
      Alert.alert("JosCity listing", "Search and select a product from a JosCity business.");
      return;
    }
    if (draft.sourceKind === "external" && !draft.sourceName.trim()) {
      Alert.alert("External shop", "Name the shop or market this product comes from.");
      return;
    }
    setSaving(true);
    try {
      await agentApi.saveCatalogue(
        {
          title: draft.title.trim(),
          description: draft.description.trim(),
          productPrice: price,
          sourceKind: draft.sourceKind,
          listingId: draft.sourceKind === "joscity" ? draft.listingId : "",
          sourceName: draft.sourceName.trim(),
          sourceUrl: draft.sourceUrl.trim(),
        },
        photos,
        editing?.item_id
      );
      setEditorOpen(false);
      await load();
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: CatalogueItem) => {
    Alert.alert("Remove product", `Remove ${item.title} from your catalogue?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void agentApi
            .deleteCatalogue(item.item_id)
            .then(load)
            .catch((err) => Alert.alert("Could not remove", err instanceof Error ? err.message : "Try again."));
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Catalogue</Text>
          <Text style={styles.title}>{`Sourced by ${agentName}`}</Text>
        </View>
        {publicView ? null : (
          <Pressable
            onPress={openCreate}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Add sourced product"
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.copy}>
        {publicView
          ? "Products this agent can buy for you from JosCity businesses or an external shop."
          : "Products you can buy for customers from JosCity businesses or an external shop."}
      </Text>
      {loading ? (
        <JosCityLoader color={colors.primary} />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      ) : items.length === 0 ? (
        publicView ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bag-handle-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No sourced products yet</Text>
            <Text style={styles.copy}>This agent has not added catalogue items yet.</Text>
          </View>
        ) : (
        <Pressable onPress={openCreate} style={styles.empty} accessibilityRole="button" accessibilityLabel="Add your first product">
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No sourced products yet</Text>
          <Text style={styles.copy}>Add a JosCity listing or an item from Terminus, Farin Gada or another shop.</Text>
        </Pressable>
        )
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const image = item.images?.[0];
            const joscity = item.source_kind === "joscity";
            return (
              <Pressable
                key={item.item_id}
                onPress={() => {
                  if (publicView) {
                    router.push({
                      pathname: "/agent-services/request",
                      params: {
                        agent: String(agentUserId),
                        item: String(item.item_id),
                      },
                    } as never);
                    return;
                  }
                  openEdit(item);
                }}
                onLongPress={publicView ? undefined : () => remove(item)}
                style={styles.tile}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoFallback]}>
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.tileCopy}>
                  <View style={styles.chipRow}>
                    <View style={[styles.chip, joscity ? styles.chipJos : styles.chipExt]}>
                      <Text style={[styles.chipText, joscity ? styles.chipTextJos : styles.chipTextExt]}>
                        {joscity ? "JosCity" : "External"}
                      </Text>
                    </View>
                    {item.status === "inactive" ? (
                      <View style={styles.chipMuted}>
                        <Text style={styles.chipTextMuted}>Hidden</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {item.source_name || item.source_label || (joscity ? "JosCity business" : "External shop")}
                  </Text>
                  <Text style={styles.price}>{formatNaira(item.total_price)}</Text>
                  <Text style={styles.itemMeta}>
                    {formatNaira(item.product_price)} + {item.agent_fee_percent}% fee
                  </Text>
                </View>
                {publicView ? (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                ) : (
                <Pressable
                  onPress={() => remove(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.title}`}
                  style={styles.trash}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modal}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }}
          >
            <Text style={styles.modalKicker}>Catalogue</Text>
            <Text style={styles.modalTitle}>{editing ? "Edit product" : "Add a sourced product"}</Text>
            <Text style={[styles.copy, { marginBottom: 16 }]}>
              Choose a live JosCity listing or name the external shop you will buy from.
            </Text>
            <View style={styles.choiceRow}>
              {(["joscity", "external"] as const).map((kind) => {
                const on = draft.sourceKind === kind;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setDraft((current) => ({ ...current, sourceKind: kind, listingId: kind === "external" ? null : current.listingId }))}
                    style={[styles.choice, on && styles.choiceOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={kind === "joscity" ? "storefront-outline" : "globe-outline"} size={18} color={on ? colors.white : colors.text} />
                    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
                      {kind === "joscity" ? "JosCity business" : "External shop"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {draft.sourceKind === "joscity" ? (
              <>
                <TextField
                  label="Search JosCity listings"
                  value={search}
                  onChangeText={searchListings}
                  placeholder="Phone, shop, product"
                />
                {searching ? <JosCityLoader color={colors.primary} /> : null}
                {hits.map((hit) => (
                  <Pressable key={hit.listing_id} onPress={() => pickListing(hit)} style={styles.hit}>
                    {hit.image_url ? <Image source={{ uri: hit.image_url }} style={styles.hitPhoto} /> : <View style={styles.hitPhoto} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hitTitle}>{hit.title}</Text>
                      <Text style={styles.itemMeta}>{hit.business_name} · {formatNaira(hit.price)}</Text>
                    </View>
                  </Pressable>
                ))}
                {draft.listingId ? (
                  <View style={styles.selected}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.copy}>Linked to JosCity listing #{draft.listingId}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <TextField label="Shop or market" value={draft.sourceName} onChangeText={(sourceName) => setDraft({ ...draft, sourceName })} placeholder="Terminus, Farin Gada…" />
                <TextField label="Shop link (optional)" value={draft.sourceUrl} onChangeText={(sourceUrl) => setDraft({ ...draft, sourceUrl })} autoCapitalize="none" placeholder="https://" />
              </>
            )}

            <TextField label="Product name" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
            <TextField label="Description" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} multiline />
            <TextField label="Product price (NGN)" value={draft.productPrice} onChangeText={(productPrice) => setDraft({ ...draft, productPrice })} keyboardType="decimal-pad" />
            <TextField
              label="Agent fee (%)"
              value={quoteFee.fee ? formatFeePercent(quoteFee.fee.feePercent) : quoteFee.loading ? "…" : ""}
              editable={false}
            />
            <AgentFeeBenefit
              feeAmount={quoteFee.fee?.feeAmount}
              totalPrice={quoteFee.fee?.totalPrice}
              formatAmount={formatNaira}
            />
            {editing?.images?.length && !photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {editing.images.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.thumb} />
                ))}
              </ScrollView>
            ) : null}
            {photos.length ? <Text style={styles.copy}>{photos.length} new photo{photos.length === 1 ? "" : "s"} attached</Text> : null}
            <AppButton label="Add photos" variant="secondary" onPress={() => void pickPhoto()} />
            <AppButton label={saving ? "Saving…" : "Save product"} disabled={saving} loading={saving} onPress={() => void save()} />
            <AppButton label="Cancel" variant="secondary" onPress={() => setEditorOpen(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      gap: 14,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 12 },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: c.primary,
      textTransform: "uppercase",
    },
    title: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: c.text },
    copy: { fontFamily: "Montserrat_400Regular", fontSize: 13, lineHeight: 20, color: c.textMuted },
    error: { fontFamily: "Montserrat_500Medium", fontSize: 13, color: c.error },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: c.brand,
    },
    addBtnText: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: c.white },
    empty: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: 18,
      gap: 8,
      backgroundColor: c.sheet,
    },
    emptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.iconSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: c.text },
    list: { gap: 10 },
    tile: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.sheet,
      padding: 12,
      gap: 12,
    },
    photo: { width: 72, height: 72, borderRadius: 12, backgroundColor: c.iconSoft },
    photoFallback: { alignItems: "center", justifyContent: "center" },
    tileCopy: { flex: 1, gap: 2 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 2 },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    chipJos: { backgroundColor: c.navActive },
    chipExt: { backgroundColor: c.iconSoft },
    chipMuted: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c.card,
    },
    chipText: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, textTransform: "uppercase" },
    chipTextJos: { color: c.primary },
    chipTextExt: { color: c.text },
    chipTextMuted: { fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: c.textMuted, textTransform: "uppercase" },
    itemTitle: { fontFamily: "Montserrat_700Bold", fontSize: 15, color: c.text },
    itemMeta: { fontFamily: "Montserrat_400Regular", fontSize: 12, color: c.textMuted },
    price: { fontFamily: "Montserrat_700Bold", fontSize: 14, color: c.primary, marginTop: 2 },
    trash: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    modal: { flex: 1, backgroundColor: c.background },
    modalKicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: c.primary,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    modalTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, color: c.text, marginBottom: 8 },
    choiceRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
    choice: {
      flex: 1,
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      gap: 6,
    },
    choiceOn: { backgroundColor: c.brand, borderColor: c.brand },
    choiceText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: c.text, textAlign: "center" },
    choiceTextOn: { color: c.white },
    hit: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      marginBottom: 8,
    },
    hitPhoto: { width: 48, height: 48, borderRadius: 10, backgroundColor: c.iconSoft },
    hitTitle: { fontFamily: "Montserrat_700Bold", fontSize: 13, color: c.text },
    selected: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    thumbs: { gap: 8, paddingBottom: 8 },
    thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.iconSoft },
  });
}
