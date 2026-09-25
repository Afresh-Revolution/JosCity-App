export const LISTING_CATEGORIES = [
  "Agriculture & Farming",
  "Apparel & accessories",
  "Autos & vehicles",
  "Baby & children's products",
  "Beauty products & services",
  "Computers & peripherals",
  "Consumers & Electronics",
  "Food & groceries",
  "Gifts & Occasions",
  "Home & Garden",
  "Photography & video",
  "Tailoring & fashion",
  "Home & repair services",
  "Events & entertainment",
  "Services",
  "Other",
] as const;

export const SERVICE_UNITS = [
  "per session",
  "per hour",
  "per day",
  "per outfit",
  "starting from",
] as const;

export const SERVICE_PLACES = [
  { id: "studio", label: "At my shop or studio" },
  { id: "client_site", label: "At the customer's location" },
  { id: "both", label: "At my place or the customer's" },
  { id: "remote", label: "Online / remote" },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type ListingKind = "goods" | "service";
export type ServiceUnit = (typeof SERVICE_UNITS)[number];
export type ServicePlaceId = (typeof SERVICE_PLACES)[number]["id"];
