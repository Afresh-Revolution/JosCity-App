import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AccountType } from "../storage/session";
import { colors } from "../theme/colors";

export type LoginAccountType = AccountType;

type Props = {
  value: LoginAccountType;
  onChange: (value: LoginAccountType) => void;
};

export default function AccountTypeToggle({ value, onChange }: Props) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {(["personal", "business", "agent"] as const).map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option === "personal" ? "Personal" : option === "business" ? "Business" : "Agent"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.toggleTrack,
    borderRadius: 18,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.text,
  },
});
