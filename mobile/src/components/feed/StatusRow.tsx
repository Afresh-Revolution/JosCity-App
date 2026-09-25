import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import PreviewVideo from "../media/PreviewVideo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/I18nProvider";
import { cacheOpenStatus, statusGroupKey } from "../../state/openStatus";
import {
  hydrateStoryCache,
  isLocalUri,
  peekCachedStoryUri,
  rememberStoryMedia,
  storyRemoteThumbUrl,
} from "../../storage/storyMediaCache";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";
import { absoluteUrl, initials } from "../../utils/format";
import { isOwnStatusGroup, type StatusGroup, type StatusStory } from "../../utils/stories";

const PLUS_GREEN = "#25D366";
const TILE = 86;

type Props = {
  groups: StatusGroup[];
  currentUserId?: number | null;
  currentUserName?: string;
  currentUserAvatar?: string | null;
};

export default function StatusRow({
  groups,
  currentUserId,
  currentUserName = "You",
  currentUserAvatar,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  const ownGroup = groups.find((group) =>
    isOwnStatusGroup(group, currentUserId, currentUserName)
  );
  const others = groups.filter((group) => group !== ownGroup);

  const openViewer = (group: StatusGroup) => {
    if (!group.stories.length) return;
    cacheOpenStatus(group);
    router.push({
      pathname: "/status/[userId]",
      params: { userId: statusGroupKey(group) },
    });
  };

  const onAdd = () => setPickerOpen(true);

  const onSelectType = (kind: "text" | "photo" | "video") => {
    setPickerOpen(false);
    router.push({ pathname: "/status/create", params: { type: kind } });
  };

  return (
    <View>
      <View style={styles.card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroller}
        >
            <OwnTile
            name={currentUserName}
            avatar={absoluteUrl(currentUserAvatar) || currentUserAvatar || ownGroup?.avatar}
            preview={ownGroup?.stories[0]}
            hasStories={Boolean(ownGroup?.stories.length)}
            onAdd={onAdd}
            onOpen={() => ownGroup && openViewer(ownGroup)}
            styles={styles}
            addLabel={t("status.add")}
          />
          {others.map((group) => (
            <OtherTile
              key={`${group.userId}-${group.userName}`}
              group={group}
              onOpen={() => openViewer(group)}
              styles={styles}
            />
          ))}
        </ScrollView>
      </View>
      <CreateTypeSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onSelectType}
      />
    </View>
  );
}

function OwnTile({
  name,
  avatar,
  preview,
  hasStories,
  onAdd,
  onOpen,
  styles,
  addLabel,
}: {
  name: string;
  avatar?: string | null;
  preview?: StatusStory;
  hasStories: boolean;
  onAdd: () => void;
  onOpen: () => void;
  styles: ReturnType<typeof makeStyles>;
  addLabel: string;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.tileHit}>
        <Pressable
          onPress={hasStories ? onOpen : onAdd}
          accessibilityRole="button"
          accessibilityLabel={name}
          style={styles.tile}
        >
          <StoryPreview story={preview} fallbackUri={avatar} fallbackName={name} styles={styles} />
        </Pressable>
        <Pressable
          onPress={onAdd}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          hitSlop={6}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function OtherTile({
  group,
  onOpen,
  styles,
}: {
  group: StatusGroup;
  onOpen: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const preview = group.stories[0];
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={group.userName}
      style={styles.item}
    >
      <View style={[styles.ring, group.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
        <View style={styles.tileInner}>
          <StoryPreview
            story={preview}
            fallbackUri={group.avatar}
            fallbackName={group.userName}
            styles={styles}
          />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {group.userName}
      </Text>
    </Pressable>
  );
}

function StoryPreview({
  story,
  fallbackUri,
  fallbackName,
  styles,
}: {
  story?: StatusStory;
  fallbackUri?: string | null;
  fallbackName: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const localContent =
    story?.content && isLocalUri(story.content) ? story.content : "";
  const remoteThumb = story ? storyRemoteThumbUrl(story) : "";
  const cachedThumb = story?.id ? peekCachedStoryUri(story.id, "thumb") : null;
  const cachedMedia = story?.id ? peekCachedStoryUri(story.id, "media") : null;
  const [thumbUri, setThumbUri] = useState(
    cachedThumb || cachedMedia || localContent || remoteThumb
  );
  const [thumbFailed, setThumbFailed] = useState(false);
  const localVideo = Boolean(story?.type === "video" && localContent);

  useEffect(() => {
    let live = true;
    setThumbFailed(false);
    const apply = () => {
      const next =
        (story?.id ? peekCachedStoryUri(story.id, "thumb") : null) ||
        (story?.id ? peekCachedStoryUri(story.id, "media") : null) ||
        localContent ||
        remoteThumb;
      if (live) setThumbUri(next);
    };
    apply();
    void hydrateStoryCache().then(apply);
    if (!story || story.id <= 0 || story.uploading || !remoteThumb.startsWith("http")) {
      return () => {
        live = false;
      };
    }
    void rememberStoryMedia({
      storyId: story.id,
      remoteUrl: remoteThumb,
      expiresAt: story.expiresAt,
      kind: "thumb",
      type: story.type,
    }).then((uri) => {
      if (!live || !uri) return;
      const cached =
        peekCachedStoryUri(story.id, "thumb") || peekCachedStoryUri(story.id, "media");
      setThumbUri(cached || (isLocalUri(uri) ? uri : localContent) || uri);
    });
    return () => {
      live = false;
    };
  }, [story?.id, story?.content, story?.expiresAt, story?.type, story?.uploading, localContent, remoteThumb, fallbackUri]);

  if (story?.type === "photo" && !thumbFailed && (thumbUri || localContent || story.content)) {
    return (
      <Image
        source={{ uri: thumbUri || localContent || story.content }}
        style={styles.preview}
        resizeMode="cover"
        fadeDuration={0}
        onError={() => {
          if (localContent && thumbUri !== localContent) {
            setThumbUri(localContent);
            return;
          }
          setThumbFailed(true);
        }}
      />
    );
  }
  if (story?.type === "video") {
    return (
      <View style={styles.videoPreview}>
        {localVideo ? (
          <PreviewVideo uri={story.content} style={styles.preview} playing={false} muted />
        ) : thumbUri && !thumbFailed ? (
          <Image
            source={{ uri: thumbUri }}
            style={styles.preview}
            resizeMode="cover"
            fadeDuration={0}
            onError={() => {
              const cached =
                (story?.id ? peekCachedStoryUri(story.id, "thumb") : null) ||
                (story?.id ? peekCachedStoryUri(story.id, "media") : null);
              if (cached && cached !== thumbUri) {
                setThumbUri(cached);
                return;
              }
              setThumbFailed(true);
            }}
          />
        ) : fallbackUri ? (
          <Image source={{ uri: fallbackUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.initialsFill}>
            <Text style={styles.initials}>{initials(fallbackName)}</Text>
          </View>
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={12} color="#FFFFFF" />
        </View>
      </View>
    );
  }
  if (story?.type === "text" && story.content) {
    return (
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.textPreview}>
        <Text selectable style={styles.textPreviewCopy} numberOfLines={4}>
          {story.content}
        </Text>
      </LinearGradient>
    );
  }
  if (fallbackUri && !thumbFailed) {
    return (
      <Image
        source={{ uri: fallbackUri }}
        style={styles.preview}
        onError={() => setThumbFailed(true)}
      />
    );
  }
  return (
    <View style={styles.initialsFill}>
      <Text style={styles.initials}>{initials(fallbackName)}</Text>
    </View>
  );
}

function CreateTypeSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: "text" | "photo" | "video") => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeSheetStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t("status.createTitle")}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("common.close")}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Option
            icon="text"
            title={t("status.textTitle")}
            subtitle={t("status.textSub")}
            onPress={() => onSelect("text")}
            styles={styles}
            colors={colors}
          />
          <Option
            icon="image-outline"
            title={t("status.photoTitle")}
            subtitle={t("status.photoSub")}
            onPress={() => onSelect("photo")}
            styles={styles}
            colors={colors}
          />
          <Option
            icon="videocam-outline"
            title={t("status.videoTitle")}
            subtitle={t("status.videoSub")}
            onPress={() => onSelect("video")}
            styles={styles}
            colors={colors}
          />
        </View>
      </View>
    </Modal>
  );
}

function Option({
  icon,
  title,
  subtitle,
  onPress,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  styles: ReturnType<typeof makeSheetStyles>;
  colors: Palette;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 12,
    },
    scroller: {
      paddingHorizontal: 12,
      gap: 12,
    },
    item: {
      width: TILE,
      alignItems: "center",
    },
    tileHit: {
      width: TILE,
      height: TILE,
    },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: colors.avatarBg,
    },
    ring: {
      width: TILE + 8,
      height: TILE + 8,
      borderRadius: 16,
      padding: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    ringUnseen: {
      borderWidth: 2.5,
      borderColor: PLUS_GREEN,
    },
    ringSeen: {
      borderWidth: 2,
      borderColor: colors.border,
    },
    tileInner: {
      width: TILE,
      height: TILE,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.avatarBg,
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    videoPreview: {
      width: "100%",
      height: "100%",
    },
    playBadge: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    textPreview: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 8,
    },
    textPreviewCopy: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 10,
      color: "#FFFFFF",
      textAlign: "center",
    },
    initialsFill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.avatarBg,
    },
    initials: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.primary,
    },
    addBtn: {
      position: "absolute",
      bottom: -2,
      alignSelf: "center",
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: PLUS_GREEN,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.card,
    },
    name: {
      marginTop: 8,
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      width: "100%",
    },
  });
}

function makeSheetStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.sheet,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 18,
      color: colors.text,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    optionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.navActive,
      alignItems: "center",
      justifyContent: "center",
    },
    optionCopy: {
      flex: 1,
    },
    optionTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    optionSub: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
