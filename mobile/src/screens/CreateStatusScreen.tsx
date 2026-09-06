import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PreviewVideo from "../components/media/PreviewVideo";
import FadeIn from "../components/FadeIn";
import { showError } from "../components/AppNotice";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell from "../components/feed/FeedShell";
import { createStory, getStories, type StoryMediaFile, type StoryType } from "../api/stories";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { requestHomeRefresh } from "../state/homeRefresh";
import {
  cacheOpenStatus,
  pendingStatusItems,
  statusGroupKey,
  takePendingStatusMedia,
} from "../state/openStatus";
import { clearPendingStatusStories, setPendingStatusStories } from "../state/pendingStatus";
import { getUser, type StoredUser } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import {
  MAX_STATUS_PHOTOS,
  MAX_STATUS_VIDEOS,
  pickStatusMedia,
} from "../utils/statusMedia";
import { mergePendingStatus, mapStoryGroups, type StatusStory } from "../utils/stories";
import { seedStoryMediaFromLocal } from "../storage/storyMediaCache";

function displayNameFor(user: StoredUser | null): string {
  return (
    user?.display_name ||
    user?.business_name ||
    [user?.first_name || user?.user_firstname, user?.last_name || user?.user_lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "You"
  );
}

function asStoryType(value: unknown): StoryType {
  const raw = String(value || "").toLowerCase();
  if (raw === "photo" || raw === "video" || raw === "text") return raw;
  return "text";
}

export default function CreateStatusScreen() {
  const allowed = useRequirePersonalAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = asStoryType(params.type);
  const mediaLimit = type === "video" ? MAX_STATUS_VIDEOS : MAX_STATUS_PHOTOS;

  const [user, setUser] = useState<StoredUser | null>(null);
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<StoryMediaFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [picking, setPicking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const autoOpened = useRef(false);
  const openGalleryRef = useRef<(mode: "replace" | "append") => Promise<boolean>>(async () => false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const openGallery = useCallback(
    async (mode: "replace" | "append") => {
      if (type !== "photo" && type !== "video") return false;
      const already = mode === "append" ? items.length : 0;
      if (already >= mediaLimit) {
        Alert.alert(type === "photo" ? t("status.maxPhotos") : t("status.maxVideos"));
        return false;
      }
      setPicking(true);
      const result = await pickStatusMedia(type, already);
      setPicking(false);
      if (!result.ok) {
        if (result.reason === "permission") {
          Alert.alert(t("status.permissionTitle"), t("status.permissionLibrary"));
        } else if (result.reason === "too-long") {
          Alert.alert(t("status.videoTooLongTitle"), t("status.videoTooLongBody"));
        }
        return false;
      }
      setItems((current) => {
        const next = mode === "replace" ? result.items : [...current, ...result.items];
        return next.slice(0, mediaLimit);
      });
      if (mode === "replace") setSelectedIndex(0);
      return true;
    },
    [items.length, mediaLimit, t, type]
  );
  openGalleryRef.current = openGallery;

  useEffect(() => {
    void getUser().then(setUser);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!allowed || type === "text" || autoOpened.current) return;
    autoOpened.current = true;
    const pending = pendingStatusItems(takePendingStatusMedia());
    if (pending.length) {
      setItems(pending);
      return;
    }
    void openGalleryRef.current("replace");
  }, [allowed, type]);

  const name = displayNameFor(user);
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;
  const selected = items[Math.min(selectedIndex, Math.max(items.length - 1, 0))] || null;
  const canPost = !posting && (type === "text" ? Boolean(text.trim()) : items.length > 0);

  const onPost = () => {
    if (!canPost) return;
    setPosting(true);
    const storyType = type;
    const storyText = text.trim();
    const storyCaption = caption.trim() || undefined;
    const storyItems = [...items];
    const current = user;
    const userId = Number(current?.user_id || 0);
    const userName = displayNameFor(current);
    const avatar = picture || "";
    const now = Date.now();
    const upload =
      storyType === "text"
        ? createStory({ type: storyType, src: storyText }).then((result) => [result])
        : Promise.all(
            storyItems.map(async (item) => {
              const result = await createStory({
                type: storyType,
                caption: storyCaption,
                media: item,
              });
              if (result.success && result.storyId) {
                await seedStoryMediaFromLocal({
                  storyId: result.storyId,
                  localUri: item.uri,
                  expiresAt: now + 24 * 60 * 60 * 1000,
                  type: storyType,
                });
              }
              return result;
            })
          );
    const pendingStories: StatusStory[] =
      storyType === "text"
        ? [
            {
              id: -now,
              userId,
              userName,
              avatar,
              type: "text",
              content: storyText,
              createdAt: now,
              expiresAt: now + 24 * 60 * 60 * 1000,
              isOwner: true,
              uploading: true,
              accountType: String(current?.account_type || "") || null,
            },
          ]
        : storyItems.map((item, index) => ({
            id: -(now + index + 1),
            userId,
            userName,
            avatar,
            type: storyType,
            content: item.uri,
            caption: storyCaption,
            createdAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000,
            isOwner: true,
            uploading: true,
            accountType: String(current?.account_type || "") || null,
          }));
    const preview = mergePendingStatus([], pendingStories)[0];
    setPendingStatusStories(pendingStories);
    if (preview) cacheOpenStatus(preview);
    const destination = {
      pathname: "/status/[userId]" as const,
      params: { userId: preview ? statusGroupKey(preview) : String(userId || userName) },
    };

    void upload.then(async (results) => {
      const failed = results.find((result) => !result.success);
      if (failed) {
        clearPendingStatusStories();
        showError(t("status.createFailed"), failed.message || t("status.createFailedRetry"));
        return;
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const [page, current] = await Promise.all([getStories(), getUser()]);
          const live = mapStoryGroups(page.data, current?.user_id).find(
            (group) =>
              group.userId === userId ||
              (userName && group.userName === userName)
          );
          if ((live?.stories.length || 0) >= pendingStories.length) break;
        } catch {
          // Keep the local preview until the copy is available.
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      clearPendingStatusStories();
      requestHomeRefresh();
    });

    setTimeout(() => {
      router.replace(destination);
    }, 80);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return Math.max(0, current - 1);
      return current;
    });
  };

  const title =
    type === "photo"
      ? t("status.createPhoto")
      : type === "video"
        ? t("status.createVideo")
        : t("status.createText");

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
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={() => void onPost()}
            disabled={!canPost}
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("status.share")}
          >
            {posting ? (
              <Text style={styles.postLabel}>{t("status.share")}…</Text>
            ) : (
              <Text style={styles.postLabel}>{t("status.share")}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <View
        style={[
          styles.body,
          {
            paddingBottom:
              keyboardHeight > 0
                ? Platform.OS === "ios"
                  ? keyboardHeight
                  : 8
                : Math.max(insets.bottom, 8),
            paddingHorizontal: 16,
          },
        ]}
      >
        <FadeIn duration={420} translateY={8}>
          <View style={styles.identity}>
            <AvatarCircle name={name} uri={picture} size={40} />
            <Text style={styles.identityName} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </FadeIn>

        {type === "text" ? (
          <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.textCanvas}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t("status.textPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={styles.textInput}
              multiline
              textAlign="center"
              autoFocus
            />
          </LinearGradient>
        ) : items.length ? (
          <View style={styles.mediaWrap}>
            <View style={styles.mediaStage}>
              {type === "photo" ? (
                <Image key={selected?.uri} source={{ uri: selected?.uri }} style={styles.media} />
              ) : posting ? (
                <View style={styles.media} />
              ) : (
                <PreviewVideo
                  key={selected?.uri}
                  uri={selected?.uri || ""}
                  style={styles.media}
                  playing
                  loop
                  muted
                />
              )}
            </View>

            {keyboardHeight === 0 ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbs}
                  keyboardShouldPersistTaps="handled"
                >
                  {items.map((item, index) => (
                    <View key={`${item.uri}-${index}`} style={styles.thumbWrap}>
                      <Pressable
                        onPress={() => setSelectedIndex(index)}
                        style={[styles.thumb, index === selectedIndex && styles.thumbActive]}
                      >
                        {type === "photo" ? (
                          <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                        ) : (
                          <View style={styles.videoThumb}>
                            <Ionicons name="play" size={16} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => removeItem(index)}
                        style={styles.removeThumb}
                        hitSlop={6}
                        accessibilityLabel={t("common.close")}
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {items.length < mediaLimit ? (
                    <Pressable
                      onPress={() => void openGallery("append")}
                      style={styles.addThumb}
                      disabled={picking}
                    >
                      <Ionicons name="add" size={22} color={colors.primary} />
                      <Text style={styles.addThumbLabel}>{t("status.addMore")}</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>

                <Pressable
                  onPress={() => void openGallery("replace")}
                  disabled={picking}
                  style={styles.changeBtn}
                >
                  <Ionicons name="images-outline" size={16} color={colors.primary} />
                  <Text style={styles.changeLabel}>{t("status.changeMedia")}</Text>
                </Pressable>
              </>
            ) : null}

            <View style={styles.captionBar}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t("status.captionPlaceholder")}
                placeholderTextColor={colors.textMuted}
                style={styles.caption}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={type === "video" ? "videocam" : "images"}
                  size={32}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {type === "video" ? t("status.videoEmptyTitle") : t("status.photoEmptyTitle")}
              </Text>
              <Text style={styles.emptyBody}>
                {type === "video" ? t("status.videoEmptyBody") : t("status.photoEmptyBody")}
              </Text>
              <Pressable
                onPress={() => void openGallery("replace")}
                style={({ pressed }) => [styles.pickBtn, pressed && styles.pickBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel={t("status.chooseFromGallery")}
              >
                <Ionicons
                  name={type === "video" ? "videocam-outline" : "images-outline"}
                  size={20}
                  color={colors.white}
                />
                <Text style={styles.pickLabel}>
                  {picking ? t("status.openingGallery") : t("status.chooseFromGallery")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    topBar: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
    },
    side: {
      width: 72,
      height: 40,
      justifyContent: "center",
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
    },
    postBtn: {
      minWidth: 72,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    postBtnDisabled: {
      opacity: 0.45,
    },
    postLabel: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.white,
    },
    body: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    identityName: {
      flex: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    textCanvas: {
      minHeight: 280,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      marginBottom: 16,
    },
    textInput: {
      width: "100%",
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 24,
      color: "#FFFFFF",
      minHeight: 160,
    },
    mediaWrap: {
      flex: 1,
    },
    mediaStage: {
      flex: 1,
      minHeight: 160,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.avatarBg,
    },
    media: {
      width: "100%",
      height: "100%",
    },
    thumbs: {
      paddingTop: 10,
      gap: 10,
      alignItems: "center",
    },
    thumbWrap: {
      width: 64,
      height: 64,
    },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.avatarBg,
      borderWidth: 2,
      borderColor: "transparent",
    },
    thumbActive: {
      borderColor: colors.primary,
    },
    thumbImage: {
      width: "100%",
      height: "100%",
    },
    videoThumb: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#111827",
    },
    removeThumb: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent: "center",
    },
    addThumb: {
      width: 64,
      height: 64,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.fieldBg,
    },
    addThumbLabel: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 9,
      color: colors.primary,
    },
    changeBtn: {
      marginTop: 12,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
    },
    changeLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.primary,
    },
    captionBar: {
      marginTop: 4,
      paddingTop: 8,
    },
    caption: {
      minHeight: 52,
      maxHeight: 100,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cream,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      color: colors.text,
    },
    empty: {
      minHeight: 320,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: 36,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.iconSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 20,
      color: colors.text,
      textAlign: "center",
    },
    emptyBody: {
      marginTop: 8,
      marginBottom: 24,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
    },
    missing: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
    },
    pickBtn: {
      alignSelf: "stretch",
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
    },
    pickBtnPressed: {
      backgroundColor: colors.primaryPressed,
    },
    pickLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.white,
    },
  });
}
