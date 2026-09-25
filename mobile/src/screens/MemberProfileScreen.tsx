import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import JosCityLoader from "../components/JosCityLoader";
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
import { agentApi, type AgentProfile, type AgentReview } from "../api/agent";
import AgentSourcedCatalogue from "../components/agents/AgentSourcedCatalogue";
import { blockUser, getPersonalPage, unblockUser, type PersonalPage } from "../api/social";
import { showNotice } from "../components/AppNotice";
import { useI18n } from "../i18n/I18nProvider";
import {
  friendshipAllowed,
  getAccountType,
  getUser,
  hasSession,
  isBusinessAccountType,
  isDedicatedAgentAccount,
} from "../storage/session";
import { ensureBlockedUsers, isUserBlocked, subscribeBlockedUsers } from "../storage/blockedUsers";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { absoluteUrl, handleFromName } from "../utils/format";
import { openMemberProfile } from "../utils/openProfile";
import { accountStatusKind, accountStatusLabel } from "../utils/accountStatus";

type TabKey = "posts" | "photos" | "reels" | "catalogue" | "reviews" | "about";

const MEMBER_TABS: TabKey[] = ["posts", "photos", "reels", "about"];
const AGENT_TABS: TabKey[] = ["posts", "photos", "catalogue", "reviews", "about"];

function joinedLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function agentServicesLabel(type?: string | null): string {
  if (type === "buy") return "Help me buy";
  if (type === "deliver") return "Help me deliver";
  if (type === "both") return "Help me buy · Help me deliver";
  return "Agent";
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
  const [blocked, setBlocked] = useState(false);
  const [viewerIsAgent, setViewerIsAgent] = useState(false);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [agentReviews, setAgentReviews] = useState<AgentReview[]>([]);
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
      setViewerIsAgent(isDedicatedAgentAccount(user, type));
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
    const [page, user, type] = await Promise.all([getPersonalPage(memberId), getUser(), getAccountType()]);
    setViewerId(Number(user?.user_id || 0));
    setViewerIsAgent(isDedicatedAgentAccount(user, type));
    let agent: AgentProfile | null = null;
    try {
      const row = await agentApi.profile(memberId);
      agent = row?.agent_type ? row : null;
    } catch {
      agent = null;
    }
    setAgentProfile(agent);
    await ensureBlockedUsers();
    setBlocked(isUserBlocked(memberId));
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

  useEffect(() => {
    if (agentProfile && tab === "reels") setTab("catalogue");
    if (!agentProfile && (tab === "catalogue" || tab === "reviews")) setTab("about");
  }, [agentProfile, tab]);

  useEffect(() => {
    void ensureBlockedUsers().then(() => setBlocked(isUserBlocked(memberId)));
    return subscribeBlockedUsers(() => setBlocked(isUserBlocked(memberId)));
  }, [memberId]);

  const profile = data?.profile;
  const owner = Boolean(profile?.is_owner);
  const deactivated = accountStatusKind(profile) === "deactivated";
  const isAgentProfile = Boolean(agentProfile?.agent_type);
  const tabs = isAgentProfile ? AGENT_TABS : MEMBER_TABS;
  const canFriend = Boolean(
    profile &&
      !owner &&
      friendshipAllowed(
        { account_type: viewerIsAgent ? "agent" : "personal" },
        viewerIsAgent ? "agent" : "personal",
        { account_type: isAgentProfile ? "agent" : profile.account_type, agent_type: agentProfile?.agent_type }
      )
  );
  const ratingAvg = Number(agentProfile?.agent_rating_avg || 0);
  const ratingCount = Number(agentProfile?.agent_rating_count || 0);
  const jobsCompleted = Number(agentProfile?.agent_completed_jobs_count || 0);

  useEffect(() => {
    if (!isAgentProfile || tab !== "reviews" || memberId <= 0) return;
    let cancelled = false;
    void agentApi.publicReviews(memberId).then((rows) => {
      if (!cancelled) setAgentReviews(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      if (!cancelled) setAgentReviews([]);
    });
    return () => {
      cancelled = true;
    };
  }, [isAgentProfile, memberId, tab]);

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
    if (deactivated) {
      showNotice({
        title: t("member.messageDeactivated"),
        message: t("member.messageDeactivatedBody"),
        tone: "info",
      });
      return;
    }
    if (blocked) {
      showNotice({
        title: t("member.block"),
        message: t("member.blockedBody"),
        tone: "info",
      });
      return;
    }
    setMessageBusy(true);
    try {
      const result = await createDirectConversation(userId);
      if (result && "pending" in result && result.pending) {
        showNotice({
          title: t("member.messageRequestedTitle"),
          message: result.message || t("member.messageRequestedBody", { name: profile?.name || "" }),
          tone: "success",
        });
        return;
      }
      if (result && "failed" in result && result.failed) {
        showNotice({
          title: t("member.messageFailed"),
          message: result.message || t("member.messageDeactivatedBody"),
          tone: "error",
        });
        return;
      }
      if (!result || !("conversationId" in result)) {
        showNotice({ title: t("member.messageFailed"), tone: "error" });
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
    if (blocked) {
      Alert.alert(t("member.unblockTitle"), t("member.unblockBody", { name: profile?.name || "" }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("member.unblock"),
          onPress: () => {
            void (async () => {
              setBlockBusy(true);
              const result = await unblockUser(userId);
              setBlockBusy(false);
              if (!result.success) {
                Alert.alert(t("member.unblockFailed"), result.message);
                return;
              }
              setBlocked(false);
              showNotice({ title: t("member.unblockedTitle"), message: t("member.unblockedBody"), tone: "success" });
            })();
          },
        },
      ]);
      return;
    }
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
            setBlocked(true);
            showNotice({ title: t("member.blockedTitle"), message: t("member.blockedBody"), tone: "success" });
          })();
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
          <JosCityLoader color={colors.primary} size="large" />
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
                ) : isAgentProfile ? (
                  <View style={styles.ratingChip} accessibilityLabel={t("member.ratingLabel", { rating: ratingAvg.toFixed(1) })}>
                    <Ionicons name="star" size={14} color="#E2B93B" />
                    <Text style={styles.ratingChipText}>{ratingAvg.toFixed(1)}</Text>
                    {ratingCount > 0 ? <Text style={styles.ratingChipCount}>({ratingCount})</Text> : null}
                  </View>
                ) : (
                  <View style={styles.gearBtn} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.kicker}>
                {isAgentProfile ? t("member.agentKicker") : profile?.name || t("member.kicker")}
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
                  <AvatarCircle name={profile.name} uri={profile.picture} size={96} preview />
                </View>
                <View style={styles.identity}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{profile.name}</Text>
                    <BusinessVerifiedBadge
                      color={profile.badge_color}
                      verified={profile.verified}
                      accountType={isAgentProfile ? "agent" : "personal"}
                      size={18}
                    />
                  </View>
                  <Text style={styles.handle}>{profile.handle}</Text>
                  {profile.bio || agentProfile?.agent_bio ? (
                    <Text selectable style={styles.bio}>{agentProfile?.agent_bio || profile.bio}</Text>
                  ) : null}
                  {isAgentProfile ? (
                    <>
                      <Text style={styles.metrics}>
                        {t("member.ratingLabel", { rating: ratingAvg.toFixed(1) })}
                        {` · ${t("member.jobsCount", { count: jobsCompleted.toLocaleString("en-NG") })}`}
                      </Text>
                      <Text style={styles.handle}>
                        {agentProfile?.agent_accepting_requests
                          ? t("member.aboutAcceptingYes")
                          : t("member.aboutAcceptingNo")}
                      </Text>
                    </>
                  ) : (
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
                  )}
                  {!isAgentProfile ? (
                    <Pressable
                      onPress={() => router.push({ pathname: "/people/[id]/friends", params: { id: String(profile.user_id), name: profile.name } })}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${profile.name}'s friends`}
                      style={styles.friendsLink}
                    >
                      <Ionicons name="people-outline" size={15} color={colors.primary} />
                      <Text style={styles.friendsLinkText}>View friends</Text>
                    </Pressable>
                  ) : null}
                  {deactivated || profile.membership_label ? (
                    <View style={styles.badges}>
                      {deactivated ? (
                        <View style={[styles.badge, styles.badgeDeactivated]}>
                          <Text style={styles.badgeDeactivatedText}>
                            {accountStatusLabel("deactivated", t)}
                          </Text>
                        </View>
                      ) : null}
                      {profile.membership_label ? (
                        <View style={[styles.badge, styles.badgeGold]}>
                          <Text style={styles.badgeGoldText}>{profile.membership_label}</Text>
                        </View>
                      ) : null}
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
                      {canFriend ? (
                        <FriendActionButton
                          userId={profile.user_id}
                          name={profile.name}
                          layout="bar"
                          accountType={isAgentProfile ? "agent" : profile.account_type}
                          agentType={agentProfile?.agent_type}
                        />
                      ) : isAgentProfile && !owner ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/agent-services/request",
                              params: { agent: String(profile.user_id) },
                            } as never)
                          }
                          disabled={!agentProfile?.agent_accepting_requests || blocked}
                          style={[
                            styles.actionPrimary,
                            styles.actionGrow,
                            (!agentProfile?.agent_accepting_requests || blocked) && styles.actionDisabled,
                          ]}
                        >
                          <Ionicons name="bag-handle-outline" size={16} color={colors.white} />
                          <Text style={styles.actionPrimaryText}>{t("member.requestAgent")}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => void onMessage()}
                        disabled={messageBusy || deactivated || blocked}
                        style={[
                          styles.actionSecondary,
                          styles.actionGrow,
                          (deactivated || blocked) && styles.actionDisabled,
                        ]}
                      >
                        {messageBusy ? (
                          <JosCityLoader color={colors.primary} size="small" />
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
                        accessibilityLabel={blocked ? t("member.unblock") : t("member.block")}
                      >
                        {blockBusy ? (
                          <JosCityLoader color={colors.primary} size="small" />
                        ) : (
                          <>
                            <Ionicons name={blocked ? "checkmark-circle-outline" : "ban-outline"} size={16} color={colors.error} />
                            <Text style={[styles.actionSecondaryText, { color: colors.error }]}>
                              {blocked ? t("member.unblock") : t("member.block")}
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
                {tabs.map((key) => (
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
                    <PostCard
                      key={post.post_id}
                      post={post as FeedPost}
                      viewerId={viewerId}
                      onDeleted={(deletedId) =>
                        setData((current) =>
                          current
                            ? {
                                ...current,
                                posts: current.posts.filter((item) => Number(item.post_id) !== deletedId),
                              }
                            : current
                        )
                      }
                    />
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

              {tab === "catalogue" && isAgentProfile ? (
                <View style={styles.catalogueWrap}>
                  <AgentSourcedCatalogue
                    agentName={profile.name.split(" ")[0] || profile.name}
                    agentUserId={profile.user_id}
                  />
                </View>
              ) : null}

              {tab === "reviews" && isAgentProfile ? (
                agentReviews.length ? (
                  <View style={styles.about}>
                    {agentReviews.map((review) => (
                      <View key={review.review_id} style={styles.reviewCard}>
                        <View style={styles.reviewHead}>
                          <Text style={styles.reviewName}>{review.reviewer_name}</Text>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((value) => (
                              <Ionicons
                                key={value}
                                name={value <= review.rating ? "star" : "star-outline"}
                                size={14}
                                color={value <= review.rating ? "#E2B93B" : colors.textMuted}
                              />
                            ))}
                          </View>
                        </View>
                        {review.comment ? <Text selectable style={styles.bio}>{review.comment}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>{t("member.reviewsEmpty")}</Text>
                )
              ) : null}

              {tab === "about" ? (
                <View style={styles.about}>
                  <AboutRow label={t("member.aboutBio")} value={agentProfile?.agent_bio || profile.bio || "—"} />
                  {isAgentProfile ? (
                    <>
                      <AboutRow label={t("member.aboutServices")} value={agentServicesLabel(agentProfile?.agent_type)} />
                      <AboutRow
                        label={t("member.aboutSpecialties")}
                        value={
                          agentProfile?.categories?.length
                            ? agentProfile.categories.map((item) => item.name).join(", ")
                            : "—"
                        }
                      />
                      <AboutRow
                        label={t("member.aboutAccepting")}
                        value={
                          agentProfile?.agent_accepting_requests
                            ? t("member.aboutAcceptingYes")
                            : t("member.aboutAcceptingNo")
                        }
                      />
                      <AboutRow label={t("member.aboutRating")} value={`${ratingAvg.toFixed(1)}${ratingCount ? ` (${ratingCount})` : ""}`} />
                      <AboutRow label={t("member.aboutJobs")} value={String(jobsCompleted)} />
                      <AboutRow label={t("member.aboutLevel")} value={agentProfile?.star_level?.label || "Agent"} />
                      <AboutRow
                        label={t("member.aboutAreas")}
                        value={
                          agentProfile?.agent_working_areas?.length
                            ? agentProfile.agent_working_areas.join(", ")
                            : "—"
                        }
                      />
                      {agentProfile?.agent_transport_mode ? (
                        <AboutRow label={t("member.aboutTransport")} value={agentProfile.agent_transport_mode} />
                      ) : null}
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
        contentType={isAgentProfile ? "agent" : "profile"}
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
    friendsLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "center",
      marginTop: 8,
    },
    friendsLinkText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 13,
      color: colors.primary,
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
    badgeDeactivated: {
      backgroundColor: "rgba(180, 35, 24, 0.12)",
    },
    badgeDeactivatedText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.error,
    },
    actionDisabled: {
      opacity: 0.45,
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
    catalogueWrap: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    reviewCard: {
      backgroundColor: colors.sheet,
      borderRadius: 16,
      padding: 14,
      gap: 8,
      marginBottom: 10,
    },
    reviewHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    reviewName: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    reviewStars: {
      flexDirection: "row",
      gap: 2,
    },
    ratingChip: {
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.sheet,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginRight: 8,
    },
    ratingChipText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 14,
      color: colors.text,
    },
    ratingChipCount: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 12,
      color: colors.textMuted,
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
