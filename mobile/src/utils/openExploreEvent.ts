import { Alert, Linking } from "react-native";
import type { Router } from "expo-router";
import {
  eventId,
  gatewavUrl,
  isGatewavEvent,
  type ExploreEvent,
} from "../api/explore";
import { cacheOpenEvent } from "../state/openEvent";

export async function openExploreEvent(
  router: Pick<Router, "push">,
  event: ExploreEvent
): Promise<void> {
  if (isGatewavEvent(event)) {
    const url = gatewavUrl(event);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Gatewav", "Could not open this event.");
    }
    return;
  }

  const id = eventId(event);
  if (!id) return;
  cacheOpenEvent(event);
  router.push({ pathname: "/events/[id]", params: { id: String(id) } });
}
