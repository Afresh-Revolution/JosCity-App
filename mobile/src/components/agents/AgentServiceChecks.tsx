import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HELP_ME_BUY, HELP_ME_DELIVER } from "../../api/agentSignup";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

function toggleService(current: string[], service: string): string[] {
  if (current.includes(service)) return current.filter((item) => item !== service);
  return [...current, service];
}

export default function AgentServiceChecks({
  services,
  onChange,
}: {
  services: string[];
  onChange: (next: string[]) => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.list}>
      {[HELP_ME_BUY, HELP_ME_DELIVER].map((service) => {
        const on = services.includes(service);
        return (
          <Pressable
            key={service}
            onPress={() => onChange(toggleService(services, service))}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={service}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.label}>{service}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    list: { gap: 10 },
    row: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.fieldBorder || c.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
    },
    boxOn: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    label: {
      flex: 1,
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: c.text,
    },
  });
}
