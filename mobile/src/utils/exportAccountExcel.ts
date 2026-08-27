import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  exportAccount,
  getAccount,
  getActivity,
  getMembership,
  getPoints,
  getPreferences,
  getReferrals,
  getSecurity,
  getSupportMessages,
  getWallet,
  type AccountExport,
  type ActivityItem,
  type MembershipInfo,
  type ReferralInfo,
  type SecurityInfo,
} from "../api/account";
import { getUserProfile } from "../api/auth";
import { getSavedPosts } from "../api/feed";
import { getBusinessPage, getMyListings } from "../api/marketplace";
import { friendDisplayName, getMyFriends, getPersonalPage } from "../api/social";
import { getUser } from "../storage/session";
import { formatMemberDisplayId, readNumericUserId } from "./memberDisplayId";
import { buildXlsx, bytesToBase64, type WorkbookSheet } from "./xlsxWorkbook";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function text(...values: unknown[]): string {
  for (const value of values) {
    if (value == null || value === false) continue;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") continue;
    const next = String(value).trim();
    if (next && next !== "undefined" && next !== "null") return next;
  }
  return "";
}

function yesNo(value: unknown): string {
  if (value == null || value === "") return "";
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") {
    return "Yes";
  }
  if (value === false || value === 0 || value === "0" || String(value).toLowerCase() === "false") {
    return "No";
  }
  return String(value);
}

function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pairs(entries: Array<[string, unknown]>): string[][] {
  return [["Field", "Value"], ...entries.map(([key, value]) => [key, cell(value)])];
}

function table(headers: string[], rows: Array<Array<unknown>>): string[][] {
  if (!rows.length) return [headers, ["No records"]];
  return [headers, ...rows.map((row) => row.map(cell))];
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

type PackedExport = AccountExport & {
  membership?: MembershipInfo | null;
  security?: Pick<SecurityInfo, "email" | "nin_verified" | "nin_masked" | "two_factor_enabled" | "account_status"> | null;
};

function sheetsFromExport(data: PackedExport): WorkbookSheet[] {
  const profile = data.profile || { email: "", account_status: "", account_type: "", nin_verified: false };
  const prefs = data.preferences;
  const referrals = data.referrals;
  const wallet = data.wallet;
  const points = data.points;
  const membership = data.membership;
  const security = data.security;
  const activity = data.activity || [];
  const sales = data.sales || [];
  const posts = data.posts || [];
  const transactions = data.transactions || [];
  const friends = data.friends || [];
  const listings = data.listings || [];
  const support = data.support || [];
  const referred = referrals?.referrals || [];

  return [
    {
      name: "Profile",
      rows: pairs([
        ["Exported at", data.exported_at],
        ["Member ID", profile.member_id],
        ["User ID", profile.user_id],
        ["Name", profile.name],
        ["First name", profile.first_name],
        ["Last name", profile.last_name],
        ["Username", profile.username],
        ["Email", profile.email],
        ["Phone", profile.phone],
        ["Address", profile.address],
        ["Bio", profile.bio],
        ["Account type", profile.account_type],
        ["Account status", profile.account_status],
        ["Banned", yesNo(profile.banned)],
        ["Member since", profile.member_since],
        ["NIN verified", yesNo(profile.nin_verified)],
        ["Business name", profile.business_name],
        ["Business type", profile.business_type],
        ["Business email", profile.business_email],
        ["Business phone", profile.business_phone],
        ["Business location", profile.business_location],
        ["Business hours", profile.business_hours],
        ["Hours open", profile.hours_open],
        ["Hours close", profile.hours_close],
        ["Hours days", profile.hours_days],
      ]),
    },
    {
      name: "Security",
      rows: pairs([
        ["Email", security?.email || profile.email],
        ["Two-factor enabled", yesNo(security?.two_factor_enabled)],
        ["NIN verified", yesNo(security?.nin_verified ?? profile.nin_verified)],
        ["NIN (masked)", security?.nin_masked],
        ["Account status", security?.account_status || profile.account_status],
      ]),
    },
    {
      name: "Preferences",
      rows: pairs([
        ["Language", prefs?.language],
        ["Area", prefs?.area],
        ["Appearance", prefs?.appearance],
      ]),
    },
    {
      name: "Wallet",
      rows: pairs([
        ["Balance", wallet?.balance],
        ["Currency", wallet?.currency || "NGN"],
        ["Wallet address", wallet?.wallet_address],
        ["Points", points?.points],
        ["CBC", points?.cbc],
        ["USD equivalent", points?.usd],
      ]),
    },
    {
      name: "Membership",
      rows: pairs([
        ["Member ID", membership?.member_id || profile.member_id],
        ["Package", membership?.current?.title],
        ["Status", membership?.current?.status],
        ["Amount", membership?.current?.amount],
        ["Renews at", membership?.current?.renews_at],
        ["Billing", membership?.current?.billing || membership?.billing_copy],
      ]),
    },
    {
      name: "Transactions",
      rows: table(
        ["ID", "Title", "Amount", "Method", "Status", "Date"],
        transactions.map((row) => [
          row.id,
          row.title || "",
          row.amount,
          row.method,
          row.status,
          row.created_at,
        ])
      ),
    },
    {
      name: "Activity",
      rows: table(
        ["ID", "Title", "Amount", "Status", "Source", "Date"],
        activity.map((row: ActivityItem) => [
          row.id,
          row.title,
          row.amount,
          row.status,
          row.source,
          row.created_at,
        ])
      ),
    },
    {
      name: "Sales",
      rows: table(
        ["ID", "Title", "Amount", "Status", "Source", "Date"],
        sales.map((row) => [row.id, row.title, row.amount, row.status, row.source, row.created_at])
      ),
    },
    {
      name: "Posts",
      rows: table(
        ["ID", "Type", "Text", "Date"],
        posts.map((row) => [row.id, row.type, row.text, row.created_at])
      ),
    },
    {
      name: "Referrals",
      rows: pairs([
        ["Referral code", referrals?.referral_code],
        ["Share URL", referrals?.share_url],
        ["Member ID", referrals?.member_id],
        ["Code active", yesNo(referrals?.code_active)],
        ["Your posts", referrals?.posts_count],
        ["Posts required to share", referrals?.posts_required_to_share],
        ["Referred by code", referrals?.referred_by_code],
        ["People referred", referrals?.stats?.referrals],
        ["Approved", referrals?.stats?.approved],
        ["Earnings (NGN)", referrals?.stats?.earnings_naira],
      ]),
    },
    {
      name: "People referred",
      rows: table(
        ["Name", "Member ID", "User ID", "Status", "Posts", "Earning (NGN)", "Joined"],
        (referred || []).map((person) => [
          person.name,
          person.member_id,
          person.user_id,
          person.status,
          person.post_count,
          person.earning_naira,
          person.joined_at,
        ])
      ),
    },
    {
      name: "Friends",
      rows: table(
        ["Name", "User ID", "Friends since"],
        friends.map((row) => [row.name, row.user_id, row.created_at])
      ),
    },
    {
      name: "Listings",
      rows: table(
        ["ID", "Name", "Price", "Status", "Kind", "Category", "Stock"],
        listings.map((row) => [
          row.id,
          row.name,
          row.price,
          row.status,
          row.kind,
          row.category,
          row.stock,
        ])
      ),
    },
    {
      name: "Points",
      rows: table(
        ["Category", "Count", "Points"],
        (points?.breakdown || []).map((row) => [row.label, row.count, row.points])
      ),
    },
    {
      name: "Support",
      rows: table(
        ["ID", "Subject", "Message", "Status", "Date"],
        support.map((row) => [row.id, row.subject, row.message, row.status, row.created_at])
      ),
    },
  ];
}

async function downloadOnWeb(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: EXCEL_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareFile(bytes: Uint8Array, filename: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  try {
    file.write(bytesToBase64(bytes), { encoding: "base64" });
  } catch {
    file.write(bytes);
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: EXCEL_MIME,
    dialogTitle: "Download my data",
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
}

function postText(row: Record<string, unknown>): string {
  return text(row.text, row.caption, row.reel_title);
}

export async function loadAccountExport(): Promise<PackedExport> {
  const sessionUser = await getUser();
  const userId = readNumericUserId(sessionUser);

  const [
    exported,
    account,
    profileResult,
    wallet,
    points,
    referrals,
    activity,
    preferences,
    support,
    membership,
    security,
    friends,
    listings,
    saved,
    page,
    businessPage,
  ] = await Promise.all([
    exportAccount(),
    getAccount(),
    getUserProfile({ skipUnauthorized: true }).catch(() => ({ success: false as const })),
    getWallet(),
    getPoints(),
    getReferrals(),
    getActivity(),
    getPreferences(),
    getSupportMessages(),
    getMembership(),
    getSecurity(),
    getMyFriends().catch(() => []),
    getMyListings().catch(() => []),
    getSavedPosts(1, 50).catch(() => ({ success: false, data: [] })),
    userId ? getPersonalPage(userId) : Promise.resolve(null),
    getBusinessPage().catch(() => null),
  ]);

  const liveUser = profileResult.user || {};
  const exportData = exported.data;
  const accountData = account.data;
  const pageProfile = page?.profile;
  const shop = businessPage?.profile;
  const walletData = wallet.data;
  const firstName = text(
    accountData?.first_name,
    exportData?.profile?.first_name,
    liveUser.first_name,
    liveUser.user_firstname,
    sessionUser?.first_name,
    sessionUser?.user_firstname
  );
  const lastName = text(
    accountData?.last_name,
    exportData?.profile?.last_name,
    liveUser.last_name,
    liveUser.user_lastname,
    sessionUser?.last_name,
    sessionUser?.user_lastname
  );
  const name = text(
    accountData?.name,
    exportData?.profile?.name,
    pageProfile?.name,
    liveUser.display_name,
    liveUser.business_name,
    [firstName, lastName].filter(Boolean).join(" "),
    sessionUser?.display_name,
    sessionUser?.business_name
  );
  const resolvedUserId =
    Number(exportData?.profile?.user_id || liveUser.user_id || sessionUser?.user_id || userId) || undefined;

  const postsById = new Map<string, NonNullable<AccountExport["posts"]>[number]>();
  const addPost = (row: { id?: unknown; type?: unknown; text?: unknown; created_at?: unknown; post_id?: unknown }) => {
    const id = text(row.id, row.post_id);
    if (!id) return;
    if (postsById.has(id)) return;
    postsById.set(id, {
      id,
      type: text(row.type) || "post",
      text: text(row.text),
      created_at: text(row.created_at) || null,
    });
  };
  (exportData?.posts || []).forEach(addPost);
  (page?.posts || []).forEach((row) =>
    addPost({
      id: row.post_id,
      type: (row as { post_type?: string }).post_type || "post",
      text: postText(row),
      created_at: (row as { created_at?: string }).created_at,
    })
  );
  (page?.reels || []).forEach((row) =>
    addPost({
      id: row.post_id,
      type: "reel",
      text: postText(row),
      created_at: (row as { created_at?: string }).created_at,
    })
  );
  (businessPage?.posts || []).forEach((row) =>
    addPost({
      id: row.post_id,
      type: "post",
      text: postText(row),
      created_at: row.created_at,
    })
  );
  (saved.data || []).forEach((row) =>
    addPost({
      id: row.post_id,
      type: row.post_type || "saved",
      text: row.text || row.caption,
      created_at: row.created_at,
    })
  );

  const listingRows =
    listings.length > 0
      ? listings.map((row) => ({
          id: String(row.id),
          name: row.title,
          price: String(row.price ?? ""),
          status: row.listing_status || "",
          kind: row.listing_kind || "",
          category: row.category || "",
          stock: row.stock == null ? "" : String(row.stock),
        }))
      : businessPage?.catalog?.length
        ? businessPage.catalog.map((row) => ({
            id: String(row.id),
            name: row.title,
            price: String(row.price ?? ""),
            status: "published",
            kind: "",
            category: row.category || "",
            stock: "",
          }))
        : exportData?.listings || [];

  const friendRows =
    friends.length > 0
      ? friends.map((row) => ({
          user_id: Number(row.user_id),
          name: friendDisplayName(row),
          created_at: null,
        }))
      : exportData?.friends || [];

  const packed: PackedExport = {
    exported_at: exportData?.exported_at || new Date().toISOString(),
    profile: {
      user_id: resolvedUserId,
      member_id: text(
        exportData?.profile?.member_id,
        walletData?.member_id,
        membership.data?.member_id,
        resolvedUserId ? formatMemberDisplayId(resolvedUserId) : ""
      ),
      email: text(accountData?.email, exportData?.profile?.email, liveUser.email, liveUser.user_email, sessionUser?.email),
      first_name: firstName,
      last_name: lastName,
      name,
      username: text(exportData?.profile?.username, liveUser.user_name, liveUser.username, sessionUser?.user_name, pageProfile?.handle),
      phone: text(exportData?.profile?.phone, liveUser.user_phone, liveUser.business_phone),
      address: text(exportData?.profile?.address, liveUser.address, pageProfile?.location, shop?.location),
      bio: text(exportData?.profile?.bio, liveUser.user_bio, pageProfile?.bio, shop?.bio),
      banned: Boolean(accountData?.banned ?? exportData?.profile?.banned),
      account_status: text(accountData?.account_status, exportData?.profile?.account_status, security.data?.account_status, "approved"),
      account_type: text(accountData?.account_type, exportData?.profile?.account_type, liveUser.account_type, sessionUser?.account_type, pageProfile?.account_type),
      member_since: text(accountData?.member_since, exportData?.profile?.member_since, pageProfile?.joined_at, liveUser.user_registered),
      nin_verified: Boolean(accountData?.nin_verified ?? exportData?.profile?.nin_verified ?? security.data?.nin_verified),
      business_name: text(exportData?.profile?.business_name, liveUser.business_name, shop?.name, sessionUser?.business_name),
      business_type: text(exportData?.profile?.business_type, liveUser.business_type, shop?.category),
      business_email: text(exportData?.profile?.business_email, liveUser.business_email),
      business_phone: text(exportData?.profile?.business_phone, liveUser.business_phone, shop?.phone),
      business_location: text(exportData?.profile?.business_location, liveUser.business_location, shop?.location),
      business_hours: text(exportData?.profile?.business_hours, shop?.hours_label),
      hours_open: text(exportData?.profile?.hours_open, shop?.hours_open),
      hours_close: text(exportData?.profile?.hours_close, shop?.hours_close),
      hours_days: text(exportData?.profile?.hours_days, Array.isArray(shop?.hours_days) ? shop?.hours_days.join(", ") : shop?.hours_days),
    },
    activity: (activity.data && activity.data.length ? activity.data : exportData?.activity) || [],
    sales: exportData?.sales || [],
    posts: [...postsById.values()],
    wallet: walletData
      ? {
          balance: Number(walletData.balance || 0),
          wallet_address: walletData.wallet_address || "",
          currency: walletData.currency || "NGN",
        }
      : exportData?.wallet,
    transactions: (walletData?.transactions && walletData.transactions.length
      ? walletData.transactions
      : exportData?.transactions) || [],
    points: points.data || exportData?.points,
    preferences: preferences.data || exportData?.preferences,
    referrals: (referrals.data || exportData?.referrals || null) as Partial<ReferralInfo> | null,
    friends: friendRows,
    listings: listingRows,
    support: (support.data && support.data.length ? support.data : exportData?.support) || [],
    membership: membership.data || null,
    security: security.data
      ? {
          email: security.data.email,
          nin_verified: security.data.nin_verified,
          nin_masked: security.data.nin_masked,
          two_factor_enabled: security.data.two_factor_enabled,
          account_status: security.data.account_status,
        }
      : null,
  };

  const hasProfile = Boolean(packed.profile.email || packed.profile.name || packed.profile.user_id);
  if (!hasProfile && !packed.wallet && !packed.activity?.length) {
    throw new Error(exported.message || account.message || "Could not load account data");
  }
  return packed;
}

export async function shareAccountExcel(data: PackedExport): Promise<void> {
  const filename = `JOSCITY-data-${stamp()}.xlsx`;
  const bytes = buildXlsx(sheetsFromExport(data));
  if (Platform.OS === "web") {
    await downloadOnWeb(bytes, filename);
    return;
  }
  await shareFile(bytes, filename);
}
