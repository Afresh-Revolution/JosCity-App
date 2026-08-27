import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import TextField from "../components/TextField";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import { friendlyError } from "../utils/errors";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getUserProfile, updatePersonalProfile, uploadCoverPicture, uploadProfilePicture } from "../api/auth";
import { getCacEditState, type CacEditState } from "../api/cacEdit";
import CacEditPaySheet from "../components/CacEditPaySheet";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import {
  getUser,
  isBusinessAccountType,
  setUser,
  type StoredUser,
} from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, formatNaira } from "../utils/format";

type ProfileUser = StoredUser & {
  user_phone?: string;
  user_email?: string;
  address?: string;
  user_bio?: string | null;
  business_phone?: string;
  business_location?: string;
  business_email?: string;
  business_description?: string | null;
  CAC_number?: string | null;
  cac_number?: string | null;
  cac_verified?: boolean | null;
  cac_edit?: CacEditState | null;
  nin_number?: string | null;
  nin_verified?: boolean | null;
  user_cover?: string | null;
};

function aboutFrom(user: ProfileUser | null): string {
  return String(user?.business_description || user?.user_bio || "").trim();
}

function cacFrom(user: ProfileUser | null): string {
  return String(user?.CAC_number || user?.cac_number || "")
    .trim()
    .toUpperCase();
}

function ninFrom(user: ProfileUser | null): string {
  return String(user?.nin_number || "").replace(/\D/g, "");
}

function fullNameFrom(user: ProfileUser | null): string {
  const business = String(user?.business_name || "").trim();
  if (isBusinessAccountType(String(user?.account_type)) && business) return business;
  return (
    [user?.user_firstname || user?.first_name, user?.user_lastname || user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user?.display_name ||
    business ||
    ""
  );
}

function phoneFrom(user: ProfileUser | null): string {
  return String(user?.business_phone || user?.user_phone || "").trim();
}

function addressFrom(user: ProfileUser | null): string {
  return String(user?.business_location || user?.address || "").trim();
}

function emailFrom(user: ProfileUser | null): string {
  return String(user?.business_email || user?.user_email || user?.email || "").trim();
}

function splitFullName(value: string, fallbackLast: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: fallbackLast };
  if (parts.length === 1) return { first: parts[0], last: fallbackLast };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function FieldIcon({
  name,
}: {
  name:
    | "person-outline"
    | "mail-outline"
    | "call-outline"
    | "location-outline"
    | "create-outline"
    | "lock-closed-outline"
    | "ribbon-outline"
    | "card-outline";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return <Ionicons name={name} size={18} color={colors.textMuted} />;
}

export default function PersonalDetailsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalLastName, setOriginalLastName] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [cac, setCac] = useState("");
  const [cacLocked, setCacLocked] = useState(false);
  const [cacVerified, setCacVerified] = useState(false);
  const [cacEdit, setCacEdit] = useState<CacEditState | null>(null);
  const [cacPayOpen, setCacPayOpen] = useState(false);
  const [nin, setNin] = useState("");
  const [ninLocked, setNinLocked] = useState(false);
  const [picture, setPicture] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<"avatar" | "cover" | null>(null);
  const [initial, setInitial] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    bio: "",
    cac: "",
    nin: "",
  });

  const fill = (user: ProfileUser | null) => {
    const name = fullNameFrom(user);
    const nextEmail = emailFrom(user);
    const nextPhone = phoneFrom(user);
    const nextAddress = addressFrom(user);
    const nextBio = isBusinessAccountType(String(user?.account_type))
      ? aboutFrom(user).slice(0, 280)
      : String(user?.user_bio || "").trim();
    const nextCac = cacFrom(user);
    const nextNin = ninFrom(user);
    const last = String(user?.user_lastname || user?.last_name || "").trim();
    setOriginalLastName(last);
    setIsBusiness(isBusinessAccountType(String(user?.account_type)));
    setFullName(name);
    setEmail(nextEmail);
    setPhone(nextPhone);
    setAddress(nextAddress);
    setBio(nextBio);
    setCac(nextCac);
    setNin(nextNin);
    setCacVerified(Boolean(user?.cac_verified));
    setNinLocked(Boolean(user?.nin_verified));
    const edit = user?.cac_edit || null;
    if (edit) {
      setCacEdit(edit);
      setCacLocked(!edit.can_edit);
    } else {
      setCacLocked(Boolean(user?.cac_verified));
    }
    setPicture(
      String(user?.user_picture || user?.picture || "").trim() || null
    );
    setCover(String(user?.user_cover || "").trim() || null);
    setInitial({
      fullName: name,
      email: nextEmail,
      phone: nextPhone,
      address: nextAddress,
      bio: nextBio,
      cac: nextCac,
      nin: nextNin,
    });
  };

  const load = useCallback(async () => {
    const stored = (await getUser()) as ProfileUser | null;
    if (stored) fill(stored);
    const profile = await getUserProfile().catch(() => null);
    if (profile?.user) {
      const next = { ...(stored || {}), ...profile.user } as ProfileUser;
      fill(next);
      await setUser(next);
    }
    if (isBusinessAccountType(String((profile?.user || stored)?.account_type))) {
      const edit = await getCacEditState();
      if (edit.success && edit.data) {
        setCacEdit(edit.data);
        setCacLocked(!edit.data.can_edit);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      let active = true;
      void (async () => {
        try {
          await load();
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [allowed, load])
  );

  const persistPhotos = useCallback(
    async (patch: Partial<ProfileUser>) => {
      const stored = (await getUser()) as ProfileUser | null;
      const next = { ...(stored || {}), ...patch } as ProfileUser;
      await setUser(next);
    },
    []
  );

  const pickImage = useCallback(
    async (kind: "avatar" | "cover", source: "camera" | "library") => {
      if (uploadingPhoto) return;
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera"
            ? "Allow camera access to take a photo."
            : "Allow photo access to choose an image."
        );
        return;
      }

      const picked =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: kind === "cover" ? [16, 9] : [1, 1],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: kind === "cover" ? [16, 9] : [1, 1],
              quality: 0.8,
            });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setUploadingPhoto(kind);
      const result =
        kind === "cover"
          ? await uploadCoverPicture({
              uri: asset.uri,
              name: asset.fileName,
              mimeType: asset.mimeType,
            })
          : await uploadProfilePicture({
              uri: asset.uri,
              name: asset.fileName,
              mimeType: asset.mimeType,
            });
      setUploadingPhoto(null);

      if (kind === "cover") {
        if (!result.success || !("user_cover" in result) || !result.user_cover) {
          showError("Could not update cover", result.message);
          return;
        }
        setCover(result.user_cover);
        await persistPhotos({ user_cover: result.user_cover });
        return;
      }

      if (!result.success || !result.user_picture) {
        showError("Could not update photo", result.message);
        return;
      }
      setPicture(result.user_picture);
      await persistPhotos({ user_picture: result.user_picture, picture: result.user_picture });
    },
    [persistPhotos, uploadingPhoto]
  );

  const choosePhoto = (kind: "avatar" | "cover") => {
    Alert.alert(
      kind === "cover" ? "Cover photo" : "Profile photo",
      kind === "cover"
        ? "Add a banner people see at the top of your profile"
        : "Add a display picture for your profile",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take photo", onPress: () => void pickImage(kind, "camera") },
        { text: "Choose from library", onPress: () => void pickImage(kind, "library") },
      ]
    );
  };

  const dirty = useMemo(
    () =>
      fullName.trim() !== initial.fullName.trim() ||
      email.trim().toLowerCase() !== initial.email.trim().toLowerCase() ||
      phone.trim() !== initial.phone.trim() ||
      address.trim() !== initial.address.trim() ||
      bio.trim() !== initial.bio.trim() ||
      (!cacLocked && cac.trim().toUpperCase() !== initial.cac.trim().toUpperCase()) ||
      (!ninLocked && nin.replace(/\D/g, "") !== initial.nin.replace(/\D/g, "")),
    [address, bio, cac, cacLocked, email, fullName, initial, nin, ninLocked, phone]
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace((isBusiness ? "/business/profile" : "/profile") as never);
  };

  const onSave = async () => {
    const name = fullName.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextPhone = phone.trim();
    const nextAddress = address.trim();
    const nextBio = bio.trim().slice(0, 280);
    const nextCac = cac.trim().toUpperCase();
    const nextNin = nin.replace(/\D/g, "");

    if (name.length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (nextPhone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    if (nextAddress.length < 8) {
      setError("Enter a fuller address (street, area, Jos).");
      return;
    }

    const { first, last } = isBusiness
      ? { first: name, last: originalLastName || name }
      : splitFullName(name, originalLastName);
    if (!isBusiness && (!first || !last)) {
      setError("Enter your first and last name.");
      return;
    }
    if (isBusiness && !cacLocked && nextCac && (nextCac.length < 5 || !/^[A-Z0-9/-]+$/.test(nextCac))) {
      setError(t("details.cacInvalid"));
      return;
    }
    if (!isBusiness && !ninLocked && nextNin && nextNin.length !== 11) {
      setError(t("details.ninInvalid"));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const result = await updatePersonalProfile({
        user_firstname: first,
        user_lastname: last,
        user_phone: nextPhone,
        user_email: nextEmail,
        address: nextAddress,
        ...(isBusiness
          ? {
              business_name: name,
              business_phone: nextPhone,
              business_email: nextEmail,
              business_location: nextAddress,
              business_description: nextBio,
              ...(!cacLocked && nextCac ? { CAC_number: nextCac } : {}),
            }
          : {
              user_bio: nextBio,
              ...(!ninLocked && nextNin ? { nin_number: nextNin } : {}),
            }),
      });
      if (!result.success) {
        setError(result.message || "Could not save your details.");
        return;
      }
      const saved = (result.user || {}) as ProfileUser;
      const stored = (await getUser()) as ProfileUser | null;
      const verifiedNow =
        saved.cac_verified != null
          ? Boolean(saved.cac_verified)
          : Boolean(stored?.cac_verified);
      const ninVerifiedNow =
        saved.nin_verified != null
          ? Boolean(saved.nin_verified)
          : Boolean(stored?.nin_verified);
      const storedCac = cacLocked ? cacFrom(stored) : nextCac || cacFrom(stored);
      const storedNin = ninLocked ? ninFrom(stored) : nextNin || ninFrom(stored);
      const next = {
        ...(stored || {}),
        ...saved,
        user_firstname: first,
        user_lastname: last,
        first_name: first,
        last_name: last,
        display_name: isBusiness ? name : `${first} ${last}`.trim(),
        user_phone: nextPhone,
        user_email: nextEmail,
        email: nextEmail,
        address: nextAddress,
        user_bio: isBusiness ? stored?.user_bio : nextBio,
        ...(isBusiness
          ? {
              business_name: name,
              business_phone: nextPhone,
              business_email: nextEmail,
              business_location: nextAddress,
              business_description: nextBio,
              CAC_number: storedCac,
              cac_number: storedCac,
              cac_verified: verifiedNow,
              cac_edit: saved.cac_edit || stored?.cac_edit || null,
            }
          : {
              nin_number: storedNin,
              nin_verified: ninVerifiedNow,
            }),
      } as ProfileUser;
      await setUser(next);
      if (isBusiness && nextCac) {
        showNotice({
          title: verifiedNow ? t("details.cacVerified") : t("business.cacPending"),
          message: result.message,
          tone: verifiedNow ? "success" : "info",
        });
      } else if (!isBusiness && nextNin) {
        showNotice({
          title: ninVerifiedNow ? t("details.ninVerified") : t("profile.ninPending"),
          message: result.message,
          tone: ninVerifiedNow ? "success" : "info",
        });
      }
      goBack();
    } catch {
      setError(friendlyError("offline"));
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="profile"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>
              {isBusiness ? t("details.businessKicker") : "Membership profile"}
            </Text>
            <Text style={styles.title}>
              {isBusiness ? t("details.businessTitle") : "Personal details"}
            </Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <FadeIn>
              <View style={styles.photos}>
                {isBusiness ? (
                  <Pressable
                    onPress={() => choosePhoto("cover")}
                    disabled={Boolean(uploadingPhoto)}
                    style={({ pressed }) => [styles.coverBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={cover ? "Change cover photo" : "Add cover photo"}
                  >
                    {cover ? (
                      <Image source={{ uri: absoluteUrl(cover) || cover }} style={styles.coverImage} />
                    ) : (
                      <View style={styles.coverEmpty}>
                        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                        <Text style={styles.coverEmptyText}>Add cover photo</Text>
                      </View>
                    )}
                    <View style={styles.coverBadge}>
                      {uploadingPhoto === "cover" ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="camera" size={14} color={colors.white} />
                          <Text style={styles.coverBadgeText}>{cover ? "Change" : "Add"}</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                ) : null}

                <View style={[styles.avatarRow, !isBusiness && styles.avatarRowPlain]}>
                  <View style={styles.avatarWrap}>
                    <AvatarCircle name={fullName} uri={picture} size={84} />
                    <Pressable
                      onPress={() => choosePhoto("avatar")}
                      disabled={Boolean(uploadingPhoto)}
                      style={({ pressed }) => [styles.cameraBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={picture ? "Change profile photo" : "Add profile photo"}
                    >
                      {uploadingPhoto === "avatar" ? (
                        <ActivityIndicator color={colors.white} size="small" />
                      ) : (
                        <Ionicons name="camera" size={14} color={colors.white} />
                      )}
                    </Pressable>
                  </View>
                  <View style={[styles.photoCopy, !isBusiness && styles.photoCopyPlain]}>
                    <Text style={styles.photoTitle}>
                      {isBusiness ? "Shop photos" : "Profile photo"}
                    </Text>
                    <Text style={styles.photoHint}>
                      {isBusiness
                        ? "Add a display picture and a banner so people recognise you."
                        : "Tap the camera to add or change your display picture."}
                    </Text>
                    {isBusiness ? (
                      <Pressable onPress={() => choosePhoto("avatar")} hitSlop={6}>
                        <Text style={styles.photoLink}>
                          {picture ? "Change profile photo" : "Add profile photo"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              <TextField
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                left={<FieldIcon name="person-outline" />}
              />
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                left={<FieldIcon name="mail-outline" />}
              />
              <TextField
                label={isBusiness ? t("details.about") : "Bio"}
                value={bio}
                onChangeText={(value) => setBio(value.slice(0, 280))}
                multiline
                maxLength={280}
                autoCapitalize="sentences"
                placeholder={
                  isBusiness
                    ? t("details.aboutPlaceholder")
                    : "A short intro other members will see on your profile"
                }
                helper={`${bio.trim().length}/280`}
                left={<FieldIcon name="create-outline" />}
              />
              {isBusiness ? (
                <TextField
                  label={t("details.cac")}
                  value={cac}
                  onChangeText={(value) =>
                    setCac(value.replace(/[^A-Za-z0-9/-]/g, "").toUpperCase().slice(0, 32))
                  }
                  editable={!cacLocked}
                  autoCapitalize="characters"
                  placeholder={t("details.cacPlaceholder")}
                  helper={
                    cacVerified
                      ? t("details.cacLocked")
                      : cacLocked
                      ? t("details.cacLocked")
                      : cacEdit?.credits
                        ? t("details.cacCreditHelper")
                        : cac.trim()
                          ? t("details.cacPendingHelper")
                          : t("details.cacHelper")
                  }
                  left={
                    <FieldIcon name={cacLocked ? "lock-closed-outline" : "ribbon-outline"} />
                  }
                  right={
                    cacVerified ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    ) : null
                  }
                />
              ) : (
                <TextField
                  label={t("details.nin")}
                  value={nin}
                  onChangeText={(value) => setNin(value.replace(/\D/g, "").slice(0, 11))}
                  editable={!ninLocked}
                  keyboardType="number-pad"
                  placeholder={t("details.ninPlaceholder")}
                  helper={
                    ninLocked
                      ? t("details.ninLocked")
                      : nin.trim()
                        ? t("details.ninPendingHelper")
                        : t("details.ninHelper")
                  }
                  left={
                    <FieldIcon name={ninLocked ? "lock-closed-outline" : "card-outline"} />
                  }
                  right={
                    ninLocked ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    ) : null
                  }
                />
              )}
              {isBusiness && cacEdit?.pending_request ? (
                <Text style={styles.cacNotice}>
                  {cacEdit.pending_request.status === "awaiting_payment"
                    ? t("details.cacAwaitingPay")
                    : t("details.cacPendingReview", {
                        amount: formatNaira(cacEdit.pending_request.amount || cacEdit.next_price),
                      })}
                </Text>
              ) : null}
              {isBusiness && cacLocked && !cacEdit?.pending_request ? (
                <AppButton
                  label={t("details.cacUnlock", {
                    amount: formatNaira(cacEdit?.next_price || 10000),
                  })}
                  onPress={() => setCacPayOpen(true)}
                  variant="secondary"
                  style={{ marginTop: 8, marginBottom: 8 }}
                />
              ) : null}
              <TextField
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                autoComplete="tel"
                keyboardType="phone-pad"
                left={<FieldIcon name="call-outline" />}
              />
              <TextField
                label="Address"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="words"
                autoComplete="postal-address"
                left={<FieldIcon name="location-outline" />}
              />
              {error ? <ErrorBanner message={error} /> : null}
              <AppButton
                label="Save changes"
                onPress={() => void onSave()}
                loading={saving}
                disabled={!dirty || saving}
              />
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <CacEditPaySheet
        open={cacPayOpen}
        state={cacEdit}
        onClose={() => setCacPayOpen(false)}
        onUpdated={(next) => {
          setCacEdit(next);
          setCacLocked(!next.can_edit);
        }}
      />
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
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: colors.text,
    marginTop: -2,
  },
  body: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: TAB_BAR_SPACE + 24,
  },
  photos: {
    marginBottom: 18,
  },
  coverBtn: {
    height: 148,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverEmptyText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  coverBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 61, 38, 0.88)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coverBadgeText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: colors.white,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -28,
    paddingHorizontal: 8,
    gap: 14,
  },
  avatarRowPlain: {
    marginTop: 0,
    paddingHorizontal: 0,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.background,
  },
  cameraBtn: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCopy: {
    flex: 1,
    paddingTop: 28,
  },
  photoCopyPlain: {
    paddingTop: 0,
  },
  photoTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  photoHint: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  cacNotice: {
    marginTop: 8,
    marginBottom: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  photoLink: {
    marginTop: 8,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  error: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.error,
    marginBottom: 14,
  },
});
}
