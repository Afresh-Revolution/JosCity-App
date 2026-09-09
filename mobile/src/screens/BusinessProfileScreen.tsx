import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
import BusinessAccountSheet from "../components/BusinessAccountSheet";
import FadeIn from "../components/FadeIn";
import SignOutSheet from "../components/SignOutSheet";
import BusinessVerifiedBadge from "../components/BusinessVerifiedBadge";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedImage from "../components/feed/FeedImage";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import PostCard from "../components/feed/PostCard";
import ReportSheet from "../components/ReportSheet";
import { showNotice } from "../components/AppNotice";
import {
  createDirectConversation,
  getBusinessMessageRequests,
} from "../api/chat";
import {
  getBusinessPage,
  toggleBusinessFollow,
  type BusinessPage,
} from "../api/marketplace";
import { getUserProfile } from "../api/auth";
import type { FeedPost } from "../api/feed";
import { useI18n } from "../i18n/I18nProvider";
import { registerPushTokenAfterLogin, unregisterPushTokenOnLogout } from "../push/pushNotifications";
import {
  clearLinkedSession,
  clearSession,
  getAccountType,
  getLinkedSession,
  getUser,
  hasSession,
  isBusinessAccountType,
  switchToSession,
  type StoredSession,
  type StoredUser,
} from "../storage/session";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { accountStatusKind, accountStatusLabel } from "../utils/accountStatus";
import { absoluteUrl, formatNaira, handleFromName } from "../utils/format";
import { openListing } from "../utils/openListing";
import { openMemberProfile } from "../utils/openProfile";

type TabKey = "posts" | "about" | "catalog" | "photos" | "reviews";

const TABS: TabKey[] = ["posts", "about", "catalog", "photos", "reviews"];

export default function BusinessProfileScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    name?: string | string[];
    picture?: string | string[];
    source?: string | string[];
  }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const businessId = Number(rawId);
  const previewName = String(
    Array.isArray(params.name) ? params.name[0] : params.name || ""
  ).trim();
  const previewPicture =
    String(Array.isArray(params.picture) ? params.picture[0] : params.picture || "").trim() ||
    null;
  const viewSource = String(
    Array.isArray(params.source) ? params.source[0] : params.source || "direct"
  ).trim() || "direct";
  const viewingOther = Number.isFinite(businessId) && businessId > 0;
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [data, setData] = useState<BusinessPage | null>(null);
  const [viewerId, setViewerId] = useState(0);
  const [tab, setTab] = useState<TabKey>("posts");
  const [customerView, setCustomerView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [personalSheetOpen, setPersonalSheetOpen] = useState(false);
  const [linkedSession, setLinkedSession] = useState<StoredSession | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await hasSession();
      if (cancelled) return;
      if (!ok) {
        router.replace("/login");
        return;
      }
      if (!viewingOther) {
        const type = await getAccountType();
        if (cancelled) return;
        if (!isBusinessAccountType(type)) {
          router.replace("/home");
          return;
        }
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, viewingOther]);

  const load = useCallback(async () => {
    const [page, user, requests, linked] = await Promise.all([
      getBusinessPage(viewingOther ? businessId : undefined, viewingOther ? viewSource : undefined),
      getUser(),
      viewingOther ? getBusinessMessageRequests() : Promise.resolve({ incoming: [], outgoing: [] }),
      getLinkedSession(),
    ]);
    const fallback = pageFromKnownUser({
      user,
      linked,
      viewingOther,
      businessId,
      previewName,
      previewPicture,
    });
    const next = mergeBusinessPage(page, fallback);
    setData(next);
    setLoadError(next ? null : t("business.profileLoadError"));
    setViewerId(Number(user?.user_id || 0));
    setLinkedSession(linked);
    const targetId = Number(next?.profile?.user_id || businessId || 0);
    setMessagePending(
      requests.outgoing.some(
        (row) =>
          row.status === "pending" &&
          Number(row.businessUserId || 0) === targetId
      )
    );
  }, [businessId, previewName, previewPicture, t, viewingOther, viewSource]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void (async () => {
        try {
          await load();
        } finally {
          setLoading(false);
        }
      })();
    }, [allowed, load])
  );

  useEffect(() => {
    setCustomerView(false);
    setTab("posts");
  }, [businessId]);

  const profile = data?.profile;
  const isActualOwner = Boolean(profile?.is_owner);
  const owner = isActualOwner && !customerView;
  const deactivated = accountStatusKind(profile) === "deactivated";
  const linkedIsBusiness = isBusinessAccountType(linkedSession?.accountType);
  const switchTarget = linkedSession && !linkedIsBusiness ? linkedSession : null;
  const switchTitle = t("profile.personalAccount");
  const switchSubtitle = switchTarget
    ? displayNameFor(switchTarget.user)
    : t("profile.businessAccountSub");

  const applySwitchedSession = useCallback(
    async (session: StoredSession) => {
      await unregisterPushTokenOnLogout();
      await switchToSession(session);
      setPersonalSheetOpen(false);
      void registerPushTokenAfterLogin();
      router.replace(
        (isBusinessAccountType(session.accountType) ? "/business" : "/home") as never
      );
    },
    [router]
  );

  const switchAccount = useCallback(async () => {
    if (switchingAccount) return;
    if (!switchTarget) {
      setPersonalSheetOpen(true);
      return;
    }

    setSwitchingAccount(true);
    try {
      const probe = await getUserProfile({
        token: switchTarget.token,
        skipUnauthorized: true,
      });
      if (!probe.success) {
        await clearLinkedSession();
        setLinkedSession(null);
        setPersonalSheetOpen(true);
        return;
      }
      await applySwitchedSession({
        ...switchTarget,
        user: { ...switchTarget.user, ...(probe.user || {}) },
      });
    } finally {
      setSwitchingAccount(false);
    }
  }, [applySwitchedSession, switchTarget, switchingAccount]);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await unregisterPushTokenOnLogout();
    await clearSession();
    setSignOutOpen(false);
    router.replace("/welcome");
  };

  const onCall = () => {
    const phone = String(profile?.phone || "").replace(/\s/g, "");
    if (!phone) return;
    void Linking.openURL(`tel:${phone}`);
  };

  const onShare = () => {
    const name = profile?.name || "JosCity business";
    const handle = profile?.handle || "";
    void Share.share({
      message: `${name} ${handle} on JosCity\nhttps://joscity.com/business/${profile?.user_id || ""}`,
    });
  };

  const onFollow = async () => {
    const userId = Number(profile?.user_id || 0);
    if (!userId || followBusy) return;
    const wasFollowing = Boolean(profile?.following);
    if (wasFollowing) {
      Alert.alert(t("business.unfollowTitle"), t("business.unfollowBody", { name: profile?.name || "" }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("business.unfollow"),
          style: "destructive",
          onPress: () => void toggleFollow(userId, wasFollowing),
        },
      ]);
      return;
    }
    await toggleFollow(userId, wasFollowing);
  };

  const toggleFollow = async (userId: number, wasFollowing: boolean) => {
    setFollowBusy(true);
    const next = await toggleBusinessFollow(userId);
    setFollowBusy(false);
    if (next == null) {
      Alert.alert(t("business.followFailed"));
      return;
    }
    setData((current) => {
      if (!current) return current;
      const delta = next === wasFollowing ? 0 : next ? 1 : -1;
      return {
        ...current,
        profile: {
          ...current.profile,
          following: next,
          follower_count: Math.max(0, Number(current.profile.follower_count || 0) + delta),
        },
      };
    });
  };

  const onMessage = async () => {
    const userId = Number(profile?.user_id || 0);
    if (!userId || messageBusy) return;
    if (deactivated) {
      showNotice({
        title: t("business.messageDeactivated"),
        message: t("business.messageDeactivatedBody"),
        tone: "info",
      });
      return;
    }
    if (messagePending) {
      showNotice({
        title: t("business.messageRequestedTitle"),
        message: t("business.messageRequestedBody", { name: profile?.name || "" }),
        tone: "info",
      });
      return;
    }
    setMessageBusy(true);
    try {
      const result = await createDirectConversation(userId);
      if (result && "pending" in result && result.pending) {
        setMessagePending(true);
        showNotice({
          title: t("business.messageRequestedTitle"),
          message: result.message || t("business.messageRequestedBody", { name: profile?.name || "" }),
          tone: "success",
        });
        return;
      }
      if (result && "failed" in result && result.failed) {
        showNotice({
          title: t("business.messageFailed"),
          message: result.message || t("business.messageDeactivatedBody"),
          tone: "error",
        });
        return;
      }
      if (!result || !("conversationId" in result)) {
        showNotice({ title: t("business.messageFailed"), tone: "error" });
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

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <JosCityLoader color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab={viewingOther ? "explore" : "profile"}
      header={
        viewingOther ? (
          <View />
        ) : (
          <FadeIn duration={480} translateY={8}>
            <View style={styles.headerBar}>
              <View style={styles.headerCopy}>
                <Text style={styles.headerKicker}>{t("profile.tabKicker")}</Text>
                <Text style={styles.headerTitle}>{t("profile.title")}</Text>
              </View>
              <Pressable
                onPress={() => router.push("/profile/settings")}
                style={styles.gearBtn}
                accessibilityRole="button"
                accessibilityLabel={t("profile.settingsHint")}
              >
                <Ionicons name="settings-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </FadeIn>
        )
      }
    >
      {loading && !data ? (
        <View style={styles.centered}>
          <JosCityLoader color={colors.primary} size="large" />
        </View>
      ) : !data ? (
        <ScrollView
          contentContainerStyle={styles.centered}
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
          <Text style={styles.empty}>{loadError || t("business.profileLoadError")}</Text>
        </ScrollView>
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
          <FadeIn>
            {viewingOther ? (
              <>
                <Pressable
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}
                  style={styles.back}
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <Text numberOfLines={1} style={styles.kicker}>
                  {profile?.name || previewName || t("business.fallbackName")}
                </Text>
                <Text style={styles.title}>{t("nav.business")}</Text>
              </>
            ) : null}
          </FadeIn>

          <FadeIn delay={40}>
            <View style={styles.hero}>
              {profile?.cover ? (
                <FeedImage uri={absoluteUrl(profile.cover) || profile.cover} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]} />
              )}
              <View style={styles.avatarWrap}>
                <AvatarCircle
                  name={profile?.name || previewName}
                  uri={profile?.picture || previewPicture}
                  size={72}
                  preview
                />
              </View>
            </View>
            <View style={styles.identity}>
              <View style={styles.nameRow}>
                <Text style={styles.shopName}>{profile?.name}</Text>
                <BusinessVerifiedBadge
                  color={profile?.badge_color}
                  hasCac={Boolean(profile?.cac_verified)}
                  verified
                  accountType="business"
                  size={18}
                />
              </View>
              <Text style={styles.handle}>{profile?.email || profile?.handle}</Text>
              <Text style={styles.category}>{profile?.category}</Text>
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {profile?.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.location}>{profile.location}</Text>
                </View>
              ) : null}
              <Text style={styles.metrics}>
                {Number(profile?.follower_count || 0).toLocaleString("en-NG")} followers
                {profile?.rating_count
                  ? ` · ${profile.rating_average.toFixed(1)} · ${profile.rating_count} reviews`
                  : ""}
                {profile?.reply_label ? ` · ${profile.reply_label}` : ""}
              </Text>
              <View style={styles.badges}>
                {deactivated ? (
                  <View style={[styles.badge, styles.badgeDeactivated]}>
                    <Text style={styles.badgeDeactivatedText}>
                      {accountStatusLabel("deactivated", t)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.badge, profile?.is_open ? styles.badgeOpen : styles.badgeMuted]}>
                  <Text style={[styles.badgeText, profile?.is_open && styles.badgeTextOpen]}>
                    {profile?.is_open ? t("business.profileOpen") : t("business.profileClosed")}
                    {profile?.hours_label ? ` ${profile.hours_label}` : ""}
                  </Text>
                </View>
                {profile?.cac_verified ? (
                  <View style={[styles.badge, styles.badgeOpen]}>
                    <Text style={[styles.badgeText, styles.badgeTextOpen]}>CAC VERIFIED</Text>
                  </View>
                ) : profile?.has_cac ? (
                  <View style={[styles.badge, styles.badgeMuted]}>
                    <Text style={styles.badgeText}>{t("business.cacPending")}</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeNoCac]}>
                    <Text style={styles.badgeNoCacText}>{t("business.noCac")}</Text>
                  </View>
                )}
                {profile?.membership_label ? (
                  <View style={[styles.badge, styles.badgeGold]}>
                    <Text style={styles.badgeGoldText}>{profile.membership_label}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={70}>
            {isActualOwner ? (
              <View style={styles.actions}>
                {owner ? (
                  <Pressable
                    onPress={() => router.push("/profile/personal-details")}
                    style={[styles.actionPrimary, styles.actionGrow]}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.white} />
                    <Text style={styles.actionPrimaryText}>{t("business.profileEdit")}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setCustomerView((value) => !value)}
                  style={[styles.actionSecondary, styles.actionGrow]}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.text} />
                  <Text style={styles.actionSecondaryText}>
                    {customerView ? t("business.profileOwnerView") : t("business.profileCustomerView")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {!isActualOwner ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void onFollow()}
                  disabled={followBusy}
                  style={[
                    profile?.following ? styles.actionSecondary : styles.actionPrimary,
                    styles.actionGrow,
                  ]}
                >
                  {followBusy ? (
                    <JosCityLoader
                      color={profile?.following ? colors.primary : colors.white}
                      size="small"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={profile?.following ? "checkmark" : "person-add-outline"}
                        size={16}
                        color={profile?.following ? colors.text : colors.white}
                      />
                      <Text
                        style={
                          profile?.following ? styles.actionSecondaryText : styles.actionPrimaryText
                        }
                      >
                        {profile?.following ? t("business.following") : t("business.follow")}
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void onMessage()}
                  disabled={messageBusy || deactivated}
                  style={[
                    styles.actionSecondary,
                    styles.actionGrow,
                    deactivated && styles.actionDisabled,
                  ]}
                >
                  {messageBusy ? (
                    <JosCityLoader color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
                      <Text style={styles.actionSecondaryText}>
                        {messagePending ? t("business.messageRequested") : t("business.message")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
            <View style={styles.actions}>
              {!isActualOwner ? (
                <Pressable onPress={onCall} style={[styles.actionSecondary, styles.actionGrow]}>
                  <Ionicons name="call-outline" size={16} color={colors.text} />
                  <Text style={styles.actionSecondaryText}>{t("business.profileCall")}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onShare} style={[styles.actionSecondary, styles.actionGrow]}>
                <Ionicons name="share-outline" size={16} color={colors.text} />
                <Text style={styles.actionSecondaryText}>{t("business.profileShare")}</Text>
              </Pressable>
            </View>
            {!isActualOwner ? (
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
            ) : null}
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
                  {t(`business.profileTab.${key}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {tab === "posts" ? (
            data?.posts.length ? (
              data.posts.map((post) => (
                <PostCard
                  key={post.post_id}
                  post={post as FeedPost}
                  viewerId={viewerId}
                />
              ))
            ) : (
              <Text style={styles.empty}>{t("No business posts yet")}</Text>
            )
          ) : null}

          {tab === "about" ? (
            <View style={styles.about}>
              <AboutRow label={t("business.profileAboutBio")} value={profile?.bio || "—"} />
              <AboutRow
                label={t("details.cac")}
                value={
                  profile?.cac_verified
                    ? t("details.cacVerified")
                    : profile?.has_cac
                      ? t("business.cacPending")
                      : t("business.noCac")
                }
              />
              <AboutRow label={t("business.profileAboutHours")} value={profile?.hours_label || "—"} />
              <AboutRow
                label={t("business.profileAboutLocation")}
                value={profile?.location || "—"}
                onPress={
                  profile?.location
                    ? () =>
                        void Linking.openURL(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location || "")}`
                        )
                    : undefined
                }
              />
              <AboutRow label={t("business.profileAboutCategory")} value={profile?.category || "—"} />
            </View>
          ) : null}

          {tab === "catalog" ? (
            data?.catalog.length ? (
              data.catalog.map((item) => {
                const service = item.listing_kind === "service";
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openListing(router, item.id, viewingOther ? viewSource : "direct")}
                    style={styles.catalogRow}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: absoluteUrl(item.image_url) }} style={styles.catalogImage} />
                    ) : (
                      <View style={styles.catalogFallback}>
                        <Ionicons
                          name={service ? "calendar-outline" : "cube-outline"}
                          size={18}
                          color={colors.textMuted}
                        />
                      </View>
                    )}
                    <View style={styles.catalogCopy}>
                      <Text style={styles.catalogTitle}>{item.title}</Text>
                      <Text style={styles.catalogPrice}>
                        {formatNaira(item.price)}
                        {item.unit ? ` · ${item.unit}` : ""}
                      </Text>
                    </View>
                    <View style={styles.catalogAction}>
                      <Text style={styles.catalogActionText}>
                        {service ? t("listing.book") : t("listing.buy")}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.empty}>{t("business.profileCatalogEmpty")}</Text>
            )
          ) : null}

          {tab === "photos" ? (
            data?.photos.length ? (
              <View style={styles.photoGrid}>
                {data.photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => {
                      if (photo.source === "catalog" && photo.listing_id) {
                        openListing(router, photo.listing_id, viewingOther ? viewSource : "direct");
                        return;
                      }
                      if (photo.source === "post") {
                        const postId = String(photo.id).replace(/^post-/, "");
                        if (postId) router.push(`/post/${postId}`);
                      }
                    }}
                    style={styles.photoWrap}
                  >
                    <FeedImage
                      uri={absoluteUrl(photo.url) || photo.url}
                      style={styles.photo}
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>{t("business.profilePhotosEmpty")}</Text>
            )
          ) : null}

          {tab === "reviews" ? (
            data?.reviews.items.length ? (
              data.reviews.items.map((review) => (
                <Pressable
                  key={review.id}
                  onPress={() => {
                    if (review.reviewer_user_id) {
                      openMemberProfile(router, review.reviewer_user_id);
                    }
                  }}
                  style={styles.reviewRow}
                >
                  <AvatarCircle name={review.reviewer_name} uri={review.reviewer_picture} size={36} />
                  <View style={styles.catalogCopy}>
                    <Text style={styles.catalogTitle}>{review.reviewer_name}</Text>
                    <Text style={styles.reviewMeta}>
                      {review.rating.toFixed(1)} · {review.comment || t("business.profileReviewNoComment")}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.empty}>{t("business.profileReviewsEmpty")}</Text>
            )
          ) : null}

        </ScrollView>
      )}
      <BusinessAccountSheet
        visible={personalSheetOpen}
        mode="personal"
        onClose={() => setPersonalSheetOpen(false)}
        onLinked={applySwitchedSession}
      />
      <SignOutSheet
        visible={signOutOpen}
        busy={signingOut}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => void confirmSignOut()}
      />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="profile"
        contentId={profile?.user_id || businessId}
        reportedUserId={Number(profile?.user_id || businessId) || null}
      />
    </FeedShell>
  );
}

function displayNameFor(user: StoredUser | null | undefined): string {
  const business = String(user?.business_name || "").trim();
  if (isBusinessAccountType(String(user?.account_type)) && business) return business;
  return (
    user?.display_name ||
    [user?.user_firstname || user?.first_name, user?.user_lastname || user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    business ||
    "JosCity member"
  );
}

function isPlaceholderShopName(name?: string | null) {
  const value = String(name || "").trim().toLowerCase();
  return !value || value === "your business";
}

function isPlaceholderHandle(handle?: string | null) {
  const value = String(handle || "").trim().toLowerCase();
  return !value || value === "@business";
}

function storedUserId(user?: StoredUser | null) {
  return Number(user?.user_id || 0);
}

function shopNameFromUser(user?: StoredUser | null, fallback = "") {
  return (
    String(user?.business_name || "").trim() ||
    String(user?.display_name || "").trim() ||
    [user?.user_firstname || user?.first_name, user?.user_lastname || user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fallback
  );
}

function pageFromUser(
  user: StoredUser,
  extras: { userId?: number; isOwner: boolean; picture?: string | null }
): BusinessPage {
  const name = shopNameFromUser(user);
  const picture =
    extras.picture || String(user.user_picture || user.picture || "").trim() || null;
  const userId = extras.userId || storedUserId(user);
  return {
    profile: {
      user_id: userId,
      name,
      handle: name ? handleFromName(name) : "",
      category: String(user.business_type || "").trim(),
      bio: String(user.business_description || user.user_bio || "").trim() || null,
      location: String(user.business_location || user.address || "").trim() || null,
      picture,
      cover: String(user.user_cover || "").trim() || picture,
      phone: String(user.business_phone || user.user_phone || "").trim() || null,
      email:
        String(user.business_email || user.user_email || user.email || "").trim() || null,
      verified: Boolean(user.is_verified || user.user_verified),
      has_cac: Boolean(String(user.cac_number || user.CAC_number || "").trim()),
      cac_verified: Boolean(user.cac_verified),
      cac_number: String(user.cac_number || user.CAC_number || "").trim() || null,
      hours_open: "",
      hours_close: "",
      hours_days: [],
      hours_label: "",
      is_open: false,
      membership_label: null,
      follower_count: 0,
      rating_average: 0,
      rating_count: 0,
      reply_label: "",
      following: false,
      is_owner: extras.isOwner,
    },
    posts: [],
    catalog: [],
    photos: [],
    reviews: { average: 0, count: 0, items: [] },
  };
}

function pageFromKnownUser(params: {
  user: StoredUser | null;
  linked: StoredSession | null;
  viewingOther: boolean;
  businessId: number;
  previewName: string;
  previewPicture: string | null;
}): BusinessPage | null {
  const myId = storedUserId(params.user);
  const linkedId = storedUserId(params.linked?.user);
  const targetId = params.viewingOther ? params.businessId : myId;
  const ownShop =
    (!params.viewingOther && isBusinessAccountType(params.user?.account_type)) ||
    (targetId > 0 && targetId === myId) ||
    (targetId > 0 && isBusinessAccountType(params.linked?.accountType) && targetId === linkedId);

  if (ownShop && params.user && isBusinessAccountType(params.user.account_type) && (!params.viewingOther || targetId === myId)) {
    return pageFromUser(params.user, {
      userId: targetId || myId,
      isOwner: true,
      picture: params.previewPicture,
    });
  }
  if (ownShop && params.linked?.user && targetId === linkedId) {
    return pageFromUser(params.linked.user, {
      userId: targetId,
      isOwner: true,
      picture: params.previewPicture,
    });
  }
  if (params.previewName) {
    return pageFromUser(
      {
        display_name: params.previewName,
        user_picture: params.previewPicture,
        user_id: targetId,
      },
      { userId: targetId, isOwner: ownShop, picture: params.previewPicture }
    );
  }
  return null;
}

function mergeBusinessPage(
  page: BusinessPage | null,
  fallback: BusinessPage | null
): BusinessPage | null {
  if (!page) return fallback;
  if (!fallback) {
    if (isPlaceholderShopName(page.profile.name)) return page;
    return page;
  }
  const name = isPlaceholderShopName(page.profile.name)
    ? fallback.profile.name
    : page.profile.name;
  return {
    ...page,
    profile: {
      ...fallback.profile,
      ...page.profile,
      name: name || fallback.profile.name,
      handle: isPlaceholderHandle(page.profile.handle)
        ? fallback.profile.handle
        : page.profile.handle,
      picture: page.profile.picture || fallback.profile.picture,
      cover: page.profile.cover || fallback.profile.cover,
      is_owner: Boolean(page.profile.is_owner || fallback.profile.is_owner),
    },
  };
}

function AboutRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const inner = (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.textMuted }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontFamily: "Montserrat_400Regular",
          fontSize: 15,
          color: onPress ? colors.success : colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {inner}
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
      marginBottom: 12,
    },
    hero: {
      marginHorizontal: 16,
      borderRadius: 18,
      overflow: "visible",
      marginBottom: 44,
    },
    cover: {
      width: "100%",
      height: 168,
      borderRadius: 18,
      backgroundColor: colors.sheet,
    },
    coverFallback: {
      backgroundColor: colors.iconSoft,
    },
    avatarWrap: {
      position: "absolute",
      left: 12,
      bottom: -36,
      borderWidth: 3,
      borderColor: colors.background,
      borderRadius: 40,
    },
    identity: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    shopName: {
      flexShrink: 1,
      fontFamily: "Montserrat_700Bold",
      fontSize: 22,
      color: colors.text,
    },
    handle: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    category: {
      marginTop: 2,
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
    },
    locationRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    location: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    metrics: {
      marginTop: 10,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeOpen: {
      backgroundColor: colors.iconSoft,
    },
    badgeMuted: {
      backgroundColor: colors.sheet,
    },
    badgeGold: {
      backgroundColor: colors.greetingBg,
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
    badgeNoCac: {
      backgroundColor: "#FFF4E8",
    },
    badgeNoCacText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.warning,
    },
    badgeText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 10,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    badgeTextOpen: {
      color: colors.success,
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
    catalogRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    catalogImage: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    catalogFallback: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
    },
    catalogCopy: {
      flex: 1,
      marginLeft: 12,
    },
    catalogTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.text,
    },
    catalogPrice: {
      marginTop: 2,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.primary,
    },
    catalogAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginLeft: 8,
    },
    catalogActionText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 12,
      color: colors.success,
    },
    photoWrap: {
      width: "31%",
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    photo: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: colors.sheet,
    },
    reviewRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    reviewMeta: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: colors.textMuted,
    },
    menu: {
      marginTop: 18,
      marginHorizontal: 16,
      borderRadius: 18,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    menuBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.sheet,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    menuGrow: {
      flex: 1,
    },
    signOutIcon: {
      backgroundColor: "#FDE8E6",
    },
    signOutText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.error,
    },
  });
}
