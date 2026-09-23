import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  escrowTotal,
  jobDescription,
  jobImages,
  jobStepIndex,
  jobSteps,
  jobTitle,
  lastAgentStepIndex,
  nextStageLock,
  vendorPayoutStatus,
  type Job,
} from "../../api/agent";
import { formatAgentAmount } from "../../state/agentPreview";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

function money(value: unknown) {
  return `NGN ${formatAgentAmount(Number(value || 0))}`;
}

export default function AgentJobCard({
  job,
  role = "agent",
  expanded,
  advancing,
  onToggle,
  onAdvance,
  onPurchase,
  onConfirm,
  onRate,
}: {
  job: Job;
  role?: "agent" | "requester";
  expanded: boolean;
  advancing?: boolean;
  onToggle: () => void;
  onAdvance?: () => void;
  onPurchase?: () => void;
  onConfirm?: () => void;
  onRate?: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const steps = jobSteps(job);
  const current = jobStepIndex(job);
  const lastAgent = lastAgentStepIndex(job);
  const funded = job.escrow_status === "held";
  const cancelled = Boolean(job.cancelled_at);
  const lock = nextStageLock(job, role);
  const photos = jobImages(job);
  const details = jobDescription(job);
  const title = jobTitle(job);
  const reviewed = Boolean(job.reviewed || job.review_rating);
  const status = cancelled ? "Cancelled" : job.payout_pending_manual ? "Pending payout" : job.stage_label;
  const vendor = vendorPayoutStatus(job).replace(/^Vendor payout:\s*/i, "");
  const purchaseNext = role === "agent" && job.source_type === "buy" && current === 1 && funded && Boolean(onPurchase);
  const confirmNext = role === "requester" && current === lastAgent && funded && Boolean(onConfirm);
  const advanceNext = role === "agent" && current < lastAgent && !purchaseNext && Boolean(onAdvance);
  const interactive = !cancelled && (purchaseNext || confirmNext || (advanceNext && !lock));
  const hint = cancelled
    ? null
    : lock && !(purchaseNext || confirmNext)
      ? lock
      : role === "requester" && current < lastAgent
        ? "Your agent updates this progress as the job moves along."
        : null;

  const selectStage = (index: number) => {
    if (cancelled || advancing || index !== current + 1) return;
    if (purchaseNext) {
      onPurchase?.();
      return;
    }
    if (confirmNext) {
      onConfirm?.();
      return;
    }
    if (advanceNext && !lock) onAdvance?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {photos[0] ? (
          <Image accessibilityLabel="Request photo" source={{ uri: photos[0] }} style={styles.thumb} />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.kicker}>{job.source_type === "buy" ? "Help me buy" : "Help me deliver"}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={[styles.pill, cancelled ? styles.pillMuted : null]}>
          <Text style={[styles.pillText, cancelled ? styles.pillTextMuted : null]}>{status}</Text>
        </View>
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(escrowTotal(job))}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Escrow</Text>
          <Text style={[styles.metaValue, funded ? styles.metaGood : null]}>
            {funded ? `Holding ${money(escrowTotal(job))}` : "Not funded yet"}
          </Text>
        </View>
        {job.source_type === "buy" ? (
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Vendor</Text>
            <Text style={styles.metaValue}>{vendor || "Not sent"}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Progress</Text>
      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const done = index < current;
          const now = index === current;
          const next = index === current + 1;
          const last = index === steps.length - 1;
          const canSelect = interactive && next;
          const lockedNext = next && !canSelect && Boolean(lock);
          const hintText = now
            ? "Current stage"
            : canSelect
              ? advancing
                ? "Updating…"
                : purchaseNext
                  ? "Tap to pay the vendor"
                  : confirmNext
                    ? "Tap to confirm delivery"
                    : "Tap to mark"
              : lockedNext
                ? lock
                : null;
          return (
            <View key={step} style={styles.stepRow}>
              <View style={styles.rail}>
                <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow, canSelect && styles.dotNext]}>
                  {done ? (
                    <Ionicons name="checkmark" size={11} color={c.white} />
                  ) : lockedNext ? (
                    <Ionicons name="lock-closed" size={9} color={c.textMuted} />
                  ) : now ? (
                    <View style={styles.dotInner} />
                  ) : null}
                </View>
                {last ? null : <View style={[styles.line, (done || now) && styles.lineOn]} />}
              </View>
              <Pressable
                accessibilityRole={canSelect ? "button" : "text"}
                accessibilityState={{ disabled: !canSelect || Boolean(advancing), selected: now }}
                accessibilityLabel={
                  canSelect ? `Mark ${step}` : lockedNext ? `${step}. ${lock}` : step
                }
                disabled={!canSelect || Boolean(advancing)}
                onPress={() => selectStage(index)}
                style={({ pressed }) => [
                  styles.stepCopy,
                  now && styles.stepCopyNow,
                  canSelect && styles.stepCopyNext,
                  lockedNext && styles.stepCopyLocked,
                  last && { paddingBottom: 0, marginBottom: 0 },
                  pressed && canSelect && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.stepLabel, (done || now) && styles.stepLabelOn, canSelect && styles.stepLabelNext]}>{step}</Text>
                {hintText ? (
                  <Text style={[styles.stepHint, lockedNext && styles.stepHintLocked, canSelect && styles.stepHintNext]}>
                    {hintText}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
      {hint ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={c.primary} />
          <Text style={styles.noticeText}>{hint}</Text>
        </View>
      ) : null}

      {reviewed ? (
        <View style={styles.rated}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Ionicons
                key={value}
                name={value <= Number(job.review_rating || 0) ? "star" : "star-outline"}
                size={16}
                color={value <= Number(job.review_rating || 0) ? "#E8B923" : c.textMuted}
              />
            ))}
          </View>
          {job.review_comment ? <Text style={styles.noticeText}>{job.review_comment}</Text> : null}
        </View>
      ) : role === "requester" && job.stage === 4 && onRate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rate this agent"
          onPress={onRate}
          style={({ pressed }) => [styles.advance, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.advanceText}>Rate this agent</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Text style={styles.toggleText}>{expanded ? "Hide request details" : "View request details"}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.text} />
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          {photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.map((uri) => (
                <Image key={uri} accessibilityLabel="Request photo" source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          ) : null}
          {details ? <Text style={styles.body}>{details}</Text> : <Text style={styles.bodyMuted}>No extra description was added.</Text>}
          {job.pickup_address ? <Text style={styles.body}>Pickup: {job.pickup_address}</Text> : null}
          {job.destination_address ? <Text style={styles.body}>Delivery: {job.destination_address}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: 18,
      gap: 14,
    },
    head: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    thumb: {
      width: 52,
      height: 56,
      borderRadius: 12,
      backgroundColor: c.iconSoft,
    },
    kicker: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.primary,
    },
    title: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 18,
      color: c.text,
    },
    pill: {
      backgroundColor: c.navActive,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    pillMuted: {
      backgroundColor: c.sheet,
    },
    pillText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: c.primary,
    },
    pillTextMuted: {
      color: c.textMuted,
    },
    totals: {
      backgroundColor: c.iconSoft,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    metaLabel: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      color: c.textMuted,
    },
    metaValue: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: c.text,
      textAlign: "right",
      flexShrink: 1,
    },
    metaGood: {
      color: c.success,
    },
    totalValue: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: c.text,
    },
    toggle: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    togglePressed: {
      backgroundColor: c.navActive,
    },
    toggleText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: c.text,
    },
    details: {
      gap: 10,
    },
    photos: {
      gap: 10,
    },
    photo: {
      width: 148,
      height: 148,
      borderRadius: 16,
      backgroundColor: c.iconSoft,
    },
    body: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 21,
      color: c.text,
    },
    bodyMuted: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 21,
      color: c.textMuted,
    },
    sectionLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.textMuted,
    },
    timeline: {
      paddingLeft: 2,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
    },
    rail: {
      width: 18,
      alignItems: "center",
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    dotDone: {
      borderColor: c.brand,
      backgroundColor: c.brand,
    },
    dotNow: {
      borderColor: c.primary,
      backgroundColor: c.navActive,
    },
    dotNext: {
      borderColor: c.brand,
      backgroundColor: c.card,
    },
    dotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    line: {
      width: 2,
      flex: 1,
      minHeight: 18,
      backgroundColor: c.border,
      marginVertical: 2,
    },
    lineOn: {
      backgroundColor: c.primary,
    },
    stepCopy: {
      flex: 1,
      paddingBottom: 14,
    },
    stepCopyNow: {
      backgroundColor: c.navActive,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
      paddingBottom: 8,
    },
    stepCopyNext: {
      backgroundColor: c.brand,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      paddingBottom: 10,
      minHeight: 44,
      justifyContent: "center",
    },
    stepCopyLocked: {
      backgroundColor: c.sheet,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
      paddingBottom: 8,
    },
    stepLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: c.textMuted,
    },
    stepLabelOn: {
      color: c.text,
    },
    stepLabelNext: {
      color: c.white,
    },
    stepHint: {
      marginTop: 2,
      fontFamily: "Montserrat_400Regular",
      fontSize: 11,
      color: c.primary,
    },
    stepHintNext: {
      color: c.white,
    },
    stepHintLocked: {
      color: c.textMuted,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: c.sheet,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeText: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      lineHeight: 19,
      color: c.textMuted,
    },
    rated: {
      backgroundColor: c.sheet,
      borderRadius: 14,
      padding: 12,
      gap: 6,
    },
    starsRow: {
      flexDirection: "row",
      gap: 4,
    },
    advance: {
      minHeight: 48,
      backgroundColor: c.brand,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    advanceText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: c.white,
    },
  });
}
