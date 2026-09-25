import { useMemo, useCallback, useState } from "react";
import { Alert, Pressable, Share, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SettingsPage from "../components/SettingsPage";
import { getReferrals, type ReferralInfo } from "../api/account";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { timeAgo } from "../utils/format";

const EARNING_COPY = "On First post by the referred, referral earning is approved";

function naira(value?: number) {
  const amount = Number(value || 0);
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { enabled, label } = useAppFeatures();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ReferralInfo | null>(null);

  const load = useCallback(async () => {
    const result = await getReferrals();
    if (result.data) setInfo(result.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load().finally(() => setLoading(false));
    }, [allowed, load])
  );

  const code = info?.referral_code || "—";
  const shareUrl = info?.share_url || "";
  const people = info?.referrals || [];
  const stats = info?.stats || { referrals: 0, approved: 0, earnings_naira: 0 };
  const earningCopy = info?.earning_copy || EARNING_COPY;

  const copyLink = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert("Copied", "Invite link copied.");
  };

  const shareInvite = async () => {
    if (!info) return;
    const message = `Join JOSCITY with my code ${info.referral_code}\n${info.share_url}`;
    try {
      await Share.share({ message, title: "JOSCITY invite" });
    } catch {
      await copyLink();
    }
  };

  if (!allowed) return null;

  return (
    <SettingsPage kicker="Invite & earn" title="Referrals" loading={loading}>
      <FadeIn>
        <View style={styles.card}>
          <Text style={styles.label}>YOUR REFERRAL CODE</Text>
          <Text style={styles.code}>{code}</Text>
          {info && info.code_active === false ? (
            <Text style={styles.holdNote}>
              Your code stays on this account until you have made at least one post.
            </Text>
          ) : null}
          {info?.referred_by_code ? (
            <Text style={styles.holdNote}>
              Joined with {info.referred_by_code}
              {info.posts_count != null && info.posts_count < 2
                ? " · kept until you make at least one post"
                : ""}
            </Text>
          ) : null}
          <View style={styles.linkRow}>
            <Text style={styles.link} numberOfLines={1}>
              {shareUrl || "https://joscity.com/register?ref="}
            </Text>
            <Pressable
              onPress={() => void copyLink()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
            >
              <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => void shareInvite()}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Share invite"
          >
            <Ionicons name="share-social" size={16} color={colors.white} />
            <Text style={styles.shareText}>Share invite</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.label}>REFERRALS</Text>
            <Text style={styles.statValue}>{String(stats.referrals)}</Text>
            <Text style={styles.statMeta}>{stats.approved} approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.label}>REFERRAL EARNINGS</Text>
            <Text style={styles.statValue}>{naira(stats.earnings_naira)}</Text>
            <Text style={styles.statMeta}>{earningCopy}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Referral activity</Text>
        {!people.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No referrals yet</Text>
            <Text style={styles.emptyBody}>
              Everyone who signs up with your code appears here once JOSCITY approves their
              account.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {people.map((person, index) => (
              <View
                key={person.user_id}
                style={[styles.activityRow, index === people.length - 1 && styles.rowLast]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName}>{person.name}</Text>
                  <Text style={styles.statMeta}>
                    {[
                      person.member_id,
                      person.status === "approved" ? "Approved" : "Waiting for first post",
                      timeAgo(person.joined_at),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Text style={styles.activityAmount}>
                  {person.status === "approved" ? naira(person.earning_naira) : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.howCard}>
          <HowRow label="How it works" value="Share your code" />
          <HowRow label="Then" value="They register on JOSCITY" />
          <HowRow label="Earning" value={earningCopy} />
          <HowRow
            label="Payout"
            value={
              enabled("wallet")
                ? "Requested from your wallet, reviewed by an admin"
                : `Wallet is ${label("wallet")}`
            }
            last
          />
        </View>

        <Pressable
          disabled={!enabled("wallet")}
          onPress={() => router.push("/profile/wallet")}
          style={({ pressed }) => [
            styles.payoutBtn,
            enabled("wallet") && Number(stats.earnings_naira || 0) > 0 && styles.payoutBtnLive,
            pressed && enabled("wallet") && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !enabled("wallet") }}
          accessibilityLabel="Request payout"
        >
          <Ionicons
            name="wallet-outline"
            size={18}
            color={enabled("wallet") && Number(stats.earnings_naira || 0) > 0 ? colors.white : colors.textMuted}
          />
          <Text
            style={[
              styles.payoutText,
              enabled("wallet") && Number(stats.earnings_naira || 0) > 0 && styles.payoutTextLive,
            ]}
          >
            {!enabled("wallet")
              ? label("wallet")
              : Number(stats.earnings_naira || 0) > 0
                ? "Open wallet to request payout"
                : "No earnings to pay out yet"}
          </Text>
        </Pressable>
      </FadeIn>
    </SettingsPage>
  );
}

function HowRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.howRow, last && styles.rowLast]}>
      <Text style={styles.howLabel}>{label}</Text>
      <Text style={styles.howValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  label: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.textMuted,
  },
  code: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
  },
  holdNote: {
    marginTop: 6,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  linkRow: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  link: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  shareBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: colors.white,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.background,
  },
  statValue: {
    marginTop: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 24,
    color: colors.text,
  },
  statMeta: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
    marginBottom: 10,
  },
  emptyWrap: {
    paddingVertical: 18,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  activityName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  activityAmount: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  howCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  howRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  howLabel: {
    flex: 0.42,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  howValue: {
    flex: 0.58,
    textAlign: "right",
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  payoutBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.sheet,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: 0.9,
  },
  payoutBtnLive: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  payoutText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  payoutTextLive: {
    color: colors.white,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
});
}
