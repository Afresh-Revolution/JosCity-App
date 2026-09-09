import { AppState, Platform } from "react-native";
import { getNotifications } from "../api/notifications";
import { showNotice } from "../components/AppNotice";
import i18n from "../i18n/i18n";
import { getAuthToken } from "../storage/session";
import { getNotificationsModule } from "../utils/optionalNativeModules";

const shown = new Set<string>();
const FRESH_MS = 10 * 60 * 1000;

export function announcePostMade(key: string) {
  if (!key || shown.has(key)) return;
  shown.add(key);
  showNotice({
    title: i18n.t("scheduled.postMade", { defaultValue: "Post made" }),
    tone: "success",
  });
}

function keyForPostId(postId: number): string {
  return `p:${postId}`;
}

export function startScheduledPostNoticeWatcher(): () => void {
  let cancelled = false;

  const scan = async () => {
    if (cancelled) return;
    if (!(await getAuthToken())) return;
    try {
      const rows = await getNotifications();
      for (const row of rows) {
        if (row.is_read) continue;
        const action = String(row.action || "").toLowerCase();
        const title = String(row.title || "").trim().toLowerCase();
        if (action !== "scheduled_post_published" && title !== "post made") continue;
        const created = new Date(row.time || "").getTime();
        if (!created || Date.now() - created > FRESH_MS) continue;
        const postId = Number(row.node_id || 0);
        announcePostMade(postId > 0 ? keyForPostId(postId) : `n:${row.id}`);
      }
    } catch {
      // Inbox poll is best-effort.
    }
  };

  void scan();
  const timer = setInterval(() => {
    if (AppState.currentState === "active") void scan();
  }, 45000);

  const appSub = AppState.addEventListener("change", (state) => {
    if (state === "active") void scan();
  });

  let pushSub: { remove: () => void } | null = null;
  if (Platform.OS !== "web") {
    void getNotificationsModule().then((Notifications) => {
      if (cancelled || !Notifications) return;
      pushSub = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as {
          kind?: string;
          postId?: number | string;
        } | undefined;
        if (data?.kind !== "scheduled_post_published") return;
        const postId = Number(data.postId || 0);
        announcePostMade(postId > 0 ? keyForPostId(postId) : notification.request.identifier);
      });
    });
  }

  return () => {
    cancelled = true;
    clearInterval(timer);
    appSub.remove();
    pushSub?.remove();
  };
}
