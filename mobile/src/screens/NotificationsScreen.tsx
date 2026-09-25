import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import FriendRequestActions from "../components/notifications/FriendRequestActions";
import SwipeableNotification from "../components/notifications/SwipeableNotification";
import {
  deleteAllNotifications,
  deleteNotification,
  deleteNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "../api/notifications";
import { useMembershipSettings } from "../hooks/useMembershipSettings";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { ensureFriendGraph } from "../state/friendGraph";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { openMemberProfile } from "../utils/openProfile";
import { openRatingPrompt } from "../state/ratingPrompt";
import {
  NOTIFICATION_FILTERS,
  matchesNotificationFilter,
  notificationActorName,
  notificationBody,
  notificationIcon,
  notificationKind,
  notificationPostId,
  notificationSection,
  notificationTitle,
  notificationWhen,
  isIncomingFriendRequest,
  isJoscityNotice,
  uniqueNotifications,
  stackMessageNotifications,
  type NotificationFilter,
  type StackedNotification,
} from "../utils/notifications";

type SectionKey = "TODAY" | "EARLIER" | "OLDER";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { personalEnabled } = useMembershipSettings();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async (mode: "replace" | "refresh" = "replace") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await getNotifications();
      setItems(uniqueNotifications(rows));
    } catch {
      if (mode !== "refresh") {
        Alert.alert("Notifications", "Could not load notifications.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    void ensureFriendGraph();
  }, [allowed, load]);

  const stacked = useMemo(() => stackMessageNotifications(items), [items]);
  const unreadCount = items.filter((item) => !item.is_read).length;
  const listFilter =
    filter === "membership" && !personalEnabled ? "all" : filter;
  const visible = useMemo(
    () => stacked.filter((item) => matchesNotificationFilter(item, listFilter)),
    [stacked, listFilter]
  );

  const sections = useMemo(() => {
    const grouped: { key: SectionKey; items: StackedNotification[] }[] = [
      { key: "TODAY", items: [] },
      { key: "EARLIER", items: [] },
      { key: "OLDER", items: [] },
    ];
    for (const item of visible) {
      const key = notificationSection(item.time);
      grouped.find((section) => section.key === key)?.items.push(item);
    }
    return grouped.filter((section) => section.items.length);
  }, [visible]);

  const removeLocal = (ids: number[]) => {
    const skip = new Set(ids);
    setItems((current) => current.filter((item) => !skip.has(item.id)));
    setSelected((current) => current.filter((id) => !skip.has(id)));
    setOpenId(null);
  };

  const onDeleteOne = (id: number, extraIds: number[] = []) => {
    const ids = extraIds.length ? extraIds : [id];
    removeLocal(ids);
    void (ids.length > 1 ? deleteNotifications(ids) : deleteNotification(id)).then((ok) => {
      if (!ok) {
        Alert.alert("Could not delete this notification.");
        void load("refresh");
      }
    });
  };

  const onMarkRead = (item: ApiNotification & { stackIds?: number[] }) => {
    const stackIds = item.stackIds?.length ? item.stackIds : [item.id];
    if (!item.is_read) {
      const skip = new Set(stackIds);
      setItems((current) =>
        current.map((row) => (skip.has(row.id) ? { ...row, is_read: true } : row))
      );
      void Promise.all(stackIds.map((id) => markNotificationRead(id)));
    }
    if (isIncomingFriendRequest(item)) {
      if (item.from_user_id) openMemberProfile(router, item.from_user_id);
      return;
    }
    const postId = notificationPostId(item);
    const action = String(item.action || "").toLowerCase();
    const node = String(item.node_type || "").toLowerCase();
    if (action.includes("message") || node === "message" || node === "message_request") {
      const conversationId = Number(item.node_id || 0);
      if (conversationId > 0 && node !== "message_request") {
        router.push({
          pathname: "/messages/[id]",
          params: {
            id: String(conversationId),
            name: notificationActorName(item) || "Chat",
          },
        });
        return;
      }
      router.push("/messages");
      return;
    }
    if (node === "order_review" || action === "rate_order") {
      const orderId = Number(item.node_id || 0);
      if (orderId) openRatingPrompt(orderId);
      return;
    }
    if (node === "business_review") {
      router.push("/business/reviews");
      return;
    }
    if (node === "forum_thread") {
      const threadId = Number(item.node_id || 0);
      if (threadId) {
        router.push({ pathname: "/forums/thread/[id]", params: { id: String(threadId) } });
      }
      return;
    }
    if (node === "marketplace_order" || node === "order") {
      router.push("/business/orders");
      return;
    }
    if (
      node === "agent_job" ||
      node === "agent_request" ||
      action.startsWith("agent_")
    ) {
      if (action.includes("fee_released") || action.includes("wallet")) {
        router.push("/agents/wallet");
        return;
      }
      if (action.includes("review")) {
        router.push("/agents/profile");
        return;
      }
      router.push("/agent-services/jobs");
      return;
    }
    if (postId) {
      router.push({ pathname: "/post/[id]", params: { id: String(postId) } });
      return;
    }
    if (isJoscityNotice(item)) {
      router.push({ pathname: "/notifications/[id]", params: { id: String(item.id) } });
    }
  };

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const onMarkAll = () => {
    if (!unreadCount) return;
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    void markAllNotificationsRead().then((ok) => {
      if (!ok) {
        Alert.alert("Could not mark notifications as read.");
        void load("refresh");
      }
    });
  };

  const onClearAll = () => {
    if (!items.length) return;
    Alert.alert("Clear all", "Remove every notification?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => {
          const snapshot = items;
          setItems([]);
          setSelected([]);
          setSelecting(false);
          void deleteAllNotifications().then((ok) => {
            if (!ok) {
              setItems(snapshot);
              Alert.alert("Could not clear notifications.");
            }
          });
        },
      },
    ]);
  };

  const onDeleteSelected = () => {
    if (!selected.length) return;
    Alert.alert("Delete", `Delete ${selected.length} notification${selected.length === 1 ? "" : "s"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const ids = [...selected];
          removeLocal(ids);
          setSelecting(false);
          void deleteNotifications(ids).then((ok) => {
            if (!ok) {
              Alert.alert("Could not delete the selected notifications.");
              void load("refresh");
            }
          });
        },
      },
    ]);
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
      tab="home"
      header={
        <View style={styles.topBar}>
          <View style={styles.headerLeft}>
            {selecting ? (
              <Pressable onPress={() => { setSelecting(false); setSelected([]); }} hitSlop={8} style={styles.sideBtn}>
                <Text style={styles.sideText}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>
              {selecting
                ? `${selected.length} selected`
                : `${unreadCount} unread`}
            </Text>
            <Text style={styles.title}>Notifications</Text>
          </View>

          <View style={styles.headerRight}>
            {selecting ? (
              <Pressable
                onPress={onDeleteSelected}
                disabled={!selected.length}
                hitSlop={8}
                style={styles.sideBtn}
              >
                <Text style={[styles.sideText, styles.danger, !selected.length && styles.disabled]}>
                  Delete
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    setSelecting(true);
                    setOpenId(null);
                    setSelected([]);
                  }}
                  hitSlop={8}
                  style={styles.sideBtn}
                >
                  <Text style={styles.sideText}>Select</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/notifications-settings")}
                  hitSlop={8}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Notification settings"
                >
                  <Ionicons name="options-outline" size={22} color={colors.text} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : (
        <GestureScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={colors.primary}
            />
          }
        >
          {!selecting ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {NOTIFICATION_FILTERS.filter(
                (item) => item.key !== "membership" || personalEnabled
              ).map((item) => {
                const active = listFilter === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFilter(item.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {!selecting && items.length > 0 ? (
            <View style={styles.actions}>
              <Pressable onPress={onMarkAll} disabled={!unreadCount} hitSlop={6}>
                <Text style={[styles.actionLink, !unreadCount && styles.disabled]}>
                  Mark all as read
                </Text>
              </Pressable>
              <Pressable onPress={onClearAll} hitSlop={6}>
                <Text style={[styles.actionLink, styles.danger]}>Clear all</Text>
              </Pressable>
            </View>
          ) : null}

          {visible.length === 0 ? (
            <Text style={styles.empty}>
              {items.length ? "No notifications in this filter." : "You're all caught up."}
            </Text>
          ) : null}

          {sections.map((section) => (
            <View key={section.key}>
              <Text style={styles.section}>{section.key}</Text>
              {section.items.map((item, index) => {
                const kind = notificationKind(item);
                const icon = notificationIcon(kind, colors);
                const checked = selected.includes(item.id);
                const actorName = notificationActorName(item);
                const body = kind === "message" ? "" : notificationBody(item);
                const count = item.stackCount || 1;
                return (
                  <FadeIn key={item.stackIds[0] || item.id} delay={Math.min(index * 40, 160)} duration={420} translateY={10}>
                    <SwipeableNotification
                      enabled={!selecting}
                      open={openId === item.id}
                      onOpen={() => setOpenId(item.id)}
                      onClose={() => setOpenId((current) => (current === item.id ? null : current))}
                      onDelete={() => onDeleteOne(item.id, item.stackIds)}
                    >
                      <View style={[styles.card, !item.is_read && styles.cardUnread]}>
                        {selecting ? (
                          <View style={[styles.check, checked && styles.checkOn]}>
                            {checked ? (
                              <Ionicons name="checkmark" size={14} color={colors.white} />
                            ) : null}
                          </View>
                        ) : null}
                        {actorName ? (
                          <Pressable
                            onPress={() => openMemberProfile(router, item.from_user_id)}
                            hitSlop={6}
                            accessibilityRole="button"
                          >
                            <AvatarCircle
                              name={actorName}
                              uri={item.from_user?.profile_image_url}
                              size={40}
                            />
                          </Pressable>
                        ) : (
                          <View style={[styles.iconWrap, { backgroundColor: icon.background }]}>
                            <Ionicons name={icon.name} size={18} color={icon.color} />
                          </View>
                        )}
                        <View style={styles.copy}>
                          <Pressable
                            onPress={() => {
                              if (selecting) {
                                const ids = item.stackIds.length ? item.stackIds : [item.id];
                                setSelected((current) => {
                                  const has = ids.every((id) => current.includes(id));
                                  if (has) return current.filter((id) => !ids.includes(id));
                                  return [...new Set([...current, ...ids])];
                                });
                                return;
                              }
                              onMarkRead(item);
                            }}
                            onLongPress={() => {
                              setSelecting(true);
                              setSelected(item.stackIds.length ? item.stackIds : [item.id]);
                              setOpenId(null);
                            }}
                          >
                            <View style={styles.titleRow}>
                              <Text style={styles.cardTitle} numberOfLines={2}>
                                {notificationTitle(item)}
                              </Text>
                              {count > 1 ? (
                                <View style={styles.countBadge}>
                                  <Text style={styles.countBadgeText}>{count > 99 ? "99+" : count}</Text>
                                </View>
                              ) : null}
                              {!item.is_read ? <View style={styles.dot} /> : null}
                            </View>
                            {body ? (
                              <Text selectable style={styles.body} numberOfLines={3}>
                                {body}
                              </Text>
                            ) : null}
                            <Text style={styles.when}>{notificationWhen(item.time)}</Text>
                          </Pressable>
                          {!selecting && isIncomingFriendRequest(item) && item.from_user_id ? (
                            <FriendRequestActions
                              userId={Number(item.from_user_id)}
                              name={actorName || "this member"}
                              requestId={Number(item.node_id || 0) || undefined}
                              onResolved={(accepted) => {
                                if (!item.is_read) void markNotificationRead(item.id);
                                if (!accepted) onDeleteOne(item.id);
                                else {
                                  setItems((current) =>
                                    current.map((row) =>
                                      row.id === item.id ? { ...row, is_read: true } : row
                                    )
                                  );
                                }
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                    </SwipeableNotification>
                  </FadeIn>
                );
              })}
            </View>
          ))}
        </GestureScrollView>
      )}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerLeft: {
    minWidth: 88,
    alignItems: "flex-start",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 88,
    justifyContent: "flex-end",
  },
  titleBlock: {
    flex: 1,
    alignItems: "center",
  },
  kicker: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtn: {
    minHeight: 40,
    minWidth: 48,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sideText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: TAB_BAR_SPACE + 24,
  },
  filters: {
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.navActive,
    borderColor: colors.navActive,
  },
  chipText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.primary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  actionLink: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  danger: {
    color: colors.error,
  },
  disabled: {
    opacity: 0.35,
  },
  section: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 12,
  },
  cardUnread: {
    backgroundColor: colors.navActive,
    borderColor: colors.navActive,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  countBadgeText: {
    color: colors.white,
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  body: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  when: {
    marginTop: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 12,
    color: colors.textSoft,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  empty: {
    textAlign: "center",
    marginTop: 48,
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: colors.textMuted,
  },
});
}
