import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import FadeIn from "../components/FadeIn";
import { ErrorBanner, showError, showNotice } from "../components/AppNotice";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  cancelScheduledPost,
  createScheduledPost,
  listScheduledPosts,
  type PostMediaFile,
  type ScheduledPost,
} from "../api/feed";
import { useRequireBusinessAccount } from "../hooks/useAccountSession";
import { useI18n } from "../i18n/I18nProvider";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, firstMediaUrl } from "../utils/format";
import { isVideoUrl, videoThumbnailUrl } from "../utils/media";

const MAX_PHOTOS = 5;
const MAX_VIDEOS = 3;
const DATE_DAYS = 90;
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const INPUT_LINE_HEIGHT = 22;

function defaultScheduleAt(): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(next.getHours() + 1);
  if (next.getTime() < Date.now() + 2 * 60 * 1000) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function upcomingDays(count = DATE_DAYS): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    return day;
  });
}

function applyDatePart(current: Date, day: Date): Date {
  const next = new Date(current);
  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return next;
}

function applyTimePart(current: Date, hour12: number, minute: number, period: "am" | "pm"): Date {
  let hour = hour12 % 12;
  if (period === "pm") hour += 12;
  const next = new Date(current);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function hour12Of(date: Date): number {
  const hour = date.getHours() % 12;
  return hour === 0 ? 12 : hour;
}

function periodOf(date: Date): "am" | "pm" {
  return date.getHours() >= 12 ? "pm" : "am";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatScheduleWhen(date: Date): string {
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateField(date: Date, todayLabel: string, tomorrowLabel: string): string {
  const today = startOfDay(new Date());
  const that = startOfDay(date);
  const diff = Math.round((that.getTime() - today.getTime()) / 86400000);
  const stamp = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (diff === 0) return `${todayLabel} · ${stamp}`;
  if (diff === 1) return `${tomorrowLabel} · ${stamp}`;
  return stamp;
}

function formatTimeField(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function mediaLabel(
  row: ScheduledPost,
  t: (key: string, opts?: Record<string, string | number>) => string
): string | null {
  const types = Array.isArray(row.media_types) ? row.media_types : [];
  const urls = Array.isArray(row.media_urls) ? row.media_urls : [];
  let photos = types.filter((item) => String(item).toLowerCase() !== "video").length;
  let videos = types.filter((item) => String(item).toLowerCase() === "video").length;
  if (!types.length && urls.length) {
    photos = urls.filter((url) => !isVideoUrl(url)).length;
    videos = urls.length - photos;
  }
  if (photos && videos) return t("scheduled.mediaMix", { photos, videos });
  if (photos) return t("scheduled.photoCount", { count: photos });
  if (videos) return t("scheduled.videoCount", { count: videos });
  return null;
}

export default function BusinessScheduledScreen() {
  const allowed = useRequireBusinessAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<PostMediaFile[]>([]);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleAt);
  const [picker, setPicker] = useState<null | "date" | "time">(null);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const days = useMemo(() => upcomingDays(), []);

  const load = useCallback(
    async (mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        setItems(await listScheduledPosts("pending"));
        setError(null);
      } catch {
        setError(t("business.manageLoadError"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load();
    }, [allowed, load])
  );

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

  const canSubmit = (Boolean(text.trim()) || media.length > 0) && !saving;
  const selectedHour = hour12Of(scheduledAt);
  const selectedMinute = scheduledAt.getMinutes();
  const selectedPeriod = periodOf(scheduledAt);

  const onSchedule = () => {
    if (!canSubmit) return;
    if (scheduledAt.getTime() < Date.now() + 60 * 1000) {
      showError(t("scheduled.failed"), t("scheduled.tooSoon"));
      return;
    }
    setSaving(true);
    const { promise } = createScheduledPost(text, scheduledAt, media);
    void promise.then((result) => {
      setSaving(false);
      if (result.aborted) return;
      if (!result.success) {
        showError(t("scheduled.failed"), result.message || t("error.generic"));
        return;
      }
      setText("");
      setMedia([]);
      setScheduledAt(defaultScheduleAt());
      showNotice({ title: t("scheduled.queued"), message: t("scheduled.queuedBody"), tone: "success" });
      void load("refresh");
    });
  };

  const onCancel = (item: ScheduledPost) => {
    Alert.alert(t("scheduled.cancelTitle"), t("scheduled.cancelBody"), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("scheduled.cancel"),
        style: "destructive",
        onPress: () => {
          setCancellingId(item.id);
          void cancelScheduledPost(item.id).then((result) => {
            setCancellingId(null);
            if (!result.success) {
              showError(t("scheduled.cancelFailed"), result.message || t("error.generic"));
              return;
            }
            showNotice({ title: t("scheduled.cancelled"), tone: "success" });
            setItems((current) => current.filter((row) => row.id !== item.id));
          });
        },
      },
    ]);
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab="manage" header={<View />}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.body}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />
          }
        >
          <FadeIn>
            <Pressable onPress={() => router.back()} style={styles.back}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={styles.backText}>{t("business.manageTitle")}</Text>
            </Pressable>
            <Text style={styles.title}>{t("scheduled.title")}</Text>
            <Text style={styles.intro}>{t("scheduled.body")}</Text>
          </FadeIn>

          {error ? <ErrorBanner message={error} /> : null}

          <FadeIn delay={40}>
            <View style={styles.composer}>
              <View style={styles.inputWrap}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t("scheduled.placeholder")}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  multiline
                  textAlignVertical="top"
                  underlineColorAndroid="transparent"
                />
              </View>

              <View style={styles.toolbarRow}>
                <Pressable
                  onPress={() => void pickMedia("photo")}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.photo")}
                >
                  <Ionicons name="image-outline" size={20} color={colors.primary} />
                  <Text style={styles.actionLabel}>{t("create.photo")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void pickMedia("video")}
                  style={styles.actionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.video")}
                >
                  <Ionicons name="videocam-outline" size={20} color={colors.primary} />
                  <Text style={styles.actionLabel}>{t("create.video")}</Text>
                </Pressable>
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
                      onRemove={() => setMedia((current) => current.filter((_, i) => i !== index))}
                      closeLabel={t("common.close")}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <Text style={styles.whenLabel}>{t("scheduled.when")}</Text>
              <View style={styles.pickRow}>
                <Pressable
                  onPress={() => setPicker("date")}
                  style={styles.pickField}
                  accessibilityRole="button"
                  accessibilityLabel={t("scheduled.pickDate")}
                >
                  <Text style={styles.pickKicker}>{t("scheduled.date")}</Text>
                  <View style={styles.pickValueRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.pickValue} numberOfLines={1}>
                      {formatDateField(scheduledAt, t("scheduled.today"), t("scheduled.tomorrow"))}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setPicker("time")}
                  style={styles.pickField}
                  accessibilityRole="button"
                  accessibilityLabel={t("scheduled.pickTime")}
                >
                  <Text style={styles.pickKicker}>{t("scheduled.time")}</Text>
                  <View style={styles.pickValueRow}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.pickValue} numberOfLines={1}>
                      {formatTimeField(scheduledAt)}
                    </Text>
                  </View>
                </Pressable>
              </View>

              <Pressable
                onPress={onSchedule}
                disabled={!canSubmit}
                style={[styles.submit, !canSubmit && styles.submitDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.submitText}>{t("scheduled.submit")}</Text>
                )}
              </Pressable>
            </View>
          </FadeIn>

          {loading && items.length === 0 ? (
            <View style={styles.listLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t("scheduled.empty")}</Text>
          ) : (
            items.map((item) => {
              const raw = firstMediaUrl(item.media_urls);
              const video = isVideoUrl(raw, item.media_types?.[0]);
              const thumb = video ? videoThumbnailUrl(raw) || raw : raw;
              const mix = mediaLabel(item, t);
              return (
                <FadeIn key={item.id}>
                  <View style={styles.card}>
                    {thumb ? (
                      <View style={styles.thumbWrap}>
                        <Image source={{ uri: absoluteUrl(thumb) || thumb }} style={styles.thumb} />
                        {video ? (
                          <View style={styles.playMark}>
                            <Ionicons name="play" size={12} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.thumbFallback}>
                        <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardWhen} numberOfLines={1}>
                        {formatScheduleWhen(new Date(item.scheduled_at))}
                      </Text>
                      {item.text ? (
                        <Text style={styles.cardText} numberOfLines={2}>
                          {item.text}
                        </Text>
                      ) : null}
                      {mix ? <Text style={styles.cardMeta}>{mix}</Text> : null}
                    </View>
                    <Pressable
                      onPress={() => onCancel(item)}
                      disabled={cancellingId === item.id}
                      style={styles.cancelBtn}
                    >
                      {cancellingId === item.id ? (
                        <ActivityIndicator color={colors.error} size="small" />
                      ) : (
                        <Text style={styles.cancelText}>{t("scheduled.cancel")}</Text>
                      )}
                    </Pressable>
                  </View>
                </FadeIn>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={picker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.dim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {picker === "time" ? t("scheduled.pickTime") : t("scheduled.pickDate")}
            </Text>
            {picker === "date" ? (
              <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                {days.map((day) => {
                  const selected = dateKey(day) === dateKey(scheduledAt);
                  return (
                    <Pressable
                      key={dateKey(day)}
                      onPress={() => {
                        setScheduledAt((current) => applyDatePart(current, day));
                        setPicker(null);
                      }}
                      style={[styles.sheetRow, selected && styles.sheetRowOn]}
                    >
                      <Text style={[styles.sheetLabel, selected && styles.sheetLabelOn]}>
                        {formatDateField(day, t("scheduled.today"), t("scheduled.tomorrow"))}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <>
                <View style={styles.periodRow}>
                  {(["am", "pm"] as const).map((period) => {
                    const on = selectedPeriod === period;
                    return (
                      <Pressable
                        key={period}
                        onPress={() =>
                          setScheduledAt((current) =>
                            applyTimePart(current, hour12Of(current), current.getMinutes(), period)
                          )
                        }
                        style={[styles.periodChip, on && styles.periodChipOn]}
                      >
                        <Text style={[styles.periodText, on && styles.periodTextOn]}>
                          {period === "am" ? t("scheduled.am") : t("scheduled.pm")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.timeCols}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeColTitle}>{t("scheduled.hour")}</Text>
                    <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
                      {HOURS_12.map((hour) => {
                        const on = selectedHour === hour;
                        return (
                          <Pressable
                            key={hour}
                            onPress={() =>
                              setScheduledAt((current) =>
                                applyTimePart(current, hour, current.getMinutes(), periodOf(current))
                              )
                            }
                            style={[styles.timeCell, on && styles.timeCellOn]}
                          >
                            <Text style={[styles.timeCellText, on && styles.timeCellTextOn]}>
                              {hour}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeColTitle}>{t("scheduled.minute")}</Text>
                    <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
                      {MINUTES.map((minute) => {
                        const on = selectedMinute === minute;
                        return (
                          <Pressable
                            key={minute}
                            onPress={() =>
                              setScheduledAt((current) =>
                                applyTimePart(current, hour12Of(current), minute, periodOf(current))
                              )
                            }
                            style={[styles.timeCell, on && styles.timeCellOn]}
                          >
                            <Text style={[styles.timeCellText, on && styles.timeCellTextOn]}>
                              {pad2(minute)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
                <Pressable onPress={() => setPicker(null)} style={styles.doneBtn}>
                  <Text style={styles.doneText}>{t("scheduled.done")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
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
        <Video
          source={{ uri: item.uri }}
          style={styles.previewMedia}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
        />
      )}
      <Pressable onPress={onRemove} style={styles.removeMedia} accessibilityLabel={closeLabel}>
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
    body: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: TAB_BAR_SPACE + 16,
    },
    back: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 8,
      marginTop: 4,
    },
    backText: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
      marginBottom: 6,
    },
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 16,
    },
    composer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.card,
      padding: 12,
      marginBottom: 20,
      gap: 10,
    },
    inputWrap: {
      minHeight: 88,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      borderRadius: 12,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: {
      minHeight: 68,
      padding: 0,
      fontFamily: "Montserrat_400Regular",
      fontSize: 16,
      lineHeight: INPUT_LINE_HEIGHT,
      color: colors.text,
    },
    toolbarRow: {
      flexDirection: "row",
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    actionLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    previewRow: {
      gap: 8,
      paddingVertical: 2,
    },
    previewItem: {
      width: 88,
      height: 88,
      borderRadius: 12,
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
    whenLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
      marginTop: 4,
    },
    pickRow: {
      flexDirection: "row",
      gap: 8,
    },
    pickField: {
      flex: 1,
      minHeight: 64,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.sheet,
      paddingHorizontal: 12,
      paddingVertical: 8,
      justifyContent: "center",
      gap: 4,
    },
    pickKicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
      textTransform: "uppercase",
    },
    pickValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    pickValue: {
      flex: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    dim: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      maxHeight: "78%",
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    sheetTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 16,
      color: colors.text,
      marginBottom: 10,
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
    sheetRowOn: {
      backgroundColor: colors.iconSoft,
      marginHorizontal: -8,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    sheetLabel: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 15,
      color: colors.text,
    },
    sheetLabelOn: {
      fontFamily: "Montserrat_600SemiBold",
      color: colors.primary,
    },
    periodRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    periodChip: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    periodChipOn: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    periodText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
    },
    periodTextOn: {
      color: colors.white,
    },
    timeCols: {
      flexDirection: "row",
      gap: 10,
      height: 280,
    },
    timeCol: {
      flex: 1,
    },
    timeColTitle: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    timeList: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    timeCell: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    timeCellOn: {
      backgroundColor: colors.brand,
    },
    timeCellText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.text,
    },
    timeCellTextOn: {
      color: colors.white,
    },
    doneBtn: {
      marginTop: 12,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    doneText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.white,
    },
    submit: {
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    submitDisabled: {
      backgroundColor: "#9AAE9A",
    },
    submitText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: colors.white,
    },
    listLoading: {
      paddingVertical: 24,
      alignItems: "center",
    },
    empty: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      paddingVertical: 20,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.card,
      padding: 10,
      marginBottom: 10,
    },
    thumbWrap: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.sheet,
    },
    thumb: {
      width: "100%",
      height: "100%",
    },
    playMark: {
      position: "absolute",
      right: 4,
      bottom: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbFallback: {
      width: 56,
      height: 56,
      borderRadius: 10,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    cardCopy: {
      flex: 1,
      minWidth: 0,
    },
    cardWhen: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    cardText: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    cardMeta: {
      marginTop: 2,
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textSoft,
    },
    cancelBtn: {
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    cancelText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.error,
    },
  });
}
