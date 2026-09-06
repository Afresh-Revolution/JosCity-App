import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import FadeIn from "../components/FadeIn";
import PreviewVideo from "../components/media/PreviewVideo";
import { showError } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell from "../components/feed/FeedShell";
import { createPost, type PostMediaFile } from "../api/feed";
import { requestHomeRefresh } from "../state/homeRefresh";
import {
  clearPendingPost,
  setPendingPostProgress,
  startPendingPost,
} from "../state/pendingPost";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { handleFromName } from "../utils/format";

const MAX_PHOTOS = 5;
const MAX_VIDEOS = 3;
const INPUT_LINE_HEIGHT = 24;

function displayNameFor(user: StoredUser | null): string {
  return (
    user?.display_name ||
    user?.business_name ||
    [user?.first_name || user?.user_firstname, user?.last_name || user?.user_lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "JosCity member"
  );
}

function handleFor(user: StoredUser | null, name: string): string {
  const raw = String(user?.user_name || user?.username || "").trim();
  if (raw) return raw.startsWith("@") ? raw : `@${raw.replace(/^@/, "")}`;
  return handleFromName(name);
}

export default function CreatePostScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ attach?: string }>();

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<PostMediaFile[]>([]);
  const [posting, setPosting] = useState(false);
  const openedAttach = useRef(false);
  const removeMedia = useCallback((index: number) => {
    setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  useEffect(() => {
    void getUser().then(setUser);
  }, []);

  const pickMedia = useCallback(
    async (kind: "photo" | "video") => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("create.permissionTitle"), t("create.permissionLibrary"));
        return;
      }
      const photos = media.filter((item) => item.kind === "photo").length;
      const videos = media.filter((item) => item.kind === "video").length;
      if (kind === "photo" && photos >= MAX_PHOTOS) {
        Alert.alert(t("create.maxPhotos"));
        return;
      }
      if (kind === "video" && videos >= MAX_VIDEOS) {
        Alert.alert(t("create.maxVideos"));
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "video" ? ["videos"] : ["images"],
        quality: 1,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Current,
        allowsMultipleSelection: kind === "photo",
        selectionLimit: kind === "photo" ? MAX_PHOTOS - photos : 1,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const next = picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
        kind,
      }));
      setMedia((current) => {
        const currentPhotos = current.filter((item) => item.kind === "photo").length;
        const currentVideos = current.filter((item) => item.kind === "video").length;
        const allowedNext =
          kind === "photo"
            ? next.slice(0, Math.max(0, MAX_PHOTOS - currentPhotos))
            : next.slice(0, Math.max(0, MAX_VIDEOS - currentVideos));
        return [...current, ...allowedNext];
      });
    },
    [media, t]
  );

  useEffect(() => {
    if (openedAttach.current) return;
    if (params.attach === "photo" || params.attach === "video") {
      openedAttach.current = true;
      void pickMedia(params.attach);
    }
  }, [params.attach, pickMedia]);

  const name = displayNameFor(user);
  const handle = handleFor(user, name);
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;
  const canPost = (Boolean(text.trim()) || media.length > 0) && !posting;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const onPost = () => {
    if (!canPost) return;
    setPosting(true);
    const handle: { abort: () => void } = { abort: () => undefined };
    const uploadId = startPendingPost(() => handle.abort());
    const { promise, abort } = createPost(text, media, {
      onProgress: (progress) => setPendingPostProgress(uploadId, progress),
    });
    handle.abort = abort;
    router.replace("/home");
    void promise.then((result) => {
      clearPendingPost(uploadId);
      if (result.aborted) return;
      if (!result.success) {
        showError(t("create.postFailed"), result.message || t("error.generic"));
        return;
      }
      requestHomeRefresh();
    });
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
          <Text style={styles.title}>{t("create.postTitle")}</Text>
          <Pressable
            onPress={() => void onPost()}
            disabled={!canPost}
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Post"
          >
            {posting ? (
              <JosCityLoader color={colors.white} size="small" />
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
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <FadeIn duration={420} translateY={8}>
            <View style={styles.identity}>
              <AvatarCircle name={name} uri={picture} size={48} />
              <View style={styles.identityCopy}>
                <Text style={styles.kicker}>POSTING AS YOURSELF</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  {handle}
                </Text>
              </View>
            </View>
          </FadeIn>

          <View style={styles.inputWrap}>
            <Text style={styles.inputSizer}>{text || " "}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t("create.placeholder")}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              autoFocus={params.attach !== "photo" && params.attach !== "video"}
            />
          </View>

          <View style={styles.toolbar}>
            <Text style={styles.toolbarTitle}>{t("create.addToPost")}</Text>
            <View style={styles.toolbarRow}>
              <Pressable
                onPress={() => void pickMedia("photo")}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={t("create.photo")}
              >
                <Ionicons name="image-outline" size={22} color={colors.primary} />
                <Text style={styles.actionLabel}>{t("create.photo")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void pickMedia("video")}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={t("create.video")}
              >
                <Ionicons name="videocam-outline" size={22} color={colors.primary} />
                <Text style={styles.actionLabel}>{t("create.video")}</Text>
              </Pressable>
            </View>
          </View>

          {media.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewRow}
            >
              {media.map((item, index) => (
                <MediaPreview
                  key={`${item.uri}-${index}`}
                  item={item}
                  styles={styles}
                  onRemove={() => removeMedia(index)}
                  closeLabel={t("common.close")}
                />
              ))}
            </ScrollView>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </FeedShell>
  );
}

const MediaPreview = memo(function MediaPreview({
  item,
  styles,
  onRemove,
  closeLabel,
}: {
  item: PostMediaFile;
  styles: ReturnType<typeof makeStyles>;
  onRemove: () => void;
  closeLabel: string;
}) {
  return (
    <View style={styles.previewItem}>
      {item.kind === "photo" ? (
        <Image source={{ uri: item.uri }} style={styles.previewMedia} />
      ) : (
        <PreviewVideo uri={item.uri} style={styles.previewMedia} playing={false} muted />
      )}
      <Pressable
        onPress={onRemove}
        style={styles.removeMedia}
        accessibilityLabel={closeLabel}
      >
        <Ionicons name="close" size={14} color="#FFFFFF" />
      </Pressable>
      {item.kind === "video" ? (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
});

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
      height: 34,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    postBtnDisabled: {
      backgroundColor: "#9AAE9A",
    },
    postLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.white,
    },
    body: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    identityCopy: {
      flex: 1,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 2,
    },
    name: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    handle: {
      marginTop: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    inputWrap: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      borderRadius: 12,
      backgroundColor: colors.fieldBg,
    },
    inputSizer: {
      width: "100%",
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: INPUT_LINE_HEIGHT,
      color: "transparent",
    },
    input: {
      position: "absolute",
      left: 12,
      right: 12,
      top: 8,
      bottom: 8,
      padding: 0,
      margin: 0,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: INPUT_LINE_HEIGHT,
      color: colors.text,
      includeFontPadding: false,
    },
    previewRow: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    previewItem: {
      width: 112,
      height: 112,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: colors.avatarBg,
    },
    previewMedia: {
      width: "100%",
      height: "100%",
    },
    removeMedia: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    videoBadge: {
      position: "absolute",
      left: 6,
      bottom: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    toolbar: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    toolbarTitle: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginBottom: 10,
    },
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.sheet,
    },
    actionLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
  });
}
