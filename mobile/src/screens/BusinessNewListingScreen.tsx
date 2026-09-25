import { useMemo, useState } from "react";
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
import JosCityLoader from "../components/JosCityLoader";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import FadeIn from "../components/FadeIn";
import { ErrorBanner } from "../components/AppNotice";
import TextField from "../components/TextField";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { createListing, uploadListingMedia, type ListingMediaItem } from "../api/marketplace";
import {
  LISTING_CATEGORIES,
  type ListingKind,
} from "../constants/listingCategories";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const MAX_PHOTOS = 6;

export default function BusinessNewListingScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ListingKind>("goods");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [duration, setDuration] = useState("");
  const [servicePlace, setServicePlace] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [availability, setAvailability] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<ListingMediaItem[]>([]);
  const [picker, setPicker] = useState<null | "category">(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = uploading || Boolean(saving);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/business");
  };

  const pickPhotos = async () => {
    const room = MAX_PHOTOS - media.length;
    if (room <= 0) {
      Alert.alert(t("listing.maxPhotos"));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("listing.permissionTitle"), t("listing.permissionLibrary"));
      return;
    }
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });
    } catch {
      try {
        picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      } catch {
        setError(t("listing.uploadFailed"));
        return;
      }
    }
    if (picked.canceled || !picked.assets?.length) return;

    setUploading(true);
    setError(null);
    const next: ListingMediaItem[] = [];
    for (const asset of picked.assets.slice(0, room)) {
      const result = await uploadListingMedia({
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
      });
      if (!result.success || !result.data) {
        setError(result.message || t("listing.uploadFailed"));
        break;
      }
      next.push(result.data);
    }
    if (next.length) setMedia((current) => [...current, ...next].slice(0, MAX_PHOTOS));
    setUploading(false);
  };

  const removePhoto = (index: number) => {
    setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const isService = kind === "service";

  const validate = (status: "draft" | "published"): string | null => {
    const name = title.trim();
    if (!name) return t("listing.nameRequired");
    if (status === "draft") return null;
    const priceValue = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(priceValue) || priceValue < 0) return t("listing.priceRequired");
    if (!isService) {
      const stockValue = Number(stock);
      if (!Number.isFinite(stockValue) || stockValue < 1) return t("listing.stockRequired");
    }
    if (!category) return t("listing.categoryRequired");
    if (!description.trim()) {
      return isService ? t("listing.descriptionRequiredService") : t("listing.descriptionRequired");
    }
    if (!isService && !media.some((item) => item.type !== "video" && item.url)) {
      return t("listing.photoRequired");
    }
    return null;
  };

  const save = async (status: "draft" | "published") => {
    if (busy) return;
    const message = validate(status);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSaving(status);
    const priceValue = Number(price.replace(/,/g, ""));
    const stockValue = Number(stock);
    const hasStock = !isService && stock.trim() !== "" && Number.isFinite(stockValue);
    const result = await createListing({
      title: title.trim(),
      description: description.trim(),
      category,
      listingKind: kind,
      priceNaira: Number.isFinite(priceValue) ? priceValue : undefined,
      stockQuantity: hasStock ? stockValue : null,
      quantityTracked: hasStock,
      unit: unit.trim() || null,
      durationNote: isService ? duration.trim() || null : null,
      serviceLocation: isService ? servicePlace.trim() || null : null,
      serviceArea: isService ? serviceArea.trim() || null : null,
      availabilityNote: isService ? availability.trim() || null : null,
      media,
      status,
    });
    setSaving(null);
    if (!result.success) {
      setError(result.message || t("listing.saveFailed"));
      return;
    }
    router.replace("/business/catalog");
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab="profile" header={<View />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn>
            <Pressable onPress={goBack} style={styles.back} accessibilityRole="button">
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.kicker}>{t("listing.kicker")}</Text>
            <Text style={styles.title}>{t("listing.title")}</Text>
          </FadeIn>

          <FadeIn delay={80}>
            {media.length > 0 ? (
              <View style={styles.photos}>
                {media.map((item, index) => (
                  <View key={`${item.url}-${index}`} style={styles.thumbWrap}>
                    <Image source={{ uri: item.url }} style={styles.thumb} />
                    <Pressable
                      onPress={() => removePhoto(index)}
                      style={styles.thumbRemove}
                      accessibilityRole="button"
                      accessibilityLabel={t("listing.removePhoto")}
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {media.length < MAX_PHOTOS ? (
                  <Pressable
                    onPress={() => void pickPhotos()}
                    disabled={busy}
                    style={styles.thumbAdd}
                  >
                    {uploading ? (
                      <JosCityLoader color={colors.primary} />
                    ) : (
                      <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => void pickPhotos()}
                disabled={busy}
                style={styles.dropzone}
              >
                {uploading ? (
                  <JosCityLoader color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.dropTitle}>{t("listing.addPhotos")}</Text>
                    <Text style={styles.dropHint}>
                      {isService ? t("listing.photoHintService") : t("listing.photoHint")}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </FadeIn>

          <FadeIn delay={140}>
            <Text style={styles.fieldLabel}>{t("listing.kind")}</Text>
            <View style={styles.kindRow}>
              {(["goods", "service"] as ListingKind[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setKind(item);
                    setUnit("");
                    if (item === "service") setStock("");
                  }}
                  style={[styles.kindChip, kind === item && styles.kindChipOn]}
                >
                  <Text style={[styles.kindChipText, kind === item && styles.kindChipTextOn]}>
                    {item === "service" ? t("listing.kindService") : t("listing.kindGoods")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label={t("listing.name")}
              value={title}
              onChangeText={setTitle}
              placeholder={
                isService ? t("listing.namePlaceholderService") : t("listing.namePlaceholder")
              }
              autoCapitalize="sentences"
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <TextField
                  label={isService ? t("listing.priceService") : t("listing.price")}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="38000"
                  keyboardType="numeric"
                />
              </View>
              {isService ? (
                <View style={styles.half}>
                  <TextField
                    label={t("listing.pricedAs")}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder={t("listing.pricedAsPlaceholder")}
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={styles.half}>
                  <TextField
                    label={t("listing.stock")}
                    value={stock}
                    onChangeText={setStock}
                    placeholder="24"
                    keyboardType="number-pad"
                  />
                </View>
              )}
            </View>
            {isService ? (
              <>
                <TextField
                  label={t("listing.duration")}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder={t("listing.durationPlaceholder")}
                  autoCapitalize="sentences"
                />
                <TextField
                  label={t("listing.where")}
                  value={servicePlace}
                  onChangeText={setServicePlace}
                  placeholder={t("listing.wherePlaceholder")}
                  autoCapitalize="sentences"
                />
                <TextField
                  label={t("listing.serviceArea")}
                  value={serviceArea}
                  onChangeText={setServiceArea}
                  placeholder={t("listing.serviceAreaPlaceholder")}
                  autoCapitalize="sentences"
                />
                <TextField
                  label={t("listing.availability")}
                  value={availability}
                  onChangeText={setAvailability}
                  placeholder={t("listing.availabilityPlaceholder")}
                  autoCapitalize="sentences"
                />
              </>
            ) : (
              <TextField
                label={t("listing.unit")}
                value={unit}
                onChangeText={setUnit}
                placeholder={t("listing.unitPlaceholder")}
                autoCapitalize="none"
              />
            )}
            <Text style={styles.fieldLabel}>{t("listing.category")}</Text>
            <Pressable onPress={() => setPicker("category")} style={styles.select}>
              <Text style={[styles.selectValue, !category && styles.selectPlaceholder]}>
                {category || t("listing.categoryPlaceholder")}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
            <TextField
              label={t("listing.description")}
              value={description}
              onChangeText={setDescription}
              placeholder={
                isService
                  ? t("listing.descriptionPlaceholderService")
                  : t("listing.descriptionPlaceholder")
              }
              multiline
              style={{ minHeight: 110 }}
            />
            {error ? <ErrorBanner message={error} /> : null}
            <Pressable
              onPress={() => void save("published")}
              disabled={busy}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              {saving === "published" ? (
                <JosCityLoader color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>{t("listing.publish")}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void save("draft")}
              disabled={busy}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              {saving === "draft" ? (
                <JosCityLoader color={colors.primary} />
              ) : (
                <Text style={styles.secondaryText}>{t("listing.draft")}</Text>
              )}
            </Pressable>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={picker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.dim} onPress={() => setPicker(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("listing.category")}</Text>
            <ScrollView style={styles.sheetList}>
              {LISTING_CATEGORIES.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setCategory(item);
                        setPicker(null);
                      }}
                      style={styles.sheetRow}
                    >
                      <Text style={styles.sheetLabel}>{item}</Text>
                      {category === item ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
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
      width: 32,
      height: 32,
      alignItems: "flex-start",
      justifyContent: "center",
      marginBottom: 8,
      marginTop: 4,
    },
    kicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 4,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 32,
      color: colors.text,
      marginBottom: 18,
    },
    dropzone: {
      minHeight: 148,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      marginBottom: 18,
      gap: 8,
    },
    dropTitle: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    dropHint: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
      textAlign: "center",
    },
    photos: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 18,
    },
    thumbWrap: {
      width: 88,
      height: 88,
    },
    thumb: {
      width: 88,
      height: 88,
      borderRadius: 14,
      backgroundColor: colors.sheet,
    },
    thumbRemove: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbAdd: {
      width: 88,
      height: 88,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    half: {
      flex: 1,
    },
    fieldLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    kindRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    kindChip: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      alignItems: "center",
      justifyContent: "center",
    },
    kindChipOn: {
      borderColor: colors.brand,
      backgroundColor: colors.card,
    },
    kindChipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textMuted,
    },
    kindChipTextOn: {
      color: colors.text,
    },
    select: {
      minHeight: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    selectValue: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    selectPlaceholder: {
      color: colors.textMuted,
    },
    error: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.error,
      marginBottom: 12,
    },
    primary: {
      minHeight: 54,
      borderRadius: 28,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    primaryText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    secondary: {
      minHeight: 54,
      borderRadius: 28,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.text,
    },
    pressed: {
      opacity: 0.88,
    },
    disabled: {
      opacity: 0.7,
    },
    dim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: "70%",
    },
    sheetTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
      marginBottom: 8,
    },
    sheetList: {
      maxHeight: 420,
    },
    sheetRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.text,
    },
  });
}
