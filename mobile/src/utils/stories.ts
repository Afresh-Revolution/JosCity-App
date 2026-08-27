import type { StoryApiGroup, StoryApiItem, StoryApiUser, StoryType } from "../api/stories";
import { absoluteUrl } from "./format";
import { playableVideoUrl } from "./media";

export type StatusStory = {
  id: number;
  userId: number;
  userName: string;
  avatar: string;
  type: StoryType;
  content: string;
  caption?: string;
  createdAt: number;
  expiresAt: number;
  isOwner: boolean;
  uploading?: boolean;
  accountType?: string | null;
  backgroundColor?: string;
  textColor?: string;
};

export type StatusGroup = {
  userId: number;
  userName: string;
  avatar: string;
  hasUnseen: boolean;
  stories: StatusStory[];
};

function storyUserName(user?: StoryApiUser): string {
  const isBusiness =
    String(user?.account_type || "")
      .trim()
      .toLowerCase() === "business";
  const fullName = `${user?.user_firstname || ""} ${user?.user_lastname || ""}`.trim();
  return (
    (isBusiness
      ? user?.business_name || user?.display_name || user?.name
      : user?.display_name || user?.name || user?.business_name || fullName) ||
    fullName ||
    "Unknown"
  );
}

function storyTypeOf(item: StoryApiItem): StoryType {
  const raw = String(item.type || "").toLowerCase();
  if (raw === "photo" || raw === "video" || raw === "text") return raw;
  if (item.video_url) return "video";
  if (item.image_url) return "photo";
  return "text";
}

function storyContent(type: StoryType, item: StoryApiItem): string {
  const raw = item.src || item.content || item.image_url || item.video_url || "";
  if (!raw) return "";
  if (type === "text") return raw;
  const resolved = absoluteUrl(raw) || raw;
  return type === "video" ? playableVideoUrl(resolved) : resolved;
}

export function mapStoryGroups(
  rows: StoryApiGroup[],
  currentUserId?: number | null
): StatusGroup[] {
  const now = Date.now();
  const groups: StatusGroup[] = [];

  for (const row of rows) {
    const items = Array.isArray(row.stories) ? row.stories : [];
    if (!items.length) continue;
    const user = row.user;
    const userId = Number(user?.id || user?.user_id || items[0]?.user_id || 0);
    const userName = storyUserName(user);
    const avatar =
      absoluteUrl(user?.picture || user?.profile_image_url || "") ||
      user?.picture ||
      user?.profile_image_url ||
      "";
    const stories = items
      .map((item) => {
        const type = storyTypeOf(item);
        const createdAt = item.created_at
          ? new Date(item.created_at).getTime()
          : Date.now();
        const expiresAt = item.expires_at
          ? new Date(item.expires_at).getTime()
          : createdAt + 24 * 60 * 60 * 1000;
        return {
          id: Number(item.id || item.story_id || 0),
          userId,
          userName,
          avatar,
          type,
          content: storyContent(type, item),
          caption: item.caption,
          createdAt,
          expiresAt,
          isOwner: Boolean(currentUserId && (userId === currentUserId || item.user_id === currentUserId)),
          accountType: user?.account_type || null,
          backgroundColor: item.background_color,
          textColor: item.text_color,
        } satisfies StatusStory;
      })
      .filter((story) => story.id > 0 && story.expiresAt > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!stories.length) continue;
    groups.push({
      userId,
      userName,
      avatar,
      hasUnseen: Boolean(row.has_unseen),
      stories,
    });
  }

  return groups;
}

export function mergePendingStatus(
  groups: StatusGroup[],
  pending: StatusStory[]
): StatusGroup[] {
  const liveGroups = groups
    .map((group) => ({
      ...group,
      stories: group.stories.filter((story) => !story.uploading),
    }))
    .filter((group) => group.stories.length);

  if (!pending.length) return liveGroups;

  const first = pending[0];
  const rest = liveGroups.filter(
    (group) =>
      group.userId !== first.userId &&
      !(first.userName && group.userName === first.userName)
  );
  const existing = liveGroups.find(
    (group) =>
      (first.userId && group.userId === first.userId) ||
      (first.userName && group.userName === first.userName)
  );

  return [
    {
      userId: first.userId || existing?.userId || 0,
      userName: first.userName || existing?.userName || "You",
      avatar: first.avatar || existing?.avatar || "",
      hasUnseen: true,
      stories: [...pending, ...(existing?.stories || [])],
    },
    ...rest,
  ];
}

export function isOwnStatusGroup(
  group: StatusGroup,
  currentUserId?: number | null,
  currentName?: string | null
): boolean {
  if (currentUserId && group.userId && group.userId === currentUserId) return true;
  if (currentName && group.userName === currentName) return true;
  return Boolean(group.stories.some((story) => story.isOwner));
}
