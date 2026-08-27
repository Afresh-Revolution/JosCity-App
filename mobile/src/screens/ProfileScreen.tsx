import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import BusinessAccountSheet from "../components/BusinessAccountSheet";
import SignOutSheet from "../components/SignOutSheet";
import FadeIn from "../components/FadeIn";
import SoonBadge from "../components/SoonBadge";
import AvatarCircle from "../components/feed/AvatarCircle";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getUserProfile, uploadProfilePicture } from "../api/auth";
import { getSavedPostsCount } from "../api/feed";
import { getAccount, getPoints, getWallet } from "../api/account";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useMembershipSettings } from "../hooks/useMembershipSettings";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import { useI18n } from "../i18n/I18nProvider";
import { registerPushTokenAfterLogin, unregisterPushTokenOnLogout } from "../push/pushNotifications";
import {
  clearLinkedSession,
  clearSession,
  getLinkedSession,
  getUser,
  isBusinessAccountType,
  setUser,
  switchToSession,
  type StoredSession,
  type StoredUser,
} from "../storage/session";
import { nudgeRatingPrompt } from "../state/ratingPrompt";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import { formatMemberDisplayId, readNumericUserId } from "../utils/memberDisplayId";
import { resolveAccountBadgeColor } from "../utils/badgeColor";
import {
  accountStatusCopy,
  accountStatusKind,
  accountStatusLabel,
  accountStatusTone,
  isTruthyFlag,
} from "../utils/accountStatus";

type ProfileUser = StoredUser & {
  nin_number?: string;
  nin_verified?: boolean | string | number;
  address?: string;
  user_phone?: string;
  user_email?: string;
  user_verified?: boolean | string | number;
  is_verified?: boolean | string | number;
  account_status?: string;
  user_approved?: boolean | string | number;
  user_activated?: boolean | string | number;
  user_banned?: boolean | string | number;
  banned?: boolean | string | number;
  user_registered?: string | number | null;
  created_at?: string | number | null;
  member_since?: string | number | null;
};

type MenuRow = {
  title: string;
  subtitle: string;
  comingSoon?: boolean;
  soonLabel?: string;
  onPress?: () => void;
};

function displayNameFor(user: ProfileUser | StoredUser | null): string {
  const business = String(user?.business_name || "").trim();
  if (isBusinessAccountType(String(user?.account_type)) && business) return business;
  return (
    user?.display_name ||
    business ||
    [user?.first_name || user?.user_firstname, user?.last_name || user?.user_lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "JosCity member"
  );
}

function accountEmail(user: ProfileUser | StoredUser | null): string {
  return String(user?.user_email || user?.email || user?.business_email || "").trim();
}

function MenuItem({
  item,
  last,
}: {
  item: MenuRow;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeProfileStyles(colors), [colors]);
  const body = (
    <>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.rowDescription}>{item.subtitle}</Text> : null}
      </View>
      {item.comingSoon ? (
        <SoonBadge label={item.soonLabel} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </>
  );

  if (item.comingSoon || !item.onPress) {
    return <View style={[styles.row, !last && styles.rowBorder]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {body}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const allowed = useRequirePersonalAccount();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => makeProfileStyles(colors), [colors]);
  const router = useRouter();
  const { enabled, label } = useAppFeatures();
  const { personalEnabled, personalPlan } = useMembershipSettings();
  const [user, setProfileUser] = useState<ProfileUser | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [cbcPoints, setCbcPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [businessSheetOpen, setBusinessSheetOpen] = useState(false);
  const [linkedSession, setLinkedSession] = useState<StoredSession | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    const stored = (await getUser()) as ProfileUser | null;
    if (stored) setProfileUser(stored);

    const [profile, saved, wallet, points, account] = await Promise.all([
      getUserProfile().catch(() => null),
      getSavedPostsCount().catch(() => 0),
      getWallet().catch(() => ({ success: false as const })),
      getPoints().catch(() => ({ success: false as const })),
      getAccount().catch(() => ({ success: false as const })),
    ]);

    setSavedCount(saved);
    setWalletBalance(wallet.success && wallet.data ? Number(wallet.data.balance || 0) : null);
    setCbcPoints(points.success && points.data ? Number(points.data.cbc || 0) : null);

    const accountData = account.success ? account.data : undefined;
    const mergedUser = {
      ...(stored || {}),
      ...(profile?.user || {}),
      ...(accountData
        ? {
            account_status:
              accountData.account_status ||
              (profile?.user as ProfileUser | undefined)?.account_status,
            banned: accountData.banned,
            member_since: accountData.member_since,
          }
        : {}),
    } as ProfileUser;

    if (profile?.user || accountData) {
      setProfileUser(mergedUser);
      await setUser(mergedUser);
    }

    setLinkedSession(await getLinkedSession());
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      let active = true;
      void (async () => {
        try {
          await load();
          if (!isBusinessAccountType(String((await getUser())?.account_type))) {
            nudgeRatingPrompt();
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [allowed, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const applyPicture = useCallback(async (url: string) => {
    const stored = (await getUser()) as ProfileUser | null;
    const next = {
      ...(stored || user || {}),
      user_picture: url,
      picture: url,
    } as ProfileUser;
    setProfileUser(next);
    await setUser(next);
  }, [user]);

  const uploadFromAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      setUploadingPhoto(true);
      const result = await uploadProfilePicture({
        uri: asset.uri,
        name: asset.fileName,
        mimeType: asset.mimeType,
      });
      setUploadingPhoto(false);
      if (!result.success || !result.user_picture) {
        Alert.alert("Could not update photo", result.message || "Please try again.");
        return;
      }
      await applyPicture(result.user_picture);
    },
    [applyPicture]
  );

  const pickPhoto = useCallback(
    async (source: "camera" | "library") => {
      if (uploadingPhoto) return;
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera"
            ? "Allow camera access to take a profile photo."
            : "Allow photo access to choose a profile picture."
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const picked =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets?.[0]) return;
      await uploadFromAsset(picked.assets[0]);
    },
    [uploadFromAsset, uploadingPhoto]
  );

  const changePhoto = () => {
    Alert.alert("Profile photo", "Upload or change your display picture", [
      { text: "Cancel", style: "cancel" },
      { text: "Take photo", onPress: () => void pickPhoto("camera") },
      { text: "Choose from library", onPress: () => void pickPhoto("library") },
    ]);
  };

  const numericId = readNumericUserId(user);
  const memberId = formatMemberDisplayId(numericId);
  const name = displayNameFor(user);
  const picture =
    (typeof user?.user_picture === "string" && user.user_picture) ||
    (typeof user?.picture === "string" && user.picture) ||
    null;
  const hasNin = Boolean(String(user?.nin_number || "").trim());
  const ninVerified =
    isTruthyFlag(user?.nin_verified) ||
    (hasNin && user?.nin_verified == null);
  const cacVerified = isTruthyFlag(user?.cac_verified);
  const isBusiness = isBusinessAccountType(String(user?.account_type));
  const verified = isBusiness
    ? cacVerified || isTruthyFlag(user?.user_verified) || isTruthyFlag(user?.is_verified)
    : ninVerified || isTruthyFlag(user?.user_verified) || isTruthyFlag(user?.is_verified);
  const badgeColor = resolveAccountBadgeColor({
    badge_color: typeof user?.badge_color === "string" ? user.badge_color : null,
    account_type: String(user?.account_type || "personal"),
    has_cac: Boolean(String(user?.CAC_number || user?.cac_number || "").trim()),
    cac_verified: Boolean(user?.cac_verified),
    verified,
  });
  const statusKind = accountStatusKind(user);
  const statusTone = accountStatusTone(statusKind);
  const viewMembershipId = async () => {
    if (!memberId && !numericId) {
      Alert.alert("Membership ID", "Your member ID is not available yet.");
      return;
    }
    const lines = [
      memberId ? `Member ID: ${memberId}` : null,
      numericId ? `Account #${numericId}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    Alert.alert("Digital membership ID", lines, [
      { text: "Close", style: "cancel" },
      {
        text: "Copy ID",
        onPress: () => {
          void Clipboard.setStringAsync(memberId || String(numericId));
        },
      },
    ]);
  };

  const openLegal = () => {
    router.push("/profile/legal");
  };

  const linkedIsBusiness = isBusinessAccountType(linkedSession?.accountType);
  const switchTarget = isBusiness
    ? linkedSession && !linkedIsBusiness
      ? linkedSession
      : null
    : linkedSession && linkedIsBusiness
      ? linkedSession
      : null;
  const switchTitle = isBusiness ? t("profile.personalAccount") : t("profile.businessAccount");
  const switchSubtitle = switchTarget
    ? displayNameFor(switchTarget.user)
    : isBusiness
      ? ""
      : t("profile.businessAccountSub");
  const showSwitchRow = !isBusiness || Boolean(switchTarget);

  const applySwitchedSession = useCallback(
    async (session: StoredSession) => {
      await unregisterPushTokenOnLogout();
      await switchToSession(session);
      setProfileUser(session.user as ProfileUser);
      setBusinessSheetOpen(false);
      void registerPushTokenAfterLogin();
      await load();
      router.replace((isBusinessAccountType(session.accountType) ? "/business" : "/home") as never);
    },
    [load, router]
  );

  const switchAccount = useCallback(async () => {
    if (switchingAccount) return;
    if (!isBusiness && !switchTarget) {
      setBusinessSheetOpen(true);
      return;
    }
    if (!switchTarget) return;

    setSwitchingAccount(true);
    try {
      const probe = await getUserProfile({
        token: switchTarget.token,
        skipUnauthorized: true,
      });
      if (!probe.success) {
        await clearLinkedSession();
        setLinkedSession(null);
        if (!isBusiness) {
          setBusinessSheetOpen(true);
          return;
        }
        Alert.alert(switchTitle, t("profile.businessSwitchFailed"));
        return;
      }
      await applySwitchedSession({
        ...switchTarget,
        user: { ...switchTarget.user, ...(probe.user || {}) },
      });
    } finally {
      setSwitchingAccount(false);
    }
  }, [
    applySwitchedSession,
    isBusiness,
    switchTarget,
    switchTitle,
    switchingAccount,
    t,
  ]);

  const signOut = () => {
    if (signingOut) return;
    setSignOutOpen(true);
  };

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await unregisterPushTokenOnLogout();
    await clearSession();
    setSignOutOpen(false);
    router.replace("/welcome");
  };

  const membershipLive = personalEnabled && enabled("membership");
  const rewardsLive = enabled("rewards");
  const walletLive = enabled("wallet");
  const cbcLive = enabled("cbc_points");

  const membershipRows: MenuRow[] = [
    {
      title: t("profile.personalDetails"),
      subtitle: t("profile.personalDetailsSub"),
      onPress: () => router.push("/profile/personal-details"),
    },
    ...(personalEnabled
      ? ([
          membershipLive
            ? {
                title: t("profile.membership"),
                subtitle:
                  personalPlan.items && personalPlan.items.length > 1
                    ? `${personalPlan.items.length} membership prices`
                    : personalPlan.description.trim()
                      ? personalPlan.description.trim()
                      : t("profile.membershipSub"),
                onPress: () => router.push("/profile/membership"),
              }
            : {
                title: t("profile.membership"),
                subtitle: label("membership"),
                comingSoon: true,
                soonLabel: label("membership"),
              },
        ] as MenuRow[])
      : []),
    rewardsLive
      ? {
          title: t("profile.rewards"),
          subtitle: t("profile.rewardsSub"),
          onPress: () => router.push("/profile/rewards"),
        }
      : {
          title: t("profile.rewards"),
          subtitle: label("rewards"),
          comingSoon: true,
          soonLabel: label("rewards"),
        },
  ];

  const accountRows: MenuRow[] = [
    {
      title: t("profile.verification"),
      subtitle: isBusiness
        ? cacVerified
          ? t("profile.verificationSubBusinessVerified")
          : t("profile.verificationSubBusiness")
        : ninVerified
          ? t("profile.verificationSubVerified")
          : t("profile.verificationSub"),
      onPress: () => router.push("/profile/verification"),
    },
    {
      title: t("profile.activity"),
      subtitle: t("profile.activitySub"),
      onPress: () => router.push("/profile/activity"),
    },
    {
      title: t("profile.referrals"),
      subtitle: t("profile.referralsSub"),
      onPress: () => router.push("/profile/referrals"),
    },
    walletLive
      ? {
          title: t("profile.wallet"),
          subtitle: t("profile.walletSub"),
          onPress: () => router.push("/profile/wallet"),
        }
      : {
          title: t("profile.wallet"),
          subtitle: label("wallet"),
          comingSoon: true,
          soonLabel: label("wallet"),
        },
    cbcLive
      ? {
          title: t("profile.cbc"),
          subtitle: t("profile.cbcSub"),
          onPress: () => router.push("/profile/cbc-points"),
        }
      : {
          title: t("profile.cbc"),
          subtitle: label("cbc_points"),
          comingSoon: true,
          soonLabel: label("cbc_points"),
        },
  ];

  const appRows: MenuRow[] = [
    {
      title: t("profile.notifications"),
      subtitle: t("profile.notificationsSub"),
      onPress: () => router.push("/notifications-settings"),
    },
    {
      title: t("profile.preferences"),
      subtitle: t("profile.preferencesSub"),
      onPress: () => router.push("/profile/preferences"),
    },
    {
      title: t("profile.account"),
      subtitle: user?.user_email || user?.email || t("profile.accountSub"),
      onPress: () => router.push("/profile/account-settings"),
    },
    {
      title: t("profile.saved"),
      subtitle: savedCount === 1 ? t("profile.savedOne") : t("profile.savedMany", { count: savedCount }),
      onPress: () => router.push("/profile/saved"),
    },
    {
      title: t("profile.help"),
      subtitle: t("profile.helpSub"),
      onPress: () => router.push("/profile/help"),
    },
    {
      title: t("profile.legal"),
      subtitle: t("profile.legalSub"),
      onPress: openLegal,
    },
  ];

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace((isBusiness ? "/business/profile" : "/profile") as never);
  };

  return (
    <>
    <FeedShell
      tab="profile"
      header={
        <FadeIn duration={480} translateY={8}>
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t("profile.kicker")}</Text>
              <Text style={styles.title}>{t("profile.settings")}</Text>
            </View>
          </View>
        </FadeIn>
      }
    >
      {loading && !user ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.primary}
            />
          }
        >
          <FadeIn>
            <View style={styles.identity}>
              <View style={styles.avatarWrap}>
                <AvatarCircle name={name} uri={picture} size={64} />
                <Pressable
                  onPress={changePhoto}
                  disabled={uploadingPhoto}
                  style={({ pressed }) => [
                    styles.cameraBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.changePhoto")}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Ionicons name="camera" size={12} color={colors.white} />
                  )}
                </Pressable>
              </View>
              <View style={styles.identityCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  {badgeColor ? (
                    <Ionicons name="checkmark-circle" size={18} color={badgeColor} />
                  ) : null}
                </View>
                {ninVerified ? (
                  <View style={styles.badgeRow}>
                    <View style={styles.ninBadge}>
                      <Text style={styles.ninText}>{t("profile.ninVerified")}</Text>
                    </View>
                  </View>
                ) : hasNin ? (
                  <View style={styles.badgeRow}>
                    <View style={styles.ninPendingBadge}>
                      <Text style={styles.ninPendingText}>{t("profile.ninPending")}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={60}>
            <View style={styles.stats}>
              <Pressable
                onPress={walletLive ? () => router.push("/profile/wallet") : undefined}
                disabled={!walletLive}
                style={styles.stat}
                accessibilityRole={walletLive ? "button" : undefined}
                accessibilityLabel="Wallet"
              >
                <Text style={styles.statLabel}>{t("profile.walletLabel")}</Text>
                {walletLive ? (
                  <Text style={styles.statValue}>
                    ₦{Number(walletBalance || 0).toLocaleString("en-NG")}
                  </Text>
                ) : (
                  <Text style={styles.statSoon}>{label("wallet")}</Text>
                )}
              </Pressable>
              <Pressable
                onPress={cbcLive ? () => router.push("/profile/cbc-points") : undefined}
                disabled={!cbcLive}
                style={[styles.stat, styles.statMid]}
                accessibilityRole={cbcLive ? "button" : undefined}
                accessibilityLabel="CBC points"
              >
                <Text style={styles.statLabel}>{t("profile.cbcLabel")}</Text>
                {cbcLive ? (
                  <Text style={styles.statValue}>
                    {Number(cbcPoints || 0).toLocaleString("en-NG", {
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                ) : (
                  <Text style={styles.statSoon}>{label("cbc_points")}</Text>
                )}
              </Pressable>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t("profile.savedLabel")}</Text>
                <Text style={styles.statValue}>{String(savedCount)}</Text>
              </View>
            </View>
          </FadeIn>

          <FadeIn delay={90}>
            <Pressable
              onPress={() => void viewMembershipId()}
              style={({ pressed }) => [styles.idButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("profile.memberId")}
            >
              <Ionicons name="id-card-outline" size={18} color={colors.text} />
              <Text style={styles.idButtonText}>{t("profile.memberId")}</Text>
            </Pressable>
          </FadeIn>

          <FadeIn delay={100}>
            <Text style={styles.section}>{t("profile.sectionStatus")}</Text>
            <View style={styles.list}>
              <Pressable
                onPress={() => router.push("/profile/account-settings")}
                style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("profile.statusAccount")}
              >
                <View style={styles.copy}>
                  <Text style={styles.rowTitle}>{t("profile.statusAccount")}</Text>
                  <Text style={styles.rowDescription}>
                    {isBusiness ? t("profile.statusBusiness") : t("profile.statusPersonal")}
                    {" · "}
                    {accountStatusCopy(statusKind, t)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    statusTone === "ok" && styles.statusBadgeOk,
                    statusTone === "warn" && styles.statusBadgeWarn,
                    statusTone === "danger" && styles.statusBadgeDanger,
                    statusTone === "muted" && styles.statusBadgeMuted,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      statusTone === "ok" && styles.statusBadgeTextOk,
                      statusTone === "warn" && styles.statusBadgeTextWarn,
                      statusTone === "danger" && styles.statusBadgeTextDanger,
                      statusTone === "muted" && styles.statusBadgeTextMuted,
                    ]}
                  >
                    {accountStatusLabel(statusKind, t)}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => router.push("/profile/verification")}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("profile.statusVerification")}
              >
                <View style={styles.copy}>
                  <Text style={styles.rowTitle}>{t("profile.statusVerification")}</Text>
                  <Text style={styles.rowDescription}>
                    {verified
                      ? isBusiness
                        ? t("profile.statusVerifiedSubBusiness")
                        : t("profile.statusVerifiedSub")
                      : isBusiness
                        ? t("profile.statusUnverifiedSubBusiness")
                        : t("profile.statusUnverifiedSub")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    verified ? styles.statusBadgeOk : styles.statusBadgeWarn,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      verified ? styles.statusBadgeTextOk : styles.statusBadgeTextWarn,
                    ]}
                  >
                    {verified ? t("profile.statusVerified") : t("profile.statusUnverified")}
                  </Text>
                </View>
              </Pressable>
            </View>
          </FadeIn>

          <FadeIn delay={120}>
            <Text style={styles.section}>{t("profile.sectionMembership")}</Text>
            <View style={styles.list}>
              {membershipRows.map((item, index) => (
                <MenuItem
                  key={item.title}
                  item={item}
                  last={index === membershipRows.length - 1}
                />
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={150}>
            <View style={styles.list}>
              {accountRows.map((item, index) => (
                <MenuItem
                  key={item.title}
                  item={item}
                  last={index === accountRows.length - 1}
                />
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={180}>
            <Text style={styles.section}>{t("profile.sectionApp")}</Text>
            <View style={styles.list}>
              {appRows.map((item, index) => (
                <MenuItem key={item.title} item={item} last={index === appRows.length - 1} />
              ))}
            </View>
          </FadeIn>

          <FadeIn delay={210}>
            <View style={styles.switchBlock}>
              {showSwitchRow ? (
                <Pressable
                  onPress={() => void switchAccount()}
                  disabled={switchingAccount}
                  style={({ pressed }) => [
                    styles.row,
                    styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={switchTitle}
                >
                  <View style={styles.copy}>
                    <Text style={styles.rowTitle}>{switchTitle}</Text>
                    {switchSubtitle ? (
                      <Text style={styles.rowDescription}>{switchSubtitle}</Text>
                    ) : null}
                  </View>
                  {switchingAccount ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </Pressable>
              ) : null}
              <Pressable
                onPress={signOut}
                disabled={signingOut}
                style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("profile.signOut")}
              >
                {signingOut ? (
                  <ActivityIndicator color={colors.error} size="small" />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color={colors.error} />
                )}
                <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
              </Pressable>
            </View>
          </FadeIn>
        </ScrollView>
      )}
    </FeedShell>
      <BusinessAccountSheet
        visible={businessSheetOpen}
        initialEmail={accountEmail(user)}
        onClose={() => setBusinessSheetOpen(false)}
        onLinked={applySwitchedSession}
      />
      <SignOutSheet
        visible={signOutOpen}
        busy={signingOut}
        onClose={() => {
          if (!signingOut) setSignOutOpen(false);
        }}
        onConfirm={() => void confirmSignOut()}
      />
    </>
  );
}

function makeProfileStyles(colors: Palette) {
  return StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 32,
    color: colors.text,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: TAB_BAR_SPACE + 16,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  identityCopy: {
    flex: 1,
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  cameraBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  ninBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ninText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.white,
  },
  ninPendingBadge: {
    backgroundColor: colors.sheet,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ninPendingText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  stats: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  stat: {
    flex: 1,
    paddingHorizontal: 8,
  },
  statMid: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  statSoon: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: colors.primary,
  },
  idButton: {
    alignSelf: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sheet,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  idButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 6,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  list: {
    marginBottom: 18,
  },
  switchBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeOk: {
    backgroundColor: colors.navActive,
  },
  statusBadgeWarn: {
    backgroundColor: colors.greetingBg,
  },
  statusBadgeDanger: {
    backgroundColor: "rgba(180, 35, 24, 0.12)",
  },
  statusBadgeMuted: {
    backgroundColor: colors.toggleTrack,
  },
  statusBadgeText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  statusBadgeTextOk: {
    color: colors.primary,
  },
  statusBadgeTextWarn: {
    color: colors.text,
  },
  statusBadgeTextDanger: {
    color: colors.error,
  },
  statusBadgeTextMuted: {
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  rowDescription: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  soonBadge: {
    borderRadius: 999,
    backgroundColor: colors.navActive,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  soonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: colors.primary,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  signOutText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.error,
  },
  pressed: {
    opacity: 0.72,
  },
  });
}
