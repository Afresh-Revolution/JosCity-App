import { env } from "../config/env";

export function absoluteUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = env.apiBaseUrl.replace(/\/api\/?$/, "");
  return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function postShareUrl(postId: number): string {
  return `https://joscity.com/newsfeed?post=${postId}`;
}

export function initials(name?: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "JC";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function handleFromName(name?: string): string {
  const slug = String(name || "joscity")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  return `@${slug || "member"}`;
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

export type TimeGreeting = {
  period: GreetingPeriod;
  greeting: string;
  message: string;
  icon: "sunny-outline" | "partly-sunny-outline" | "moon-outline";
};

const GREETING_MESSAGES: Record<GreetingPeriod, string[]> = {
  morning: [
    "Start your day with purpose and let every moment count",
    "Embrace the morning light and make today amazing",
    "Write it on your heart that every day is the best day in the year",
    "Rise and shine! Today is full of endless possibilities",
    "A beautiful morning begins with a grateful heart",
  ],
  afternoon: [
    "Keep pushing forward! Your afternoon momentum is unstoppable",
    "Make the most of this afternoon - you've got this!",
    "Every afternoon brings new opportunities to shine",
    "Stay focused and let your afternoon productivity soar",
    "This afternoon is yours to create something wonderful",
  ],
  evening: [
    "Reflect on your day and celebrate your accomplishments",
    "Evening is a time to unwind and appreciate today's journey",
    "Let the evening bring you peace and new perspectives",
    "End your day with gratitude and prepare for tomorrow",
    "This evening, take a moment to appreciate how far you've come",
  ],
  night: [
    "Rest well and let tomorrow be even better",
    "End your day with peace and dream of great tomorrows",
    "Sleep well, knowing you gave today your best",
    "Let the night recharge you for another amazing day",
    "Good night - tomorrow is a fresh start full of promise",
  ],
};

export function periodForHour(hour = new Date().getHours()): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function pickMessage(period: GreetingPeriod, avoid?: string): string {
  const pool = GREETING_MESSAGES[period];
  const options = avoid ? pool.filter((item) => item !== avoid) : pool;
  const list = options.length ? options : pool;
  return list[Math.floor(Math.random() * list.length)] ?? pool[0];
}

export function getTimeBasedGreeting(avoidMessage?: string): TimeGreeting {
  const period = periodForHour();
  const icon =
    period === "night"
      ? "moon-outline"
      : period === "morning"
        ? "sunny-outline"
        : "partly-sunny-outline";

  return {
    period,
    greeting: greetingForHour(),
    message: pickMessage(period, avoidMessage),
    icon,
  };
}

export function formatGreetingLine(
  data: TimeGreeting,
  firstName: string
): string {
  return `${data.greeting}, ${firstName}! ${data.message}`;
}

export function formatNaira(value?: number | null, signed = false): string {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const formatted = `₦${abs.toLocaleString("en-NG", {
    maximumFractionDigits: abs % 1 ? 2 : 0,
  })}`;
  if (!signed) return formatted;
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function reviewWhen(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (date >= start) return "TODAY";
  const days = Math.max(1, Math.round((start.getTime() - date.getTime()) / 86400000));
  if (days === 1) return "YESTERDAY";
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 14) return "LAST WEEK";
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} WEEKS AGO`;
  return date
    .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    .toUpperCase();
}

export function timeAgoLong(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (date >= start) return "Today";
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function timeAgo(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatEventWhen(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .toUpperCase();
}

export function mediaUrls(value?: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return absoluteUrl(item.trim());
        if (item && typeof item === "object") {
          const record = item as { url?: string; src?: string };
          return absoluteUrl(String(record.url || record.src || "").trim());
        }
        return undefined;
      })
      .filter((url): url is string => Boolean(url));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        return mediaUrls(JSON.parse(trimmed));
      } catch {
        const url = absoluteUrl(trimmed);
        return url ? [url] : [];
      }
    }
    const url = absoluteUrl(trimmed);
    return url ? [url] : [];
  }
  return [];
}

export function firstMediaUrl(value?: unknown): string | undefined {
  return mediaUrls(value)[0];
}
