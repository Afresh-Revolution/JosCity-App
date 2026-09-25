import { Pressable, StyleSheet, Text, View } from "react-native";
import TextField from "./TextField";
import type { ReferralLookup } from "../hooks/useReferralCode";
import { REFERRAL_CODE_LENGTH } from "../hooks/useReferralCode";
import { colors } from "../theme/colors";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  lookup: ReferralLookup | null;
  onRetry?: () => void;
  labelColor?: string;
  loading?: boolean;
};

export default function ReferralCodeField({
  value,
  onChange,
  onBlur,
  lookup,
  onRetry,
  labelColor,
  loading,
}: Props) {
  return (
    <>
      <TextField
        label="Referral code (optional)"
        labelColor={labelColor}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="JOSABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={REFERRAL_CODE_LENGTH}
        editable={!loading}
        helper={
          !value
            ? "Enter the code of the person who invited you."
            : lookup?.code === value && lookup.name
              ? `Referred by: ${lookup.name}`
              : undefined
        }
      />
      {lookup?.code === value && lookup.error ? (
        <View accessibilityLiveRegion="polite" style={styles.note}>
          <Text style={styles.error}>{lookup.error}</Text>
          {lookup.retryable && onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={styles.retry}>Retry verification</Text>
            </Pressable>
          ) : null}
        </View>
      ) : value.length >= REFERRAL_CODE_LENGTH && lookup?.code !== value ? (
        <View accessibilityLiveRegion="polite" style={styles.note}>
          <Text style={styles.checking}>Checking referral code...</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: -8,
    marginBottom: 12,
  },
  error: {
    fontFamily: "Montserrat_400Regular",
    color: colors.error,
    fontSize: 13,
  },
  retry: {
    marginTop: 6,
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  checking: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.textMuted,
  },
});
