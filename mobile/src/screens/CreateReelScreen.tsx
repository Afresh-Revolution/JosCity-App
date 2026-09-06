import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import FadeIn from "../components/FadeIn";
import PreviewVideo from "../components/media/PreviewVideo";
import { showError } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell from "../components/feed/FeedShell";
import { createReel } from "../api/reels";
import { getApprovedUsers, searchUsers, type DirectoryUser } from "../api/social";
import { personName } from "../components/feed/PeopleRow";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { handleFromName } from "../utils/format";

type PickedMedia = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  kind: "photo" | "video";
};

function isVideoType(mime?: string | null, name?: string | null, uri?: string) {
  const hay = `${mime || ""} ${name || ""} ${uri || ""}`.toLowerCase();
  return hay.includes("video") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(hay);
}

function mentionHandle(user: DirectoryUser): string {
  const raw = String(user.user_name || "").replace(/^@/, "").trim();
  if (raw) return raw;
  return handleFromName(personName(user)).replace(/^@/, "");
}

export default function CreateReelScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mentions, setMentions] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    void getUser().then(setUser);
  }, []);

  const mentionQuery = useMemo(() => {
    const match = caption.match(/@([A-Za-z0-9_]*)$/);
    return match ? match[1] : null;
  }, [caption]);

  useEffect(() => {
    if (mentionQuery == null) {
      setMentions([]);
      return;
    }
    const handle = setTimeout(() => {
      void (mentionQuery
        ? searchUsers(mentionQuery)
        : getApprovedUsers({ limit: 8, accountType: "all" })
      ).then(setMentions);
    }, 180);
    return () => clearTimeout(handle);
  }, [mentionQuery]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("create.permissionTitle"), t("create.permissionLibrary"));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setMedia({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
      kind: asset.type === "video" || isVideoType(asset.mimeType, asset.fileName, asset.uri)
        ? "video"
        : "photo",
    });
  }, [t]);

  const pickFromFiles = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      setMedia({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        kind: isVideoType(asset.mimeType, asset.name, asset.uri) ? "video" : "photo",
      });
    } catch {
      Alert.alert(t("create.permissionTitle"), t("reels.permissionFiles"));
    }
  }, [t]);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("create.permissionTitle"), t("reels.permissionCamera"));
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setMedia({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
      kind: asset.type === "video" || isVideoType(asset.mimeType, asset.fileName, asset.uri)
        ? "video"
        : "photo",
    });
  }, [t]);

  const insertMention = (person: DirectoryUser) => {
    const handle = mentionHandle(person);
    setCaption((current) => current.replace(/@([A-Za-z0-9_]*)$/, `@${handle} `));
    setMentions([]);
  };

  const name =
    user?.display_name ||
    user?.business_name ||
    [user?.first_name || user?.user_firstname, user?.last_name || user?.user_lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "JosCity member";
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;
  const canPost = Boolean(media) && !posting;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/reels");
  };

  const onPost = async () => {
    if (!media) {
      Alert.alert(t("reels.needMedia"));
      return;
    }
    setPosting(true);
    setProgress(0.04);
    const result = await createReel(caption, media, setProgress);
    setPosting(false);
    setProgress(0);
    if (!result.success) {
      showError(t("reels.postFailed"), result.message || t("error.generic"));
      return;
    }
    router.replace("/reels");
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="create"
      showTabBar={false}
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={styles.side}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("reels.createTitle")}</Text>
          <Pressable
            onPress={() => void onPost()}
            disabled={!canPost}
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
          >
            {posting ? (
              <Text style={styles.postLabel}>{Math.round(progress * 100)}%</Text>
            ) : (
              <Text style={styles.postLabel}>Post</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.body}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn duration={420} translateY={8}>
            <View style={styles.identity}>
              <AvatarCircle name={name} uri={picture} size={48} />
              <View>
                <Text style={styles.kicker}>POSTING A REEL</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            </View>
          </FadeIn>

          {media ? (
            <View style={styles.previewWrap}>
              {media.kind === "photo" ? (
                <Image source={{ uri: media.uri }} style={styles.preview} />
              ) : (
                <PreviewVideo uri={media.uri} style={styles.preview} playing={false} muted />
              )}
              <Pressable onPress={() => setMedia(null)} disabled={posting} style={styles.removeMedia}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t("reels.captionPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            textAlignVertical="top"
            editable={!posting}
          />

          {mentions.length ? (
            <View style={styles.mentionBox}>
              {mentions.slice(0, 6).map((person) => (
                <Pressable
                  key={person.user_id}
                  onPress={() => insertMention(person)}
                  style={styles.mentionRow}
                >
                  <AvatarCircle
                    name={personName(person)}
                    uri={person.user_picture}
                    size={32}
                  />
                  <View style={styles.mentionCopy}>
                    <Text style={styles.mentionName}>{personName(person)}</Text>
                    <Text style={styles.mentionHandle}>@{mentionHandle(person)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.toolbarTitle}>{t("create.addToPost")}</Text>
          <View style={styles.toolbarRow}>
            <SourceButton
              icon="images-outline"
              label={t("reels.gallery")}
              onPress={() => void pickFromGallery()}
              styles={styles}
              disabled={posting}
            />
            <SourceButton
              icon="folder-open-outline"
              label={t("reels.files")}
              onPress={() => void pickFromFiles()}
              styles={styles}
              disabled={posting}
            />
            <SourceButton
              icon="camera-outline"
              label={t("reels.camera")}
              onPress={() => void pickFromCamera()}
              styles={styles}
              disabled={posting}
            />
          </View>
        </ScrollView>
        {posting ? (
          <View style={styles.progressPanel}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>
                {progress < 0.93 ? t("reels.uploading") : t("reels.finishing")}
              </Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </FeedShell>
  );
}

function SourceButton({
  icon,
  label,
  onPress,
  styles,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.actionBtn, disabled && { opacity: 0.45 }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
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
      paddingHorizontal: 8,
      paddingBottom: 10,
      minHeight: 48,
    },
    side: {
      width: 72,
      height: 40,
      alignItems: "flex-start",
      justifyContent: "center",
      paddingLeft: 4,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    postBtn: {
      minWidth: 72,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    postBtnDisabled: {
      opacity: 0.45,
    },
    postLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.white,
    },
    body: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
      marginBottom: 16,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    name: {
      marginTop: 2,
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    previewWrap: {
      height: 280,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.sheet,
      marginBottom: 16,
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    removeMedia: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      minHeight: 96,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
    },
    mentionBox: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: 16,
    },
    mentionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    mentionCopy: {
      flex: 1,
    },
    mentionName: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    mentionHandle: {
      marginTop: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: colors.textMuted,
    },
    toolbarTitle: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 10,
    },
    toolbarRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.cream,
    },
    actionLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.text,
    },
    progressPanel: {
      marginHorizontal: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    progressHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    progressLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    progressPct: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.primary,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: colors.fieldBg,
    },
    progressFill: {
      height: "100%",
      borderRadius: 4,
      backgroundColor: colors.brand,
    },
  });
}
