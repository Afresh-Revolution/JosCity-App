import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

export default function AgentFeeBenefit({
  feeAmount,
  totalPrice,
  formatAmount,
}: {
  feeAmount?: number | null;
  totalPrice?: number | null;
  formatAmount: (value: number) => string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ready = Number.isFinite(Number(feeAmount)) && Number.isFinite(Number(totalPrice));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Your fee</Text>
        <Text style={styles.amount}>{ready ? formatAmount(Number(feeAmount)) : "—"}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.label}>Customer pays</Text>
        <Text style={styles.total}>{ready ? formatAmount(Number(totalPrice)) : "—"}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      marginTop: -10,
      backgroundColor: c.iconSoft,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    row: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    label: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 13,
      color: c.textMuted,
      flexShrink: 1,
    },
    amount: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 18,
      color: c.primary,
      letterSpacing: 0.2,
    },
    total: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 15,
      color: c.text,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
  });
}
