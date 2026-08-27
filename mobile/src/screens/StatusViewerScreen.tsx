import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video, Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AvatarCircle from "../components/feed/AvatarCircle";
import { showError } from "../components/AppNotice";
import ReportSheet from "../components/ReportSheet";
import StatusViewsSheet from "../components/feed/StatusViewsSheet";
import {
  deleteStory,
  getStories,
  getStoryViews,
  viewStory,
  type StoryViewer,
} from "../api/stories";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { getCachedOpenStatus } from "../state/openStatus";
import {
  getPendingStatusStories,
  onPendingStatusChange,
  removePendingStatusStory,
} from "../state/pendingStatus";
import { getUser } from "../storage/session";
import { timeAgo } from "../utils/format";
import { playableVideoUrl } from "../utils/media";
import { openMemberProfile } from "../utils/openProfile";
import {
  forgetStoryMedia,
  peekCachedStoryUri,
  rememberStoryMedia,
  resolveStoryPlaybackUri,
  storyRemoteMediaUrl,
} from "../storage/storyMediaCache";
import {
  mapStoryGroups,
  mergePendingStatus,
  type StatusGroup,
  type StatusStory,
} from "../utils/stories";

const HOLD_MS = 5000;

export default function StatusViewerScreen() {
  const allowed = useRequirePersonalAccount();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userKey = String(params.userId || "");

  const [group, setGroup] = useState<StatusGroup | null>(getCachedOpenStatus(userKey));
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [views, setViews] = useState(0);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [loading, setLoading] = useState(!group);
  const seen = useRef<Set<number>>(new Set());
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);

  const stories = group?.stories || [];
  const story = stories[index];

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  }, [router]);

  const loadGroup = useCallback(async () => {
    const user = await getUser();
    const page = await getStories();
    const pending = getPendingStatusStories();
    const groups = mergePendingStatus(mapStoryGroups(page.data, user?.user_id), pending);
    return (
      groups.find((item) => String(item.userId) === userKey) ||
      groups.find((item) => item.userName === decodeURIComponent(userKey)) ||
      (pending.length ? getCachedOpenStatus(userKey) : null)
    );
  }, [userKey]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await loadGroup();
        if (!cancelled) {
          setGroup(next || getCachedOpenStatus(userKey));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setGroup(getCachedOpenStatus(userKey));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, loadGroup, userKey]);

  useEffect(() => {
    return onPendingStatusChange(() => {
      void loadGroup().then((next) => {
        setGroup((current) => next || getCachedOpenStatus(userKey) || current);
      });
    });
  }, [loadGroup, userKey]);

  useEffect(() => {
    if (!story?.id || story.uploading || story.id <= 0 || seen.current.has(story.id)) return;
    seen.current.add(story.id);
    if (!story.isOwner) {
      void viewStory(story.id);
    }
    if (story.isOwner) {
      void getStoryViews(story.id).then((result) => {
        setViews(result.count);
        setViewers(result.viewers);
      });
    } else {
      setViews(0);
      setViewers([]);
    }
  }, [story?.id, story?.isOwner, story?.uploading]);

  useEffect(() => {
    const upcoming = [story, stories[index + 1]].filter(Boolean) as StatusStory[];
    for (const item of upcoming) {
      if (!item.id || item.id <= 0 || item.uploading || item.type === "text") continue;
      const remote = storyRemoteMediaUrl(item);
      if (!remote.startsWith("http")) continue;
      void rememberStoryMedia({
        storyId: item.id,
        remoteUrl: remote,
        expiresAt: item.expiresAt,
        kind: "media",
        type: item.type,
      });
    }
  }, [index, story, stories]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (!stories.length) {
        close();
        return;
      }
      if (nextIndex < 0) return;
      pausedRef.current = false;
      setPaused(false);
      if (nextIndex >= stories.length) {
        close();
        return;
      }
      elapsedRef.current = 0;
      startRef.current = Date.now();
      setProgress(0);
      setIndex(nextIndex);
    },
    [close, stories.length]
  );

  useEffect(() => {
    if (!story || paused || viewsOpen || reportOpen || story.type === "video") return;
    startRef.current = Date.now();
    const timer = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const next = Math.min((elapsed / HOLD_MS) * 100, 100);
      setProgress(next);
      if (next >= 100) {
        clearInterval(timer);
        goTo(index + 1);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [goTo, index, paused, reportOpen, story, viewsOpen]);

  const onHoldStart = () => {
    if (viewsOpen || reportOpen || pausedRef.current) return;
    pausedRef.current = true;
    elapsedRef.current += Date.now() - startRef.current;
    setPaused(true);
  };

  const onHoldEnd = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    startRef.current = Date.now();
    setPaused(false);
  };

  const onTap = (x: number) => {
    if (viewsOpen || reportOpen) return;
    const width = Dimensions.get("window").width;
    if (x < width * 0.35) goTo(index - 1);
    else goTo(index + 1);
  };

  const closeReport = () => {
    startRef.current = Date.now();
    pausedRef.current = false;
    setPaused(false);
    setReportOpen(false);
  };

  const openReport = () => {
    if (story?.isOwner) return;
    elapsedRef.current += Date.now() - startRef.current;
    pausedRef.current = true;
    setPaused(true);
    setReportOpen(true);
  };

  const closeViews = () => {
    startRef.current = Date.now();
    setViewsOpen(false);
  };

  const openProfile = (
    userId: number,
    name: string,
    picture?: string | null,
    accountType?: string | null,
    isSelf = false
  ) => {
    setPaused(true);
    pausedRef.current = true;
    if (isSelf) {
      setViewsOpen(false);
      router.push("/profile");
      return;
    }
    if (!userId) {
      Alert.alert(t("status.profileUnavailable"));
      return;
    }
    Alert.alert(t("status.viewProfileTitle"), t("status.viewProfileBody", { name }), [
      {
        text: t("common.cancel"),
        style: "cancel",
        onPress: () => {
          if (!viewsOpen) {
            pausedRef.current = false;
            startRef.current = Date.now();
            setPaused(false);
          }
        },
      },
      {
        text: t("status.viewProfile"),
        onPress: () => {
          setViewsOpen(false);
          openMemberProfile(router, userId, accountType, "push", {
            name,
            picture,
          });
        },
      },
    ]);
  };

  const openViews = () => {
    if (!story?.isOwner || story.uploading) return;
    elapsedRef.current += Date.now() - startRef.current;
    setViewsOpen(true);
    setViewsLoading(true);
    void getStoryViews(story.id).then((result) => {
      setViews(result.count);
      setViewers(result.viewers);
      setViewsLoading(false);
    });
  };

  const onDelete = () => {
    if (!story) return;
    Alert.alert(t("status.deleteTitle"), t("status.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("status.delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (story.uploading || story.id <= 0) {
              removePendingStatusStory(story.id);
              const remaining = stories.filter((item) => item.id !== story.id);
              if (!remaining.length) {
                close();
                return;
              }
              setGroup((current) =>
                current ? { ...current, stories: remaining } : current
              );
              setIndex((current) => Math.min(current, remaining.length - 1));
              return;
            }
            const ok = await deleteStory(story.id);
            if (!ok) {
              showError(t("status.deleteFailed"));
              return;
            }
            void forgetStoryMedia(story.id);
            const remaining = stories.filter((item) => item.id !== story.id);
            if (!remaining.length) {
              close();
              return;
            }
            setGroup((current) =>
              current ? { ...current, stories: remaining } : current
            );
            setIndex((current) => Math.min(current, remaining.length - 1));
          })();
        },
      },
    ]);
  };

  if (!allowed || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.loading}>
        <Text style={styles.missing}>{t("status.missing")}</Text>
        <Pressable onPress={close} style={styles.closeGhost}>
          <Text style={styles.closeGhostText}>{t("common.close")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Pressable
        style={styles.stage}
        onPress={(event) => onTap(event.nativeEvent.locationX)}
        onLongPress={onHoldStart}
        onPressOut={onHoldEnd}
        delayLongPress={160}
      >
        <StoryMedia
          story={story}
          paused={paused || viewsOpen}
          onEnded={() => goTo(index + 1)}
          onProgress={setProgress}
        />
      </Pressable>

      <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.progressRow}>
          {stories.map((item, itemIndex) => (
            <View key={item.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      itemIndex < index
                        ? "100%"
                        : itemIndex === index
                          ? `${progress}%`
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.meta}>
          <Pressable
            onPress={() =>
              openProfile(
                story.userId,
                story.userName,
                story.avatar,
                story.accountType,
                story.isOwner
              )
            }
            style={styles.identity}
            accessibilityRole="button"
            accessibilityLabel={story.userName}
          >
            <AvatarCircle name={story.userName} uri={story.avatar} size={34} />
            <View style={styles.metaCopy}>
              <Text style={styles.metaName} numberOfLines={1}>
                {story.userName}
              </Text>
              <Text style={styles.metaTime}>{timeAgo(new Date(story.createdAt).toISOString())}</Text>
            </View>
          </Pressable>
          {story.isOwner ? (
            <Pressable onPress={onDelete} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={openReport}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t("status.report")}
            >
              <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <Pressable onPress={close} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View
        style={[styles.captionWrap, { paddingBottom: insets.bottom + 18 }]}
        pointerEvents="box-none"
      >
        {story.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}
        {story.isOwner ? (
          story.uploading ? (
            <View style={styles.viewsRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.viewsText}>{t("status.uploading")}</Text>
            </View>
          ) : (
            <Pressable
              onPress={openViews}
              style={styles.viewsRow}
              accessibilityRole="button"
              accessibilityLabel={`${views} ${views === 1 ? t("status.view") : t("status.views")}`}
            >
              <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
              <Text style={styles.viewsText}>
                {views} {views === 1 ? t("status.view") : t("status.views")}
              </Text>
            </Pressable>
          )
        ) : null}
      </View>

      {story ? (
        <ReportSheet
          visible={reportOpen}
          onClose={closeReport}
          contentType="story"
          contentId={story.id}
          reportedUserId={story.userId || null}
        />
      ) : null}
      <StatusViewsSheet
        visible={viewsOpen}
        loading={viewsLoading}
        views={views}
        viewers={viewers}
        onClose={closeViews}
        onOpenProfile={(viewer) =>
          openProfile(viewer.userId, viewer.name, viewer.picture, viewer.accountType)
        }
      />
    </View>
  );
}

function StoryMedia({
  story,
  paused,
  onEnded,
  onProgress,
}: {
  story: StatusStory;
  paused: boolean;
  onEnded: () => void;
  onProgress: (value: number) => void;
}) {
  const remoteVideo = story.type === "video" ? playableVideoUrl(story.content) : "";
  const remotePhoto = story.type === "photo" ? story.content : "";
  const [mediaUri, setMediaUri] = useState(
    () =>
      peekCachedStoryUri(story.id, "media") ||
      (story.type === "video" ? remoteVideo : remotePhoto)
  );
  const [attempt, setAttempt] = useState(0);
  const [buffering, setBuffering] = useState(story.type === "video" && !peekCachedStoryUri(story.id, "media"));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cached = peekCachedStoryUri(story.id, "media");
    setAttempt(0);
    setBuffering(story.type === "video" && !cached);
    setMediaUri(cached || (story.type === "video" ? playableVideoUrl(story.content) : story.content));
    if (story.type === "text" || story.uploading || story.id <= 0) return;
    void resolveStoryPlaybackUri(story).then((uri) => {
      if (!uri) return;
      setMediaUri((current) => {
        if (current === uri) return current;
        const local = uri.startsWith("file:") || uri.startsWith("content:");
        const stillRemote = !current || current.startsWith("http");
        return local && stillRemote ? uri : current || uri;
      });
    });
  }, [story.id, story.content, story.type, story.uploading]);

  useEffect(() => {
    if (story.type === "text" || story.uploading || story.id <= 0) return;
    const remote = storyRemoteMediaUrl(story);
    if (!remote.startsWith("http")) return;
    void rememberStoryMedia({
      storyId: story.id,
      remoteUrl: remote,
      expiresAt: story.expiresAt,
      kind: "media",
      type: story.type,
    });
  }, [story.id, story.content, story.type, story.expiresAt, story.uploading]);

  useEffect(() => {
    if (story.type !== "video") return;
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, [story.type]);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const retryLoad = () => {
    if (attempt >= 4 || retryTimer.current) return;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setAttempt((value) => value + 1);
      setBuffering(true);
    }, 1600);
  };

  if (story.type === "photo" && mediaUri) {
    return <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />;
  }
  if (story.type === "video" && mediaUri) {
    return (
      <View style={styles.media}>
        <Video
          key={`${story.id}-${attempt}-${mediaUri}`}
          source={{ uri: mediaUri }}
          style={styles.media}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={!paused}
          isLooping={false}
          isMuted={false}
          progressUpdateIntervalMillis={250}
          pointerEvents="none"
          onPlaybackStatusUpdate={(status) => {
            if (!status.isLoaded) {
              if ("error" in status && status.error) {
                if (attempt >= 4) setBuffering(false);
                else retryLoad();
              }
              return;
            }
            const waiting = Boolean(status.isBuffering && status.positionMillis < 400);
            setBuffering((current) => (current === waiting ? current : waiting));
            if (status.durationMillis) {
              onProgress(Math.min((status.positionMillis / status.durationMillis) * 100, 100));
            }
            if (status.didJustFinish) onEnded();
          }}
        />
        {buffering ? (
          <View style={styles.videoWait} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.textCanvas}>
      <Text style={styles.textCopy}>{story.content}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loading: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  missing: {
    fontFamily: "Montserrat_500Medium",
    color: "#FFFFFF",
    fontSize: 15,
  },
  closeGhost: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeGhostText: {
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
  },
  media: {
    width: "100%",
    height: "100%",
  },
  videoWait: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  textCanvas: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  textCopy: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 26,
    lineHeight: 34,
    color: "#FFFFFF",
    textAlign: "center",
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 10,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  meta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaCopy: {
    flex: 1,
  },
  metaName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  metaTime: {
    marginTop: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  captionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  caption: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  viewsRow: {
    alignSelf: "center",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  viewsText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
