import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AgentProfile } from "../../api/agent";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

export default function AgentReputationCard({
  profile,
  accent,
}: {
  profile: AgentProfile | null;
  accent: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const star = profile?.star_level;
  const jobs = Number(star?.jobs_completed ?? profile?.agent_completed_jobs_count ?? 0);
  const label = star?.label || "Agent";
  const levels = star?.levels?.length
    ? star.levels
    : star
      ? [{ ...star, reached: true, current: true }]
      : [];
  const next = star?.next;
  const progress = Math.max(0, Math.min(1, Number(star?.progress ?? (next ? 0 : 1))));
  const remain = next ? Math.max(0, next.jobs_required - jobs) : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Reputation</Text>
      <View style={styles.head}>
        <Text style={[styles.title, { color: accent }]}>{label}</Text>
        {star?.can_withdraw ? <Text style={styles.pill}>Can withdraw</Text> : <Text style={styles.pillMuted}>Payouts locked</Text>}
      </View>
      <Text style={styles.copy}>
        {next
          ? `${jobs} completed jobs. ${remain} more to reach ${next.label}.`
          : `${jobs} completed jobs. You are on the highest level set in admin.`}
      </Text>
      {next ? (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent }]} />
        </View>
      ) : null}
      <View style={styles.levels}>
        {levels.map((level) => {
          const on = Boolean(level.current);
          return (
            <View
              key={level.level}
              style={[
                styles.level,
                on && { borderColor: accent, backgroundColor: colors.navActive },
                !level.reached && !on ? { opacity: 0.55 } : null,
              ]}
            >
              <Text style={[styles.levelName, on && { color: accent }]}>{level.label}</Text>
              <Text style={styles.levelMeta}>{level.jobs_required} jobs</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      gap: 12,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      color: c.primary,
      textTransform: "uppercase",
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { fontFamily: "Montserrat_700Bold", fontSize: 22, flex: 1 },
    pill: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: c.success,
      backgroundColor: c.iconSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: "hidden",
    },
    pillMuted: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: c.textMuted,
      backgroundColor: c.sheet,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: "hidden",
    },
    copy: { fontFamily: "Montserrat_400Regular", fontSize: 13, lineHeight: 20, color: c.textMuted },
    track: { height: 8, borderRadius: 999, backgroundColor: c.sheet, overflow: "hidden" },
    fill: { height: 8, borderRadius: 999 },
    levels: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    level: {
      minWidth: 92,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.sheet,
      gap: 2,
    },
    levelName: { fontFamily: "Montserrat_700Bold", fontSize: 12, color: c.text },
    levelMeta: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: c.textMuted },
  });
}
