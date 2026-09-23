import { getAccount, getWallet, type WalletFundingOptions } from "./account";
import { getUserProfile } from "./auth";
import { apiFetch, readJson, uploadForm } from "./client";
import { getNotifications } from "./notifications";
import { isTruthyFlag } from "../utils/accountStatus";
import { timeAgoLong } from "../utils/format";
import { friendlyError } from "../utils/errors";

export type BusinessAttentionItem = {
  id: string;
  type: "payments" | "delivery" | "restock" | "profile";
  title: string;
  subtitle: string;
};

export type BusinessActivityItem = {
  id: string;
  type: "payment" | "review" | "delivery" | "withdrawal" | "view" | "order";
  title: string;
  details: string;
  created_at?: string | null;
};

export type BusinessOverviewListing = {
  id: string;
  title: string;
  stock: number | null;
  quantity_tracked: boolean;
};

export type BusinessOverview = {
  profile: {
    user_id: number;
    name: string;
    category: string;
    picture: string | null;
    verified: boolean;
    has_cac?: boolean;
    cac_verified?: boolean;
    location: string | null;
    completeness: number;
    missing: string[];
  };
  unread_notifications: number;
  revenue: {
    last_7_days: number;
    previous_7_days: number;
    change_percent: number;
    days: Array<{ key: string; label: string; amount: number; is_today: boolean }>;
  };
  metrics: {
    open_orders: number;
    awaiting_proof: number;
    listing_views: number;
    listing_views_week: number;
    payout_ready: number;
    next_payout_label: string;
  };
  attention: BusinessAttentionItem[];
  activity: BusinessActivityItem[];
  listings: BusinessOverviewListing[];
};

export type MarketplaceListing = {
  id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  unit?: string | null;
  listing_status?: "draft" | "published";
  listing_kind?: "goods" | "service";
  pricing_model?: string | null;
  duration_note?: string | null;
  service_location?: string | null;
  service_area?: string | null;
  availability_note?: string | null;
  stock?: number | null;
  quantity_tracked?: boolean;
  is_sold_out?: boolean;
  can_purchase?: boolean;
  seller_user_id?: string;
  media?: ListingMediaItem[];
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
};

export type ListingCheckoutOrder = {
  id: number;
  sellerUserId: number;
  totalNaira: number;
  sellerName?: string;
  sellerBank: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  };
  items: Array<{
    listingId: string;
    title: string;
    quantity: number;
    unitPriceNaira: number;
  }>;
};

export type ListingCheckoutResult = {
  orders: ListingCheckoutOrder[];
  buyer?: {
    fullName: string;
    phone: string;
    email: string;
  };
  funding?: WalletFundingOptions;
};

export type ListingCheckoutInput = {
  listingId: string | number;
  quantity: number;
  fullName: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  preferredAt?: string;
};

export type ListingMediaItem = {
  type: "image" | "video";
  url: string;
};

export type CreateListingInput = {
  title: string;
  description?: string;
  category?: string;
  listingKind?: "goods" | "service";
  priceNaira?: number;
  stockQuantity?: number | null;
  quantityTracked?: boolean;
  unit?: string | null;
  pricingModel?: string | null;
  durationNote?: string | null;
  serviceLocation?: string | null;
  serviceArea?: string | null;
  availabilityNote?: string | null;
  media?: ListingMediaItem[];
  status: "draft" | "published";
};

type Envelope<T> = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
};

async function marketplaceRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; skipUnauthorized?: boolean } = {}
): Promise<{
  success: boolean;
  message?: string;
  data?: T;
}> {
  try {
    const { timeoutMs = 20000, ...rest } = init;
    const response = await apiFetch(path, {
      auth: true,
      timeoutMs,
      ...rest,
    });
    const payload = await readJson<Envelope<T>>(response);
    if (!response.ok) {
      return {
        success: false,
        message: friendlyError(payload.message || payload.error || "Request failed"),
      };
    }
    return { success: payload.success !== false, message: payload.message, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("offline") };
  }
}

async function readMarketplace<T>(path: string): Promise<{
  success: boolean;
  message?: string;
  data?: T;
}> {
  return marketplaceRequest<T>(path);
}

function emptyWeek(): BusinessOverview["revenue"]["days"] {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date();
  const day = today.getDay();
  const mondayIndex = day === 0 ? 6 : day - 1;
  return labels.map((label, index) => ({
    key: String(index),
    label,
    amount: 0,
    is_today: index === mondayIndex,
  }));
}

function emptyOverview(): BusinessOverview {
  return {
    profile: {
      user_id: 0,
      name: "Your business",
      category: "Business",
      picture: null,
      verified: false,
      has_cac: false,
      cac_verified: false,
      location: null,
      completeness: 0,
      missing: [],
    },
    unread_notifications: 0,
    revenue: {
      last_7_days: 0,
      previous_7_days: 0,
      change_percent: 0,
      days: emptyWeek(),
    },
    metrics: {
      open_orders: 0,
      awaiting_proof: 0,
      listing_views: 0,
      listing_views_week: 0,
      payout_ready: 0,
      next_payout_label: "Friday",
    },
    attention: [],
    activity: [],
    listings: [],
  };
}

function classifyActivity(text: string): BusinessActivityItem["type"] | null {
  const value = text.toLowerCase();
  if (value.includes("review") || value.includes("star")) return "review";
  if (value.includes("withdraw") || value.includes("payout")) return "withdrawal";
  if (value.includes("proof") || value.includes("payment")) return "payment";
  if (value.includes("deliver")) return "delivery";
  if (value.includes("view")) return "view";
  if (value.includes("order") || value.includes("listing")) return "order";
  return null;
}

async function fallbackOverview(): Promise<BusinessOverview> {
  const overview = emptyOverview();
  const [profile, listings, wallet, account, notifications] = await Promise.all([
    getUserProfile(),
    getMyListings(),
    getWallet(),
    getAccount(),
    getNotifications().catch(() => []),
  ]);

  const user = profile.user || {};
  const name =
    String(user.business_name || user.display_name || "").trim() || "Your business";
  const category = String(user.business_type || "Business").trim() || "Business";
  const picture =
    (typeof user.user_picture === "string" && user.user_picture) ||
    (typeof user.picture === "string" && user.picture) ||
    null;
  const missing: string[] = [];
  const checks = [
    [Boolean(picture), "photo"],
    [Boolean(String(user.business_name || "").trim()), "business name"],
    [Boolean(String(user.business_type || "").trim()), "category"],
    [Boolean(String(user.business_location || user.address || "").trim()), "delivery areas"],
    [Boolean(String(user.business_phone || user.user_phone || "").trim()), "phone number"],
    [Boolean(String(user.business_email || user.user_email || "").trim()), "email"],
    [Boolean(String(user.CAC_number || user.cac_number || "").trim()), "CAC number"],
    [listings.length > 0, "first listing"],
  ] as const;
  let filled = 0;
  for (const [ok, label] of checks) {
    if (ok) filled += 1;
    else missing.push(label);
  }

  overview.profile = {
    user_id: Number(user.user_id || 0),
    name,
    category,
    picture,
    verified:
      isTruthyFlag(user.is_verified) ||
      isTruthyFlag(user.user_verified) ||
      isTruthyFlag(account.data?.nin_verified),
    has_cac: Boolean(String(user.CAC_number || user.cac_number || "").trim()),
    cac_verified: Boolean(user.cac_verified),
    location: String(user.business_location || user.address || "").trim() || null,
    completeness: Math.round((filled / checks.length) * 100),
    missing,
  };

  const restock = listings.filter(
    (row) => row.quantity_tracked && (row.is_sold_out || Number(row.stock || 0) <= 2)
  );
  if (restock.length) {
    overview.attention.push({
      id: "restock",
      type: "restock",
      title: `Restock ${restock.length} listing${restock.length === 1 ? "" : "s"}`,
      subtitle: restock
        .slice(0, 3)
        .map((row) => row.title)
        .join(", "),
    });
  }
  if (overview.profile.completeness < 100) {
    const next = missing[0] || "business details";
    overview.attention.push({
      id: "profile",
      type: "profile",
      title: `Profile is ${overview.profile.completeness}% complete`,
      subtitle:
        next === "delivery areas"
          ? "Add delivery areas to rank higher in Discover"
          : `Add ${next} to finish your shop profile`,
    });
  }

  overview.listings = listings.map((row) => ({
    id: String(row.id),
    title: row.title,
    stock: row.quantity_tracked ? Number(row.stock) || 0 : null,
    quantity_tracked: Boolean(row.quantity_tracked),
  }));
  overview.metrics.payout_ready = Number(wallet.data?.balance || 0);
  overview.unread_notifications = notifications.filter((row) => !row.is_read).length;
  overview.activity = notifications
    .map((row): BusinessActivityItem | null => {
      const text = [row.title, row.message, row.action, row.node_type].filter(Boolean).join(" ");
      const type = classifyActivity(text);
      if (!type) return null;
      return {
        id: `note-${row.id}`,
        type,
        title: String(row.title || row.action || "Update").replace(/_/g, " "),
        details: `${row.message || row.action || ""} · ${timeAgoLong(row.time)}`.replace(/^ · /, ""),
        created_at: row.time,
      } satisfies BusinessActivityItem;
    })
    .filter((row): row is BusinessActivityItem => Boolean(row))
    .slice(0, 8);

  return overview;
}

export async function getMyListings(): Promise<MarketplaceListing[]> {
  const result = await readMarketplace<MarketplaceListing[]>("/marketplace/my-listings");
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map((row) => ({
    ...row,
    id: String(row.id),
    title: row.title || "Listing",
    price: Number(row.price) || 0,
    listing_status: row.listing_status === "draft" ? "draft" : "published",
  }));
}

export async function getListing(
  listingId: string | number,
  source?: string
): Promise<MarketplaceListing | null> {
  const id = encodeURIComponent(String(listingId));
  const suffix = source ? `?source=${encodeURIComponent(source)}` : "";
  const result = await marketplaceRequest<MarketplaceListing>(`/marketplace/listings/${id}${suffix}`, {
    skipUnauthorized: true,
  });
  if (!result.success || !result.data?.id) return null;
  return {
    ...result.data,
    id: String(result.data.id),
    title: result.data.title || "Listing",
    price: Number(result.data.price) || 0,
    listing_kind: result.data.listing_kind === "service" ? "service" : "goods",
    media: Array.isArray(result.data.media) ? result.data.media : [],
  };
}

export async function checkoutListing(
  input: ListingCheckoutInput
): Promise<{ success: boolean; message?: string; data?: ListingCheckoutResult }> {
  return marketplaceRequest<ListingCheckoutResult>("/marketplace/listing-checkout", {
    method: "POST",
    body: JSON.stringify({
      listingId: Number(input.listingId),
      quantity: input.quantity,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country || "Nigeria",
      notes: input.notes,
      preferredAt: input.preferredAt,
    }),
  });
}

export type ListingPayCheckout = {
  provider: "paystack" | "safehaven";
  reference: string;
  authorization_url?: string;
  public_key?: string;
  client_id?: string;
  environment?: string;
  amount: number;
  order_id: number;
};

export type ListingPayResult = {
  amount: number;
  reference?: string;
  already?: boolean;
  order_id: number;
  status?: string;
  cbc_amount?: number;
  cashback_points?: number | null;
  manual?: WalletFundingOptions["manual"];
};

export async function payListingCbcCard(
  orderId: number,
  input: { cardNumber: string; cvc: string; cardPin: string }
) {
  return marketplaceRequest<ListingPayResult>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/cbc-card`,
    {
      method: "POST",
      body: JSON.stringify({
        card_number: input.cardNumber,
        cvc: input.cvc,
        card_pin: input.cardPin,
      }),
    }
  );
}

export async function payListingWallet(orderId: number) {
  return marketplaceRequest<ListingPayResult>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/wallet`,
    { method: "POST" }
  );
}

export async function startListingPaystack(orderId: number, callback_url?: string) {
  return marketplaceRequest<ListingPayCheckout>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/paystack`,
    { method: "POST", body: JSON.stringify({ callback_url }) }
  );
}

export async function verifyListingPaystack(orderId: number, reference: string) {
  return marketplaceRequest<ListingPayResult>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/paystack/verify`,
    { method: "POST", body: JSON.stringify({ reference }) }
  );
}

export async function startListingSafehaven(orderId: number, callback_url?: string) {
  return marketplaceRequest<ListingPayCheckout>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/safehaven`,
    { method: "POST", body: JSON.stringify({ callback_url }) }
  );
}

export async function verifyListingSafehaven(orderId: number, reference: string) {
  return marketplaceRequest<ListingPayResult>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/safehaven/verify`,
    { method: "POST", body: JSON.stringify({ reference }) }
  );
}

export async function submitListingTransfer(
  orderId: number,
  proof: { uri: string; name?: string; type?: string }
) {
  const uri = proof.uri;
  const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const form = new FormData();
  form.append("proof", {
    uri,
    name: proof.name || `transfer.${ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg"}`,
    type: proof.type || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"),
  } as unknown as Blob);
  try {
    const { promise } = uploadForm(
      `/marketplace/orders/${encodeURIComponent(String(orderId))}/pay/manual`,
      form,
      { timeoutMs: 60000 }
    );
    const result = await promise;
    const payload = result.data as Envelope<ListingPayResult> & { error?: string };
    if (result.aborted) {
      return { success: false, message: friendlyError("timeout") };
    }
    if (!result.ok || payload.success === false) {
      return { success: false, message: friendlyError(payload.message || payload.error || "upload") };
    }
    return { success: true, message: payload.message, data: payload.data };
  } catch {
    return { success: false, message: friendlyError("upload") };
  }
}

export async function uploadListingMedia(file: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}): Promise<{ success: boolean; data?: ListingMediaItem; message?: string }> {
  const uri = file.uri;
  const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const name = file.name || `listing.${ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg"}`;
  const type =
    file.mimeType ||
    (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
  const form = new FormData();
  form.append(
    "file",
    {
      uri,
      name,
      type,
    } as unknown as Blob
  );

  const result = await marketplaceRequest<{ url: string; type?: string }>("/marketplace/upload-media", {
    method: "POST",
    body: form,
    timeoutMs: 45000,
  });
  if (!result.success || !result.data?.url) {
    return { success: false, message: result.message || "Upload failed" };
  }
  return {
    success: true,
    data: {
      url: result.data.url,
      type: result.data.type === "video" ? "video" : "image",
    },
  };
}

export async function createListing(input: CreateListingInput): Promise<{
  success: boolean;
  message?: string;
  data?: MarketplaceListing;
}> {
  return marketplaceRequest<MarketplaceListing>("/marketplace/listings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBusinessOverview(): Promise<BusinessOverview> {
  const result = await readMarketplace<BusinessOverview>("/marketplace/business/overview");
  if (result.success && result.data?.profile) {
    return {
      ...emptyOverview(),
      ...result.data,
      profile: { ...emptyOverview().profile, ...(result.data.profile || {}) },
      revenue: {
        ...emptyOverview().revenue,
        ...(result.data.revenue || {}),
        days: Array.isArray(result.data.revenue?.days) && result.data.revenue.days.length
          ? result.data.revenue.days
          : emptyWeek(),
      },
      metrics: { ...emptyOverview().metrics, ...(result.data.metrics || {}) },
      attention: Array.isArray(result.data.attention) ? result.data.attention : [],
      activity: Array.isArray(result.data.activity) ? result.data.activity : [],
      listings: Array.isArray(result.data.listings) ? result.data.listings : [],
    };
  }
  return fallbackOverview();
}

export type InsightsPeriodDays = 7 | 30 | 90;
export type InsightsTrafficKey = "discover" | "marketplace" | "direct" | "feed";

export type BusinessInsights = {
  period: { days: InsightsPeriodDays; label: string; start: string; end: string };
  revenue: {
    total: number;
    previous_total: number;
    change_percent: number;
    days: Array<{ key: string; label: string; amount: number; is_today: boolean }>;
  };
  orders: { count: number; previous_count: number; delta: number };
  listing_views: { count: number; previous_count: number; week_count: number; tracked: boolean };
  customers: { count: number; repeat_buyers: number };
  conversion: { percent: number; label: string };
  listings: Array<{
    id: string;
    title: string;
    views: number;
    orders: number;
    progress: number;
  }>;
  traffic: Array<{
    key: InsightsTrafficKey;
    label: string;
    percent: number;
    count: number;
  }>;
  next_step: {
    source_key: InsightsTrafficKey | null;
    restock_title: string | null;
    add_photos: boolean;
    top_listing_title: string | null;
    period: "week" | "month" | "quarter";
    empty_shop: boolean;
    text: string;
  };
};

function emptyInsights(days: InsightsPeriodDays = 30): BusinessInsights {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return {
    period: { days, label: `${days} days`, start: "", end: "" },
    revenue: {
      total: 0,
      previous_total: 0,
      change_percent: 0,
      days: labels.map((label, index) => ({
        key: String(index),
        label,
        amount: 0,
        is_today: false,
      })),
    },
    orders: { count: 0, previous_count: 0, delta: 0 },
    listing_views: { count: 0, previous_count: 0, week_count: 0, tracked: false },
    customers: { count: 0, repeat_buyers: 0 },
    conversion: { percent: 0, label: "Views that become orders" },
    listings: [],
    traffic: [
      { key: "discover", label: "Discover search", percent: 0, count: 0 },
      { key: "marketplace", label: "Marketplace", percent: 0, count: 0 },
      { key: "direct", label: "Direct / shared link", percent: 0, count: 0 },
      { key: "feed", label: "City feed", percent: 0, count: 0 },
    ],
    next_step: {
      source_key: null,
      restock_title: null,
      add_photos: false,
      top_listing_title: null,
      period: days >= 90 ? "quarter" : days >= 30 ? "month" : "week",
      empty_shop: true,
      text: "",
    },
  };
}

export async function getBusinessInsights(
  days: InsightsPeriodDays = 30
): Promise<BusinessInsights> {
  const fallback = emptyInsights(days);
  const result = await readMarketplace<BusinessInsights>(
    `/marketplace/business/insights?days=${days}`
  );
  if (!result.success || !result.data) {
    throw new Error(result.message || "Could not load insights");
  }
  const data = result.data;
  return {
    ...fallback,
    ...data,
    period: { ...fallback.period, ...(data.period || {}), days },
    revenue: {
      ...fallback.revenue,
      ...(data.revenue || {}),
      days:
        Array.isArray(data.revenue?.days) && data.revenue.days.length
          ? data.revenue.days
          : fallback.revenue.days,
    },
    orders: { ...fallback.orders, ...(data.orders || {}) },
    listing_views: { ...fallback.listing_views, ...(data.listing_views || {}) },
    customers: { ...fallback.customers, ...(data.customers || {}) },
    conversion: { ...fallback.conversion, ...(data.conversion || {}) },
    listings: Array.isArray(data.listings) ? data.listings : [],
    traffic: Array.isArray(data.traffic) && data.traffic.length ? data.traffic : fallback.traffic,
    next_step: { ...fallback.next_step, ...(data.next_step || {}) },
  };
}

export type BusinessManage = {
  profile: {
    user_id: number;
    name: string;
    category: string;
    picture: string | null;
    verified: boolean;
    cac_number: string | null;
    hours: string | null;
    delivery: string | null;
  };
  stats: {
    live_listings: number;
    to_approve: number;
    payout_ready: number;
    next_payout_label: string;
  };
  selling: {
    catalog_count: number;
    orders_awaiting: number;
    reviews: { average: number; count: number };
  };
  money: {
    wallet_available: number;
    membership: { title: string | null; renews_at: string | null; label: string };
  };
  community: {
    published_posts: number;
    scheduled_posts: number;
  };
  account: {
    verification_label: string;
    staff_count: number;
    details_label: string;
  };
};

function emptyManage(): BusinessManage {
  return {
    profile: {
      user_id: 0,
      name: "Your business",
      category: "Business",
      picture: null,
      verified: false,
      cac_number: null,
      hours: null,
      delivery: null,
    },
    stats: {
      live_listings: 0,
      to_approve: 0,
      payout_ready: 0,
      next_payout_label: "Friday",
    },
    selling: {
      catalog_count: 0,
      orders_awaiting: 0,
      reviews: { average: 0, count: 0 },
    },
    money: {
      wallet_available: 0,
      membership: { title: null, renews_at: null, label: "No plan yet" },
    },
    community: {
      published_posts: 0,
      scheduled_posts: 0,
    },
    account: {
      verification_label: "Add CAC number",
      staff_count: 0,
      details_label: "Name, category, hours, delivery",
    },
  };
}

export async function getBusinessManage(): Promise<BusinessManage> {
  const result = await readMarketplace<BusinessManage>("/marketplace/business/manage");
  if (result.success && result.data?.profile) {
    return {
      ...emptyManage(),
      ...result.data,
      stats: { ...emptyManage().stats, ...(result.data.stats || {}) },
      selling: {
        ...emptyManage().selling,
        ...(result.data.selling || {}),
        reviews: {
          ...emptyManage().selling.reviews,
          ...(result.data.selling?.reviews || {}),
        },
      },
      money: {
        ...emptyManage().money,
        ...(result.data.money || {}),
        membership: {
          ...emptyManage().money.membership,
          ...(result.data.money?.membership || {}),
        },
      },
      community: { ...emptyManage().community, ...(result.data.community || {}) },
      account: { ...emptyManage().account, ...(result.data.account || {}) },
    };
  }

  const overview = await fallbackOverview();
  const manage = emptyManage();
  manage.profile = {
    ...manage.profile,
    user_id: overview.profile.user_id,
    name: overview.profile.name,
    category: overview.profile.category,
    picture: overview.profile.picture,
    verified: overview.profile.verified,
    delivery: overview.profile.location,
  };
  manage.stats = {
    live_listings: overview.listings.filter(
      (row) => !row.quantity_tracked || (row.stock ?? 0) > 0
    ).length,
    to_approve: overview.metrics.awaiting_proof,
    payout_ready: overview.metrics.payout_ready,
    next_payout_label: overview.metrics.next_payout_label,
  };
  manage.selling = {
    catalog_count: overview.listings.length,
    orders_awaiting: overview.metrics.awaiting_proof,
    reviews: { average: 0, count: 0 },
  };
  manage.money.wallet_available = overview.metrics.payout_ready;
  manage.account.verification_label = overview.profile.cac_verified
    ? "CAC verified"
    : overview.profile.has_cac
      ? "CAC pending"
      : "Add CAC number";
  return manage;
}

export type BusinessPageProfile = {
  user_id: number;
  name: string;
  handle: string;
  category: string;
  bio: string | null;
  location: string | null;
  picture: string | null;
  cover: string | null;
  phone: string | null;
  email: string | null;
  verified: boolean;
  has_cac?: boolean;
  cac_verified: boolean;
  cac_number: string | null;
  badge_color?: string | null;
  hours_open?: string;
  hours_close?: string;
  hours_days?: string[];
  hours_label: string;
  is_open: boolean;
  membership_label: string | null;
  follower_count: number;
  rating_average: number;
  rating_count: number;
  reply_label: string;
  following: boolean;
  is_owner: boolean;
  account_status?: string;
  deactivated?: boolean;
};

export type BusinessPageReview = {
  id: string;
  rating: number;
  comment: string;
  created_at?: string;
  reviewer_user_id?: number;
  reviewer_name: string;
  reviewer_picture?: string | null;
};

export type BusinessPage = {
  profile: BusinessPageProfile;
  posts: FeedPostLike[];
  catalog: Array<{
    id: string;
    title: string;
    description?: string;
    price: number;
    image_url?: string | null;
    category?: string | null;
    listing_kind?: "goods" | "service";
    unit?: string | null;
    duration_note?: string | null;
    service_location?: string | null;
    service_area?: string | null;
    availability_note?: string | null;
    stock?: number | null;
    quantity_tracked?: boolean;
    is_sold_out?: boolean;
    can_purchase?: boolean;
  }>;
  photos: Array<{ url: string; source: string; id: string; listing_id?: string }>;
  reviews: { average: number; count: number; items: BusinessPageReview[] };
};

type FeedPostLike = {
  post_id: number;
  user_id?: number;
  text?: string;
  caption?: string;
  created_at?: string;
  time_ago?: string;
  media?: Array<{ url: string; type?: string }>;
  media_urls?: string[];
  author?: {
    id?: number;
    name?: string;
    picture?: string | null;
    verified?: boolean;
    has_cac?: boolean;
    username?: string | null;
    account_type?: string;
  };
  reactions_count?: number;
  comments_count?: number;
  shares_count?: number;
  user_reacted?: boolean;
  user_saved?: boolean;
};

function emptyPage(): BusinessPage {
  return {
    profile: {
      user_id: 0,
      name: "",
      handle: "",
      category: "",
      bio: null,
      location: null,
      picture: null,
      cover: null,
      phone: null,
      email: null,
      verified: false,
      has_cac: false,
      cac_verified: false,
      cac_number: null,
      hours_open: "",
      hours_close: "",
      hours_days: [],
      hours_label: "",
      is_open: false,
      membership_label: null,
      follower_count: 0,
      rating_average: 0,
      rating_count: 0,
      reply_label: "",
      following: false,
      is_owner: false,
    },
    posts: [],
    catalog: [],
    photos: [],
    reviews: { average: 0, count: 0, items: [] },
  };
}

export async function getBusinessPage(
  userId?: number,
  source?: string
): Promise<BusinessPage | null> {
  const path = userId ? `/marketplace/business/page/${userId}` : "/marketplace/business/page";
  const suffix =
    userId && source
      ? `${path}${path.includes("?") ? "&" : "?"}source=${encodeURIComponent(source)}`
      : path;
  const result = await marketplaceRequest<BusinessPage>(suffix, { skipUnauthorized: true });
  if (result.success && result.data?.profile) {
    const profile = result.data.profile;
    return {
      ...emptyPage(),
      ...result.data,
      profile: {
        ...emptyPage().profile,
        ...profile,
        hours_days: Array.isArray(profile.hours_days) ? profile.hours_days : [],
        hours_label: String(profile.hours_label || "").trim(),
        hours_open: String(profile.hours_open || "").trim(),
        hours_close: String(profile.hours_close || "").trim(),
      },
      posts: Array.isArray(result.data.posts) ? result.data.posts : [],
      catalog: Array.isArray(result.data.catalog) ? result.data.catalog : [],
      photos: Array.isArray(result.data.photos) ? result.data.photos : [],
      reviews: {
        ...emptyPage().reviews,
        ...(result.data.reviews || {}),
        items: Array.isArray(result.data.reviews?.items) ? result.data.reviews.items : [],
      },
    };
  }
  return null;
}

export async function updateBusinessHours(params: {
  hours_open: string;
  hours_close: string;
  hours_days: string[];
}): Promise<{
  success: boolean;
  message?: string;
  data?: {
    open: string;
    close: string;
    days: string[];
    label: string;
    is_open: boolean;
  };
}> {
  return marketplaceRequest("/marketplace/business/hours", {
    method: "PUT",
    body: JSON.stringify({
      hours_open: params.hours_open,
      hours_close: params.hours_close,
      hours_days: params.hours_days,
    }),
  });
}

export async function toggleBusinessFollow(userId: number): Promise<boolean | null> {
  try {
    const response = await apiFetch(`/marketplace/business/page/${userId}/follow`, {
      method: "POST",
      auth: true,
    });
    const payload = await readJson<{ data?: { following?: boolean } }>(response);
    if (!response.ok) return null;
    return Boolean(payload.data?.following);
  } catch {
    return null;
  }
}

export type BusinessFollower = {
  user_id: number;
  display_name: string;
  user_picture?: string | null;
  address?: string | null;
};

export async function getBusinessFollowers(): Promise<BusinessFollower[]> {
  const result = await readMarketplace<BusinessFollower[]>("/marketplace/business/followers");
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data
    .map((row) => ({
      user_id: Number(row.user_id),
      display_name: String(row.display_name || "").trim() || `User ${row.user_id}`,
      user_picture: row.user_picture || null,
      address: String(row.address || "").trim() || "Jos",
    }))
    .filter((row) => row.user_id > 0);
}

export async function getBusinessesIFollow(): Promise<BusinessFollower[]> {
  const result = await readMarketplace<BusinessFollower[]>("/marketplace/business/following");
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data
    .map((row) => ({
      user_id: Number(row.user_id),
      display_name: String(row.display_name || "").trim() || `User ${row.user_id}`,
      user_picture: row.user_picture || null,
      address: String(row.address || "").trim() || "Jos",
    }))
    .filter((row) => row.user_id > 0);
}

export type BusinessWalletTx = {
  id: string;
  kind: "order" | "withdrawal" | "membership" | "funding";
  direction: "in" | "out";
  title: string;
  subtitle?: string;
  amount: number;
  status: "approved" | "pending" | "failed";
  reason?: string | null;
  created_at?: string | null;
};

export type BusinessPayoutAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
  account_number_masked: string;
  label: string;
};

export type BusinessWallet = {
  available: number;
  held_for_buyers: number;
  lifetime_sales: number;
  currency: string;
  payout_account: BusinessPayoutAccount | null;
  funding?: WalletFundingOptions | null;
  transactions: BusinessWalletTx[];
};

function emptyWallet(): BusinessWallet {
  return {
    available: 0,
    held_for_buyers: 0,
    lifetime_sales: 0,
    currency: "NGN",
    payout_account: null,
    transactions: [],
  };
}

function normalizeWallet(data?: Partial<BusinessWallet> | null): BusinessWallet {
  const empty = emptyWallet();
  const account = data?.payout_account;
  return {
    ...empty,
    ...data,
    available: Number(data?.available || 0),
    held_for_buyers: Number(data?.held_for_buyers || 0),
    lifetime_sales: Number(data?.lifetime_sales || 0),
    currency: data?.currency || "NGN",
    payout_account: account?.bank_name
      ? {
          bank_name: account.bank_name,
          account_name: account.account_name || "",
          account_number: account.account_number || "",
          account_number_masked: account.account_number_masked || "",
          label: account.label || [account.bank_name, account.account_number_masked].filter(Boolean).join(" "),
        }
      : null,
    transactions: Array.isArray(data?.transactions)
      ? data.transactions.map((item) => ({
          ...item,
          reason: item.reason ? String(item.reason) : null,
        }))
      : [],
  };
}

function fallbackWalletTx(item: {
  id?: string;
  kind?: string;
  title?: string;
  subtitle?: string;
  amount?: number;
  status?: string;
  created_at?: string | null;
  method?: string;
}): BusinessWalletTx {
  const method = String(item.method || item.kind || "").toLowerCase();
  const payout = method.includes("payout") || method.includes("withdraw");
  const membership = method.includes("membership") || item.kind === "order";
  const statusRaw = String(item.status || "").toLowerCase();
  const status: BusinessWalletTx["status"] =
    statusRaw === "approved" || statusRaw === "1"
      ? "approved"
      : statusRaw === "failed" || statusRaw === "rejected" || statusRaw === "2"
        ? "failed"
        : "pending";
  const amount = Number(item.amount || 0);
  const direction: BusinessWalletTx["direction"] = payout || membership ? "out" : "in";
  return {
    id: String(item.id || `${method}-${item.created_at || amount}`),
    kind: payout ? "withdrawal" : membership ? "membership" : "funding",
    direction,
    title:
      item.title ||
      (payout ? "Withdrawal to bank" : membership ? "Membership renewal" : "Wallet funding"),
    subtitle: item.subtitle,
    amount: direction === "out" ? -Math.abs(amount) : Math.abs(amount),
    status,
    created_at: item.created_at,
  };
}

async function fallbackBusinessWallet(): Promise<BusinessWallet> {
  const [wallet, overview] = await Promise.all([getWallet(), getBusinessOverview().catch(() => null)]);
  const available = Number(wallet.data?.balance || overview?.metrics.payout_ready || 0);
  return {
    available,
    held_for_buyers: 0,
    lifetime_sales: Number(overview?.revenue.last_7_days || 0),
    currency: wallet.data?.currency || "NGN",
    payout_account: null,
    transactions: (wallet.data?.transactions || []).map(fallbackWalletTx),
  };
}

export async function getBusinessWallet(): Promise<{
  success: boolean;
  message?: string;
  data?: BusinessWallet;
}> {
  const result = await marketplaceRequest<BusinessWallet>("/marketplace/business/wallet");
  if (result.success && result.data) {
    return { success: true, data: normalizeWallet(result.data) };
  }
  try {
    return { success: true, data: await fallbackBusinessWallet() };
  } catch {
    return { success: false, message: result.message || "Could not load wallet." };
  }
}

export async function updateBusinessPayoutAccount(input: {
  bank_name: string;
  account_name: string;
  account_number: string;
}): Promise<{ success: boolean; message?: string; data?: BusinessWallet }> {
  const result = await marketplaceRequest<BusinessWallet>("/marketplace/business/wallet/payout-account", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (result.success && result.data) {
    return { success: true, data: normalizeWallet(result.data) };
  }
  return { success: false, message: result.message || "Could not save payout account." };
}

export async function withdrawBusinessWallet(
  amount: number,
  method?: "paystack" | "manual"
): Promise<{
  success: boolean;
  message?: string;
  data?: BusinessWallet;
}> {
  const result = await marketplaceRequest<BusinessWallet>("/marketplace/business/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ amount, method: method || "manual" }),
  });
  if (result.success) {
    return {
      success: true,
      message: result.message,
      data: result.data ? normalizeWallet(result.data) : undefined,
    };
  }
  return { success: false, message: result.message || "Could not submit withdrawal." };
}

export type PendingRating = {
  order_id: number;
  business_user_id: number;
  business_name: string;
  business_picture?: string | null;
  listing_id?: number | null;
  listing_title: string;
  listing_kind: "goods" | "service";
  status: string;
  total_naira: number;
  fulfilled_at?: string | null;
  dismissed?: boolean;
};

export type PendingRatings = {
  items: PendingRating[];
  next: PendingRating | null;
};

export async function getPendingRatings(): Promise<PendingRatings> {
  const result = await marketplaceRequest<PendingRatings>("/marketplace/reviews/pending", {
    skipUnauthorized: true,
  });
  if (result.success && result.data) {
    return {
      items: Array.isArray(result.data.items) ? result.data.items : [],
      next: result.data.next || null,
    };
  }
  return { items: [], next: null };
}

export async function getRatingPrompt(orderId: number): Promise<{
  success: boolean;
  message?: string;
  data?: PendingRating;
}> {
  return marketplaceRequest<PendingRating>(
    `/marketplace/orders/${encodeURIComponent(String(orderId))}/review`,
    { skipUnauthorized: true }
  );
}

export async function submitOrderReview(
  orderId: number,
  input: { rating: number; comment?: string }
): Promise<{ success: boolean; message?: string }> {
  return marketplaceRequest(`/marketplace/orders/${encodeURIComponent(String(orderId))}/review`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function dismissOrderReview(orderId: number): Promise<{ success: boolean }> {
  return marketplaceRequest(`/marketplace/orders/${encodeURIComponent(String(orderId))}/review/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
    skipUnauthorized: true,
  });
}

export type SellerOrderItem = {
  title: string;
  quantity: number;
  unit_price_naira: number;
  listing_id?: number | null;
};

export type SellerOrder = {
  id: number;
  code: string;
  buyer_user_id?: number | null;
  buyer_name: string;
  buyer_account_name?: string | null;
  buyer_account_type?: string | null;
  buyer_picture?: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  buyer_address?: string | null;
  buyer_notes?: string | null;
  title: string;
  items?: SellerOrderItem[];
  listing_kind: "goods" | "service";
  total_naira: number;
  status: string;
  payment_provider?: string | null;
  can_fulfill: boolean;
  created_at?: string | null;
  fulfilled_at?: string | null;
};

export async function getBusinessOrders(): Promise<{
  awaiting: SellerOrder[];
  recent: SellerOrder[];
  items: SellerOrder[];
}> {
  const result = await marketplaceRequest<{
    awaiting?: SellerOrder[];
    recent?: SellerOrder[];
    items?: SellerOrder[];
  }>("/marketplace/business/orders");
  if (result.success && result.data) {
    return {
      awaiting: Array.isArray(result.data.awaiting) ? result.data.awaiting : [],
      recent: Array.isArray(result.data.recent) ? result.data.recent : [],
      items: Array.isArray(result.data.items) ? result.data.items : [],
    };
  }
  return { awaiting: [], recent: [], items: [] };
}

export async function fulfillBusinessOrder(orderId: number): Promise<{
  success: boolean;
  message?: string;
  data?: { status: string; listing_kind: "goods" | "service"; already?: boolean };
}> {
  return marketplaceRequest(`/marketplace/orders/${encodeURIComponent(String(orderId))}/fulfill`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type BusinessReviewFilter = "all" | "needs_reply" | "high" | "low";

export type BusinessReviewItem = {
  id: string;
  rating: number;
  comment: string;
  created_at?: string;
  listing_title?: string | null;
  listing_kind?: "goods" | "service";
  order_id?: number | null;
  reviewer_user_id?: number;
  reviewer_name: string;
  reviewer_picture?: string | null;
  reply_text?: string | null;
  replied_at?: string | null;
};

export type BusinessReviewsPage = {
  filter: BusinessReviewFilter;
  summary: {
    average: number;
    count: number;
    stars: Array<{ stars: number; count: number }>;
  };
  items: BusinessReviewItem[];
};

function emptyReviewsPage(filter: BusinessReviewFilter = "all"): BusinessReviewsPage {
  return {
    filter,
    summary: {
      average: 0,
      count: 0,
      stars: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })),
    },
    items: [],
  };
}

export async function getBusinessReviews(
  filter: BusinessReviewFilter = "all"
): Promise<BusinessReviewsPage> {
  const result = await marketplaceRequest<BusinessReviewsPage>(
    `/marketplace/business/reviews?filter=${encodeURIComponent(filter)}`
  );
  if (result.success && result.data) {
    const stars = Array.isArray(result.data.summary?.stars)
      ? result.data.summary.stars
      : emptyReviewsPage().summary.stars;
    return {
      filter: result.data.filter || filter,
      summary: {
        average: Number(result.data.summary?.average) || 0,
        count: Number(result.data.summary?.count) || 0,
        stars,
      },
      items: Array.isArray(result.data.items) ? result.data.items : [],
    };
  }
  return emptyReviewsPage(filter);
}

export async function replyToBusinessReview(
  reviewId: string,
  reply: string
): Promise<{ success: boolean; message?: string }> {
  return marketplaceRequest(
    `/marketplace/business/reviews/${encodeURIComponent(reviewId)}/reply`,
    { method: "POST", body: JSON.stringify({ reply }) }
  );
}
