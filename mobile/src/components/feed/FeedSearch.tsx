import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Ref } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import AvatarCircle from "./AvatarCircle";
import { personName } from "./PeopleRow";
import type { FeedPost } from "../../api/feed";
import { searchUsers, type DirectoryUser } from "../../api/social";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeProvider";

export type FeedSearchResult = {
  type: "person" | "hashtag" | "post";
  id: string | number;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  postId?: number;
  accountType?: string;
};

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  posts: FeedPost[];
  people: DirectoryUser[];
  onSelect: (result: FeedSearchResult) => void;
  inputRef?: Ref<TextInput>;
};

function postText(post: FeedPost): string {
  return `${post.text || ""} ${post.caption || ""}`.trim();
}

function postHashtags(post: FeedPost): string[] {
  return postText(post).match(/#[A-Za-z0-9_]+/g) || [];
}

function authorName(post: FeedPost): string {
  return post.author?.name || "JosCity member";
}

function authorId(post: FeedPost): number {
  return Number(post.author?.id || post.user_id || 0);
}

export function searchFeed(
  query: string,
  posts: FeedPost[],
  people: DirectoryUser[]
): FeedSearchResult[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  const results: FeedSearchResult[] = [];
  const seenPeople = new Set<string>();

  const authors = new Map<
    string,
    { avatar?: string | null; postCount: number; postId: number; userId: number; accountType?: string }
  >();
  for (const post of posts) {
    const name = authorName(post);
    const key = name.toLowerCase();
    const existing = authors.get(key);
    if (existing) {
      existing.postCount += 1;
    } else {
      authors.set(key, {
        avatar: post.author?.picture,
        postCount: 1,
        postId: Number(post.post_id || post.id || 0),
        userId: authorId(post),
        accountType: post.author?.account_type,
      });
    }
  }

  for (const [name, info] of authors) {
    if (!name.includes(queryLower)) continue;
    const title = posts.find((post) => authorName(post).toLowerCase() === name);
    const display = title ? authorName(title) : name;
    seenPeople.add(name);
    results.push({
      type: "person",
      id: info.userId || display,
      title: display,
      subtitle: info.postCount > 0 ? `${info.postCount} post${info.postCount > 1 ? "s" : ""}` : "User",
      avatar: info.avatar,
      postId: info.postId,
      accountType: info.accountType,
    });
  }

  for (const person of people) {
    const name = personName(person);
    const key = name.toLowerCase();
    if (seenPeople.has(key)) continue;
    const haystack = `${name} ${person.user_name || ""} ${person.address || ""}`.toLowerCase();
    if (!haystack.includes(queryLower)) continue;
    seenPeople.add(key);
    const authored = posts.find((post) => authorId(post) === person.user_id);
    results.push({
      type: "person",
      id: person.user_id,
      title: name,
      subtitle: authored ? "User" : "From Jos",
      avatar: person.user_picture,
      postId: authored ? Number(authored.post_id || authored.id || 0) : undefined,
      accountType: person.account_type,
    });
  }

  const tags = new Map<string, { count: number; postId: number }>();
  for (const post of posts) {
    const postId = Number(post.post_id || post.id || 0);
    for (const tag of postHashtags(post)) {
      const current = tags.get(tag);
      if (current) current.count += 1;
      else tags.set(tag, { count: 1, postId });
    }
  }

  for (const [tag, info] of tags) {
    if (!tag.toLowerCase().includes(queryLower)) continue;
    results.push({
      type: "hashtag",
      id: tag,
      title: tag,
      subtitle: `${info.count} post${info.count !== 1 ? "s" : ""}`,
      postId: info.postId,
    });
  }

  for (const post of posts) {
    const caption = postText(post);
    const tagsOnPost = postHashtags(post);
    if (
      !caption.toLowerCase().includes(queryLower) &&
      !tagsOnPost.some((tag) => tag.toLowerCase().includes(queryLower))
    ) {
      continue;
    }

    const name = authorName(post);
    const alreadyIncluded =
      results.some((row) => row.type === "person" && row.title === name) ||
      tagsOnPost.some((tag) => results.some((row) => row.type === "hashtag" && row.id === tag));
    if (alreadyIncluded) continue;

    results.push({
      type: "post",
      id: Number(post.post_id || post.id || 0),
      title: `Post by ${name}`,
      subtitle: caption.length > 50 ? `${caption.slice(0, 50)}...` : caption || "Post",
      avatar: post.author?.picture,
      postId: Number(post.post_id || post.id || 0),
    });
  }

  return results.slice(0, 10);
}

function resultIcon(type: FeedSearchResult["type"]): "person-outline" | "pricetag-outline" | "document-text-outline" {
  if (type === "person") return "person-outline";
  if (type === "hashtag") return "pricetag-outline";
  return "document-text-outline";
}

export default function FeedSearch({
  query,
  onQueryChange,
  posts,
  people,
  onSelect,
  inputRef,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [remotePeople, setRemotePeople] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemotePeople([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchUsers(q).then((rows) => {
        if (!cancelled) setRemotePeople(rows);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const mergedPeople = useMemo(() => {
    const byId = new Map<number, DirectoryUser>();
    for (const person of [...remotePeople, ...people]) {
      const id = Number(person.user_id);
      if (!id || byId.has(id)) continue;
      byId.set(id, person);
    }
    return [...byId.values()];
  }, [people, remotePeople]);

  const results = useMemo(
    () => searchFeed(query, posts, mergedPeople),
    [mergedPeople, posts, query]
  );
  const showEmpty = Boolean(query.trim()) && results.length === 0;
  const showResults = Boolean(query.trim()) && results.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputWrap}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search people, hashtags, or posts..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.icon} />
      </View>

      {showResults ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.results}
          contentContainerStyle={styles.resultsInner}
        >
          {results.map((result, index) => (
            <Pressable
              key={`${result.type}-${result.id}-${index}`}
              onPress={() => onSelect(result)}
              style={[styles.row, index < results.length - 1 && styles.rowBorder]}
            >
              <View style={styles.typeIcon}>
                <Ionicons name={resultIcon(result.type)} size={16} color={colors.textMuted} />
              </View>
              {result.type === "person" ? (
                <AvatarCircle name={result.title} uri={result.avatar} size={32} />
              ) : null}
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>
                  {result.title}
                </Text>
                {result.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {result.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {showEmpty ? (
        <View style={styles.results}>
          <View style={styles.empty}>
            <Text style={styles.title}>No results found</Text>
            <Text style={styles.subtitle}>
              Try searching for a different name, hashtag, or keyword
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  wrap: {
    zIndex: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    position: "relative",
    overflow: "visible",
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.fieldBg,
    paddingLeft: 16,
    paddingRight: 42,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: colors.text,
  },
  icon: {
    position: "absolute",
    right: 14,
  },
  results: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    maxHeight: 320,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 30,
  },
  resultsInner: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  typeIcon: {
    width: 20,
    alignItems: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
});
}
