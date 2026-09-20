import * as Location from "expo-location";
import { Bounds, inBounds, MapPin, MapRoute, Point } from "./agent";
import { GOOGLE_MAPS_API_KEY } from "../config/googleMaps";
import { decodePolyline } from "../utils/googlePolyline";

const JOS_CENTER = { lat: 9.8965, lng: 8.8583 };

function biasQuery(query: string) {
  const q = query.trim();
  if (/\b(jos|plateau|bukuru|rayfield|vom|bassa)\b/i.test(q)) return q;
  return `${q} Jos Plateau Nigeria`;
}

async function fetchJson(url: string, timeoutMs = 5000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return {};
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function asPin(id: string, label: string, address: string, lat: number, lng: number, bounds: Bounds): MapPin | null {
  if (!inBounds({ lat, lng }, bounds)) return null;
  return { id, label: label || address || "Place", address, lat, lng };
}

async function deviceGeocode(query: string, biased: string, bounds: Bounds): Promise<MapPin[]> {
  try {
    const device = await Location.geocodeAsync(biased);
    return device
      .map((item, index) =>
        asPin(
          `device-${item.latitude},${item.longitude}-${index}`,
          query,
          biased,
          Number(item.latitude),
          Number(item.longitude),
          bounds
        )
      )
      .filter((pin): pin is MapPin => Boolean(pin));
  } catch {
    return [];
  }
}

export async function searchPlacesFallback(query: string, bounds: Bounds): Promise<MapPin[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const biased = biasQuery(q);
  const key = GOOGLE_MAPS_API_KEY;
  const devicePromise = deviceGeocode(q, biased, bounds);

  if (key) {
    const textUrl =
      "https://maps.googleapis.com/maps/api/place/textsearch/json" +
      `?query=${encodeURIComponent(biased)}` +
      `&location=${JOS_CENTER.lat},${JOS_CENTER.lng}&radius=50000&region=ng&language=en&key=${encodeURIComponent(key)}`;
    const result = await fetchJson(textUrl);
    const rows = Array.isArray(result.results) ? result.results : [];
    const pins = rows
      .map((place) => {
        const item = place as {
          place_id?: string;
          name?: string;
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        };
        return asPin(
          String(item.place_id || `${item.geometry?.location?.lat},${item.geometry?.location?.lng}`),
          String(item.name || ""),
          String(item.formatted_address || ""),
          Number(item.geometry?.location?.lat),
          Number(item.geometry?.location?.lng),
          bounds
        );
      })
      .filter((pin): pin is MapPin => Boolean(pin));
    if (pins.length) return pins;
  }

  return devicePromise;
}

export async function directionsFallback(origin: Point, destination: Point): Promise<MapRoute | null> {
  const key = GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}` +
    `&mode=driving&region=ng&language=en&key=${encodeURIComponent(key)}`;
  const result = await fetchJson(url, 8000);
  if (result.status && result.status !== "OK") return null;
  const routes = Array.isArray(result.routes) ? result.routes : [];
  const route = routes[0] as {
    overview_polyline?: { points?: string };
    legs?: Array<{ distance?: { text?: string; value?: number }; duration?: { text?: string; value?: number } }>;
  } | undefined;
  const points = decodePolyline(String(route?.overview_polyline?.points || ""));
  if (points.length < 2) return null;
  const leg = route?.legs?.[0];
  return {
    points,
    distanceText: String(leg?.distance?.text || ""),
    durationText: String(leg?.duration?.text || ""),
    distanceMeters: Number(leg?.distance?.value) || 0,
    durationSeconds: Number(leg?.duration?.value) || 0,
  };
}
