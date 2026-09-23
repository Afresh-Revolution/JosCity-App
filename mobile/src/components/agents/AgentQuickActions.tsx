import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../theme/ThemeProvider";

type Props = { showRequests?: boolean };

const REQUESTS = [
  { label: "Help me buy", icon: "bag-handle-outline" as const, href: "/agent-services/request?service=buy" },
  { label: "Help me deliver", icon: "bicycle-outline" as const, href: "/agent-services/request?service=deliver" },
];

export default function AgentQuickActions({ showRequests = false }: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  if (!showRequests) {
    return (
      <View style={styles.wrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agents"
          onPress={() => router.push("/agent-services/directory" as never)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.cream },
            pressed && { opacity: 0.88 },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.card }]}>
            <Ionicons name="people-outline" size={22} color={colors.text} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Agents</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Shopping and delivery</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.tiles}>
      {REQUESTS.map((item) => (
        <Pressable
          key={item.label}
          accessibilityRole="button"
          onPress={() => router.push(item.href as never)}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: colors.cream },
            pressed && { opacity: 0.88 },
          ]}
        >
          <Ionicons name={item.icon} size={22} color={colors.textMuted} />
          <Text style={[styles.tileLabel, { color: colors.text }]}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/agent-services/directory" as never)}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: colors.cream },
          pressed && { opacity: 0.88 },
        ]}
      >
        <Ionicons name="people-outline" size={22} color={colors.textMuted} />
        <Text style={[styles.tileLabel, { color: colors.text }]}>Agents</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
  meta: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
  },
  tiles: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  tileLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
});
