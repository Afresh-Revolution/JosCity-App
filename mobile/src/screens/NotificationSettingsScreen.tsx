import { useMemo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import FadeIn from "../components/FadeIn";
import SoonBadge from "../components/SoonBadge";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "../api/notifications";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useMembershipSettings } from "../hooks/useMembershipSettings";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  payments: true,
  membership: true,
  system: true,
  orders: true,
  listings: true,
  rewards: true,
  referrals: true,
  business: true,
};

const SECTIONS: Array<{
  title: string;
  subtitle: string;
  items: Array<{
    key: NotificationPreferenceKey;
    label: string;
    description: string;
    featureKey?: "membership" | "rewards";
  }>;
}> = [
  {
    title: "Account",
    subtitle: "Wallet approvals, membership and security",
    items: [
      {
        key: "payments",
        label: "Payments & wallet",
        description: "Funding, payouts and approvals",
      },
      {
        key: "membership",
        label: "Membership",
        description: "Renewals and package changes",
        featureKey: "membership",
      },
      {
        key: "system",
        label: "System updates",
        description: "Security notices and city announcements",
      },
    ],
  },
  {
    title: "Marketplace",
    subtitle: "Orders you place and orders you receive",
    items: [
      {
        key: "orders",
        label: "Orders",
        description: "Marketplace orders you place or receive",
      },
    ],
  },
  {
    title: "Growth",
    subtitle: "Points you earn and people you refer",
    items: [
      {
        key: "rewards",
        label: "Rewards",
        description: "CBC points earned and redeemed",
        featureKey: "rewards",
      },
      {
        key: "referrals",
        label: "Referrals",
        description: "People who join with your code",
      },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();
  const router = useRouter();
  const { enabled, label } = useAppFeatures();
  const { personalEnabled } = useMembershipSettings();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getNotificationPreferences();
    setPrefs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  const onToggle = (key: NotificationPreferenceKey, value: boolean) => {
    const previous = prefs[key];
    setPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(key);
    void updateNotificationPreference(key, value).then((next) => {
      setSavingKey(null);
      if (!next) {
        setPrefs((current) => ({ ...current, [key]: previous }));
        Alert.alert("Could not update this setting.");
        return;
      }
      setPrefs(next);
    });
  };

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell
      tab="profile"
      header={
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.kicker}>Settings</Text>
            <Text style={styles.title}>Notifications</Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <FadeIn duration={420} translateY={8}>
            <Text style={styles.intro}>
              Turning a category off hides those updates from your notification centre.
              Security notices about sign-ins are always delivered.
            </Text>
          </FadeIn>

          {SECTIONS.map((section, index) => (
            <FadeIn key={section.title} delay={60 + index * 50} duration={420} translateY={10}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              <View style={styles.card}>
                {section.items
                  .filter((item) => item.key !== "membership" || personalEnabled)
                  .map((item, itemIndex, visibleItems) => {
                  const comingSoon = item.featureKey ? !enabled(item.featureKey) : false;
                  return (
                  <View
                    key={item.key}
                    style={[
                      styles.row,
                      itemIndex < visibleItems.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <View style={styles.copy}>
                      <Text style={styles.rowTitle}>{item.label}</Text>
                      <Text style={styles.rowDescription}>{item.description}</Text>
                    </View>
                    {comingSoon && item.featureKey ? (
                      <SoonBadge label={label(item.featureKey)} />
                    ) : (
                      <Switch
                        value={prefs[item.key]}
                        onValueChange={(value) => onToggle(item.key, value)}
                        disabled={savingKey === item.key}
                        trackColor={{ false: colors.toggleTrack, true: colors.primary }}
                        thumbColor={colors.white}
                        ios_backgroundColor={colors.toggleTrack}
                      />
                    )}
                  </View>
                  );
                })}
              </View>
            </FadeIn>
          ))}

          <Text style={styles.footnote}>
            JOSCITY sends these updates in-app. Push notifications arrive once
            you install the app on your device and allow notifications.
          </Text>
        </ScrollView>
      )}
    </FeedShell>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: colors.text,
    marginTop: -2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: TAB_BAR_SPACE + 24,
  },
  intro: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 22,
  },
  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: colors.text,
  },
  sectionSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 22,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
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
  footnote: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: 4,
  },
});
}
