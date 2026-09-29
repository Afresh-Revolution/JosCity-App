import { useEffect, useMemo, useState } from "react";
import { getApprovedUsers, searchUsers, type DirectoryUser } from "../api/social";
import { personName } from "../components/feed/PeopleRow";
import { handleFromName } from "./format";
import { publicUsername } from "./accountNames";

export function mentionHandle(user: DirectoryUser): string {
  const raw = publicUsername(user.user_name) || String(user.user_name || "").replace(/^@/, "").trim();
  if (raw) return raw;
  return handleFromName(personName(user)).replace(/^@/, "");
}

export function activeMentionQuery(text: string): string | null {
  const match = String(text || "").match(/@([A-Za-z0-9_]*)$/);
  return match ? match[1] : null;
}

export function insertMentionAtCursor(text: string, handle: string): string {
  return String(text || "").replace(/@([A-Za-z0-9_]*)$/, `@${handle} `);
}

export function useMentionSuggest(text: string, enabled = true) {
  const [mentions, setMentions] = useState<DirectoryUser[]>([]);
  const mentionQuery = useMemo(() => (enabled ? activeMentionQuery(text) : null), [enabled, text]);

  useEffect(() => {
    if (mentionQuery == null) {
      setMentions([]);
      return;
    }
    const handle = setTimeout(() => {
      void (mentionQuery
        ? searchUsers(mentionQuery)
        : getApprovedUsers({ limit: 8, accountType: "all" })
      ).then(setMentions);
    }, 180);
    return () => clearTimeout(handle);
  }, [mentionQuery]);

  return { mentions, mentionQuery, clearMentions: () => setMentions([]) };
}
