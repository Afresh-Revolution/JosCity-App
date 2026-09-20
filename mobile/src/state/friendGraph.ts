import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  getFriendGraph,
  getFriendsOfUser,
  rejectFriendRequest,
  unfriendUser,
  type FriendGraph,
  type FriendStatus,
} from "../api/social";
import { getAccountType, getUser, isDedicatedAgentAccount } from "../storage/session";

const emptyGraph = (): FriendGraph => ({
  statusByUser: {},
  sentRequestIdByUser: {},
  receivedRequestIdByUser: {},
  myFriendIds: [],
});

let graph = emptyGraph();
const listeners = new Set<() => void>();
let loadPromise: Promise<FriendGraph> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function getFriendGraphSnapshot(): FriendGraph {
  return graph;
}

export function subscribeFriendGraph(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshFriendGraph(): Promise<FriendGraph> {
  loadPromise = getFriendGraph()
    .then((next) => {
      graph = next;
      theirFriends.clear();
      emit();
      return next;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

export function ensureFriendGraph(): Promise<FriendGraph> {
  if (loadPromise) return loadPromise;
  if (Object.keys(graph.statusByUser).length) return Promise.resolve(graph);
  return refreshFriendGraph();
}

export function patchFriendStatus(
  userId: number,
  status: FriendStatus,
  requestId?: number
) {
  const next: FriendGraph = {
    statusByUser: { ...graph.statusByUser },
    sentRequestIdByUser: { ...graph.sentRequestIdByUser },
    receivedRequestIdByUser: { ...graph.receivedRequestIdByUser },
    myFriendIds: [...graph.myFriendIds],
  };
  if (status === "none") {
    delete next.statusByUser[userId];
    delete next.sentRequestIdByUser[userId];
    delete next.receivedRequestIdByUser[userId];
    next.myFriendIds = next.myFriendIds.filter((id) => id !== userId);
  } else {
    next.statusByUser[userId] = status;
    if (status === "sent" && requestId) next.sentRequestIdByUser[userId] = requestId;
    if (status === "friends") {
      delete next.sentRequestIdByUser[userId];
      delete next.receivedRequestIdByUser[userId];
      if (!next.myFriendIds.includes(userId)) next.myFriendIds.push(userId);
    }
    if (status === "friends") {
      delete next.sentRequestIdByUser[userId];
    }
  }
  graph = next;
  emit();
}

export async function addFriend(userId: number): Promise<boolean> {
  const [user, type] = await Promise.all([getUser(), getAccountType()]);
  if (isDedicatedAgentAccount(user, type)) return false;
  const result = await createFriendRequest(userId);
  if (!result.success) return false;
  patchFriendStatus(userId, "sent", result.requestId);
  void refreshFriendGraph();
  return true;
}

export async function cancelOutgoing(userId: number): Promise<boolean> {
  const requestId = graph.sentRequestIdByUser[userId];
  if (!requestId) {
    await refreshFriendGraph();
    const retryId = graph.sentRequestIdByUser[userId];
    if (!retryId) return false;
    const ok = await cancelFriendRequest(retryId);
    if (ok) patchFriendStatus(userId, "none");
    return ok;
  }
  const ok = await cancelFriendRequest(requestId);
  if (ok) patchFriendStatus(userId, "none");
  return ok;
}

export async function acceptIncoming(userId: number, requestId?: number): Promise<boolean> {
  const [user, type] = await Promise.all([getUser(), getAccountType()]);
  if (isDedicatedAgentAccount(user, type)) return false;
  let id = requestId || graph.receivedRequestIdByUser[userId];
  if (!id) {
    await refreshFriendGraph();
    id = requestId || graph.receivedRequestIdByUser[userId];
  }
  if (!id) return false;
  const ok = await acceptFriendRequest(id);
  if (ok) patchFriendStatus(userId, "friends");
  void refreshFriendGraph();
  return ok;
}

export async function declineIncoming(userId: number, requestId?: number): Promise<boolean> {
  let id = requestId || graph.receivedRequestIdByUser[userId];
  if (!id) {
    await refreshFriendGraph();
    id = requestId || graph.receivedRequestIdByUser[userId];
  }
  if (!id) return false;
  const ok = await rejectFriendRequest(id);
  if (ok) patchFriendStatus(userId, "none");
  void refreshFriendGraph();
  return ok;
}

export async function removeFriend(userId: number): Promise<boolean> {
  const ok = await unfriendUser(userId);
  if (ok) patchFriendStatus(userId, "none");
  return ok;
}

const theirFriends = new Map<number, Promise<number[]>>();

export async function getMutualFriendCount(userId: number): Promise<number> {
  if (!userId) return 0;
  await ensureFriendGraph();
  const mine = new Set(graph.myFriendIds.filter((id) => id > 0 && id !== userId));
  if (!mine.size) return 0;
  if (!theirFriends.has(userId)) {
    theirFriends.set(
      userId,
      getFriendsOfUser(userId).catch(() => {
        theirFriends.delete(userId);
        return [];
      })
    );
  }
  const theirs = (await theirFriends.get(userId)) || [];
  const uniqueTheirs = [...new Set(theirs.filter((id) => id > 0 && id !== userId))];
  const mineList = [...mine].sort((a, b) => a - b).join(",");
  const theirsList = [...uniqueTheirs].sort((a, b) => a - b).join(",");
  // Old /friends/user/:id returned the viewer's friends for every profile.
  if (theirsList && theirsList === mineList) return 0;
  return uniqueTheirs.filter((id) => mine.has(id)).length;
}
