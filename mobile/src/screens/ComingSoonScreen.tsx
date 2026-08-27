import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppButton from "../components/AppButton";
import FadeIn from "../components/FadeIn";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import type { FeedTab } from "../components/feed/FeedTabBar";
import { useRequirePersonalAccount } from "../hooks/usePersonalSession";
import type { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  tab: Exclude<FeedTab, "home">;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ComingSoonScreen({
  tab,
  title,
  body,
  actionLabel,
  onAction,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allowed = useRequirePersonalAccount();

  if (!allowed) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FeedShell tab={tab}>
      <View style={styles.wrap}>
        <FadeIn>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </FadeIn>
        {actionLabel && onAction ? (
          <FadeIn delay={120} style={styles.action}>
            <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
          </FadeIn>
        ) : null}
      </View>
    </FeedShell>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: TAB_BAR_SPACE,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  action: {
    marginTop: 28,
  },
});
}
