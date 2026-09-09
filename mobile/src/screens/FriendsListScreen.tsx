import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import JosCityLoader from "../components/JosCityLoader";
import { PersonListRow } from "../components/feed/PeopleRow";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import { getFriendsForUser, type DirectoryUser } from "../api/social";
import { refreshFriendGraph } from "../state/friendGraph";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";

export default function FriendsListScreen() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const userId = Number(id || 0);
  const ownerName = String(name || "Member").trim() || "Member";
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!userId) return;
    const [rows] = await Promise.all([getFriendsForUser(userId), refreshFriendGraph()]);
    setPeople(rows);
  }, [userId]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  return <FeedShell tab="explore" header={<View style={styles.header}>
    <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
    <View><Text style={styles.kicker}>JOSCITY COMMUNITY</Text><Text style={styles.title}>{ownerName}'s friends</Text></View>
  </View>}>
    {loading ? <View style={styles.centered}><JosCityLoader color={colors.primary} size="large" /></View> :
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true); void load().finally(() => setRefreshing(false));
      }} tintColor={colors.primary} />}>
        <Text style={styles.intro}>{people.length ? `${people.length} ${people.length === 1 ? "friend" : "friends"}` : "No friends to show yet."}</Text>
        {people.map((person) => <PersonListRow key={person.user_id} person={person} />)}
      </ScrollView>}
  </FeedShell>;
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingBottom: 10 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    kicker: { fontFamily: "Montserrat_600SemiBold", fontSize: 11, letterSpacing: .8, color: colors.textMuted },
    title: { fontFamily: "Montserrat_700Bold", fontSize: 20, color: colors.text },
    content: { paddingTop: 12, paddingBottom: TAB_BAR_SPACE + 24 },
    intro: { marginHorizontal: 16, marginBottom: 10, fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textMuted },
  });
}
