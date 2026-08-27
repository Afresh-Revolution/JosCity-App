import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import BusinessVerifiedBadge from "../components/BusinessVerifiedBadge";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedImage from "../components/feed/FeedImage";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import FriendActionButton from "../components/feed/FriendActionButton";
import PostCard from "../components/feed/PostCard";
import ReportSheet from "../components/ReportSheet";
import { createDirectConversation } from "../api/chat";
import { type FeedPost } from "../api/feed";
import { blockUser, getPersonalPage, type PersonalPage } from "../api/social";
import { useI18n } from "../i18n/I18nProvider";
import { getAccountType, getUser, hasSession, isBusinessAccountType } from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, handleFromName } from "../utils/format";
import { openMemberProfile } from "../utils/openProfile";

type TabKey = "posts" | "photos" | "reels" | "about";

const TABS: TabKey[] = ["posts", "photos", "reels", "about"];

function joinedLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function MemberProfileScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; name?: string | string[]; picture?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const paramId = Number(rawId);
  const isTab = !String(rawId || "").trim();
  const previewName = String(Array.isArray(params.name) ? params.name[0] : params.name || "").trim();
  const previewPicture =
    String(Array.isArray(params.picture) ? params.picture[0] : params.picture || "").trim() || null;
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [selfId, setSelfId] = useState(0);
  const [data, setData] = useState<PersonalPage | null>(null);
  const [viewerId, setViewerId] = useState(0);
  const [tab, setTab] = useState<TabKey>("posts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const memberId = Number.isFinite(paramId) && paramId > 0 ? paramId : selfId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await hasSession();
      if (cancelled) return;
      if (!ok) {
        router.replace("/login");
        return;
      }
      const [user, type] = await Promise.all([getUser(), getAccountType()]);
      if (cancelled) return;
      if (isTab && isBusinessAccountType(type)) {
        router.replace("/business/profile");
        return;
      }
      setSelfId(Number(user?.user_id || 0));
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isTab, router]);

  const load = useCallback(async () => {
    if (!Number.isFinite(memberId) || memberId <= 0) {
      if (previewName) {
        setData({
          profile: {
            user_id: 0,
            name: previewName,
            handle: handleFromName(previewName),
            picture: previewPicture,
            bio: null,
            location: null,
            verified: false,
            account_type: "personal",
            membership_label: null,
            friend_count: 0,
            post_count: 0,
            mutual_count: 0,
            joined_at: null,
            are_friends: false,
            is_owner: false,
          },
          posts: [],
          reels: [],
          photos: [],
        });
      } else {
        setData(null);
      }
      return;
    }
    const [page, user] = await Promise.all([getPersonalPage(memberId), getUser()]);
    setViewerId(Number(user?.user_id || 0));
    if (page && String(page.profile.account_type || "").toLowerCase() === "business") {
      openMemberProfile(router, page.profile.user_id, "business", "replace");
      return;
    }
    if (page) {
      setData(
        previewName && page.profile.name === "JosCity member"
          ? {
              ...page,
              profile: {
                ...page.profile,
                name: previewName,
                picture: previewPicture || page.profile.picture,
                handle:
                  page.profile.handle && page.profile.handle !== "@member"
                    ? page.profile.handle
                    : handleFromName(previewName),
              },
            }
          : page
      );
      return;
    }
    setData({
      profile: {
        user_id: memberId,
        name: previewName || "JosCity member",
        handle: handleFromName(previewName),
        picture: previewPicture,
        bio: null,
        location: null,
        verified: false,
        account_type: "personal",
        membership_label: null,
        friend_count: 0,
        post_count: 0,
        mutual_count: 0,
        joined_at: null,
        are_friends: false,
        is_owner: Number(user?.user_id || 0) === memberId,
      },
      posts: [],
      reels: [],
      photos: [],
    });
  }, [memberId, previewName, previewPicture, router]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      if (isTab && memberId <= 0) return;
      void (async () => {
        try {
          await load();
        } finally {
          setLoading(false);
        }
      })();
    }, [allowed, isTab, load, memberId])
  );

  useEffect(() => {
    setTab("posts");
  }, [memberId]);

  const profile = data?.profile;
  const owner = Boolean(profile?.is_owner);

  const onShare = () => {
    const name = profile?.name || "JosCity member";
    const handle = profile?.handle || "";
    void Share.share({
      message: `${name} ${handle} on JosCity\nhttps://joscity.com/people/${profile?.user_id || memberId}`,
    });
  };

  const onMessage = async () => {
    const userId = Number(profile?.user_id || 0);
    if (!userId || messageBusy) return;
    setMessageBusy(true);
    try {
      const result = await createDirectConversation(userId);
      if (result && "pending" in result && result.pending) {
        Alert.alert(t("member.messageRequestedTitle"), result.message || t("member.messageRequestedBody", { name: profile?.name || "" }));
        return;
      }
      if (!result || !("conversationId" in result)) {
        Alert.alert(t("member.messageFailed"));
        return;
      }
      router.push({
        pathname: "/messages/[id]",
        params: {
          id: String(result.conversationId),
          name: profile?.name || "",
          avatar: profile?.picture || "",
        },
      });
    } finally {
      setMessageBusy(false);
    }
  };

  const onBlock = () => {
    const userId = Number(profile?.user_id || 0);
    if (!userId || blockBusy || owner) return;
    Alert.alert(t("member.blockTitle"), t("member.blockBody", { name: profile?.name || "" }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("member.block"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBlockBusy(true);
            const result = await blockUser(userId);
            setBlockBusy(false);
            if (!result.success) {
              Alert.alert(t("member.blockFailed"), result.message);
              return;
            }
            Alert.alert(t("member.blockedTitle"), t("member.blockedBody"));
            if (router.canGoBack()) router.back();
            else router.replace("/people");
          })();
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

  const friends = Number(profile?.friend_count || 0);
  const posts = Number(profile?.post_count || 0);
  const mutual = Number(profile?.mutual_count || 0);

  const openSettings = () => router.push("/profile/settings");

  return (
    <FeedShell
      tab={isTab ? "profile" : "explore"}
      header={
        isTab ? (
          <FadeIn duration={480} translateY={8}>
            <View style={styles.headerBar}>
              <View style={styles.headerCopy}>
                <Text style={styles.headerKicker}>{t("profile.tabKicker")}</Text>
                <Text style={styles.headerTitle}>{t("profile.title")}</Text>
              </View>
              <Pressable
                onPress={openSettings}
                style={styles.gearBtn}
                accessibilityRole="button"
                accessibilityLabel={t("profile.settingsHint")}
              >
                <Ionicons name="settings-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </FadeIn>
        ) : (
          <View />
        )
      }
    >
      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {!isTab ? (
            <FadeIn>
              <View style={styles.stackTop}>
                <Pressable
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/people"))}
                  style={styles.back}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back")}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                {owner ? (
                  <Pressable
                    onPress={openSettings}
                    style={styles.gearBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.settingsHint")}
                  >
                    <Ionicons name="settings-outline" size={22} color={colors.text} />
                  </Pressable>
                ) : (
                  <View style={styles.gearBtn} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.kicker}>
                {profile?.name || t("member.kicker")}
              </Text>
              <Text style={styles.title}>{t("member.title")}</Text>
            </FadeIn>
          ) : null}

          {!profile ? (
            <Text style={styles.empty}>{t("member.missing")}</Text>
          ) : (
            <>
              <FadeIn delay={40}>
                <View style={styles.hero}>
                  <AvatarCircle name={profile.name} uri={profile.picture} size={96} />
                </View>
                <View style={styles.identity}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{profile.name}</Text>
                    <BusinessVerifiedBadge
                      color={profile.badge_color}
                      verified={profile.verified}
                      accountType="personal"
                      size={18}
                    />
                  </View>
                  <Text style={styles.handle}>{profile.handle}</Text>
                  {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                  <Text style={styles.metrics}>
                    {t("member.friendsCount", { count: friends.toLocaleString("en-NG") })}
                    {` · ${t("member.postsCount", { count: posts.toLocaleString("en-NG") })}`}
                    {!owner && mutual > 0
                      ? ` · ${
                          mutual === 1
                            ? t("member.mutualOne")
                            : t("member.mutualMany", { count: mutual })
                        }`
                      : ""}
                  </Text>
                  {profile.membership_label ? (
                    <View style={styles.badges}>
                      <View style={[styles.badge, styles.badgeGold]}>
                        <Text style={styles.badgeGoldText}>{profile.membership_label}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </FadeIn>

              <FadeIn delay={70}>
                {owner ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => router.push("/profile/personal-details")}
                      style={[styles.actionPrimary, styles.actionGrow]}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.white} />
                      <Text style={styles.actionPrimaryText}>{t("member.edit")}</Text>
                    </Pressable>
                    <Pressable onPress={onShare} style={[styles.actionSecondary, styles.actionGrow]}>
                      <Ionicons name="share-outline" size={16} color={colors.text} />
                      <Text style={styles.actionSecondaryText}>{t("member.share")}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.actions}>
                      <FriendActionButton userId={profile.user_id} name={profile.name} layout="bar" />
                      <Pressable
                        onPress={() => void onMessage()}
                        disabled={messageBusy}
                        style={[styles.actionSecondary, styles.actionGrow]}
                      >
                        {messageBusy ? (
                          <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                          <>
                            <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
                            <Text style={styles.actionSecondaryText}>{t("member.message")}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    <View style={styles.actions}>
                      <Pressable onPress={onShare} style={[styles.actionSecondary, styles.actionGrow]}>
                        <Ionicons name="share-outline" size={16} color={colors.text} />
                        <Text style={styles.actionSecondaryText}>{t("member.share")}</Text>
                      </Pressable>
                      <Pressable
                        onPress={onBlock}
                        disabled={blockBusy}
                        style={[styles.actionSecondary, styles.actionGrow]}
                        accessibilityRole="button"
                        accessibilityLabel={t("member.block")}
                      >
                        {blockBusy ? (
                          <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                          <>
                            <Ionicons name="ban-outline" size={16} color={colors.error} />
                            <Text style={[styles.actionSecondaryText, { color: colors.error }]}>
                              {t("member.block")}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => setReportOpen(true)}
                        style={[styles.actionSecondary, styles.actionGrow]}
                        accessibilityRole="button"
                        accessibilityLabel={t("member.report")}
                      >
                        <Ionicons name="flag-outline" size={16} color={colors.error} />
                        <Text style={[styles.actionSecondaryText, { color: colors.error }]}>
                          {t("member.report")}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </FadeIn>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabs}
              >
                {TABS.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[styles.tab, tab === key && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                      {t(`member.tab.${key}`)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {tab === "posts" ? (
                data.posts.length ? (
                  data.posts.map((post) => (
                    <PostCard key={post.post_id} post={post as FeedPost} viewerId={viewerId} />
                  ))
                ) : (
                  <Text style={styles.empty}>{t("member.postsEmpty")}</Text>
                )
              ) : null}

              {tab === "photos" ? (
                data.photos.length ? (
                  <View style={styles.photoGrid}>
                    {data.photos.map((photo) => (
                      <FeedImage
                        key={photo.id}
                        uri={absoluteUrl(photo.url) || photo.url}
                        style={styles.photo}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>{t("member.photosEmpty")}</Text>
                )
              ) : null}

              {tab === "reels" ? (
                data.reels.length ? (
                  data.reels.map((post) => (
                    <PostCard key={post.post_id} post={post as FeedPost} viewerId={viewerId} />
                  ))
                ) : (
                  <Text style={styles.empty}>{t("member.reelsEmpty")}</Text>
                )
              ) : null}

              {tab === "about" ? (
                <View style={styles.about}>
                  <AboutRow label={t("member.aboutBio")} value={profile.bio || "—"} />
                  <AboutRow label={t("member.aboutJoined")} value={joinedLabel(profile.joined_at)} />
                  <AboutRow label={t("member.aboutFriends")} value={String(friends)} />
                  <AboutRow label={t("member.aboutPosts")} value={String(posts)} />
                  {!owner ? (
                    <AboutRow
                      label={t("member.aboutMutual")}
                      value={
                        mutual === 1
                          ? t("member.mutualOne")
                          : mutual > 1
                            ? t("member.mutualMany", { count: mutual })
                            : t("friends.mutualNone")
                      }
                    />
                  ) : null}
                  {profile.membership_label ? (
                    <AboutRow label={t("member.aboutMembership")} value={profile.membership_label} />
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="profile"
        contentId={profile?.user_id || memberId}
        reportedUserId={Number(profile?.user_id || memberId) || null}
      />
    </FeedShell>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.textMuted }}>
        {label}
      </Text>
      <Text style={{ marginTop: 4, fontFamily: "Montserrat_400Regular", fontSize: 15, color: colors.text }}>
        {value}
      </Text>
    </View>
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
    content: {
      paddingBottom: TAB_BAR_SPACE + 16,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    headerCopy: {
      flex: 1,
    },
    headerKicker: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textMuted,
      marginBottom: 2,
    },
    headerTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 32,
      color: colors.text,
    },
    gearBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    stackTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: 8,
    },
    back: {
      width: 32,
      height: 32,
      marginLeft: 16,
      marginTop: 4,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    kicker: {
      marginTop: 6,
      paddingHorizontal: 20,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      paddingHorizontal: 20,
      fontFamily: "Montserrat_700Bold",
      fontSize: 34,
      color: colors.text,
      marginBottom: 8,
    },
    hero: {
      alignItems: "center",
      paddingTop: 8,
      marginBottom: 12,
    },
    identity: {
      paddingHorizontal: 20,
      alignItems: "center",
      marginBottom: 16,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    name: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
      textAlign: "center",
    },
    handle: {
      marginTop: 4,
      fontFamily: "Montserrat_500Medium",
      fontSize: 14,
      color: colors.textMuted,
    },
    bio: {
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
      textAlign: "center",
    },
    metrics: {
      marginTop: 10,
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.text,
      textAlign: "center",
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeGold: {
      backgroundColor: colors.greetingBg,
    },
    badgeGoldText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    actionGrow: {
      flex: 1,
    },
    actionPrimary: {
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionPrimaryText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.white,
    },
    actionSecondary: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    actionSecondaryText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    tabs: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.sheet,
    },
    tabActive: {
      backgroundColor: colors.brand,
    },
    tabText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    tabTextActive: {
      color: colors.white,
    },
    empty: {
      paddingHorizontal: 24,
      paddingVertical: 28,
      textAlign: "center",
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    about: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    photo: {
      width: "31%",
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
  });
}
