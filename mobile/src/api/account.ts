import { apiFetch, readJson } from "./client";
import { friendlyError } from "../utils/errors";

type Envelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

async function readAccount<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; skipUnauthorized?: boolean } = {}
): Promise<{
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
  timeout?: boolean;
  network?: boolean;
}> {
  try {
    const response = await apiFetch(path, { auth: true, timeoutMs: 20000, ...init });
    const payload = await readJson<Envelope<T>>(response);
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: friendlyError(payload.message || "Request failed"),
      };
    }
    return { success: true, status: response.status, message: payload.message, data: payload.data };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "AbortError" || /timeout|aborted/i.test(error.message));
    return {
      success: false,
      timeout,
      network: true,
      message: friendlyError(timeout ? "timeout" : "offline"),
    };
  }
}

export type SecurityInfo = {
  account_type?: string;
  nin_number: string;
  nin_verified: boolean;
  nin_masked: string;
  cac_number?: string;
  cac_verified?: boolean;
  two_factor_enabled: boolean;
  email: string;
  account_status: string;
};

export type ActivityItem = {
  source?: string;
  id: string;
  title: string;
  amount?: string | null;
  status: string;
  created_at: string;
  order_id?: number | null;
  can_rate?: boolean;
};

export type ReferralPerson = {
  user_id: number;
  member_id?: string;
  name: string;
  joined_at: string;
  post_count?: number;
  status?: "pending" | "approved";
  earning_naira?: number;
};

export type ReferralInfo = {
  referral_code: string;
  share_url: string;
  member_id?: string;
  code_active?: boolean;
  posts_count?: number;
  posts_required_to_share?: number;
  referred_by_user_id?: number | null;
  referred_by_code?: string | null;
  earning_copy?: string;
  stats?: {
    referrals: number;
    approved: number;
    earnings_naira: number;
  };
  referrals: ReferralPerson[];
  payout_available?: boolean;
};

export type PreferenceInfo = {
  language: string;
  area: string;
  appearance: string;
  languages: Array<{ id: string; label: string }>;
  areas: string[];
  appearances: string[];
};

export type AccountInfo = {
  email: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  banned?: boolean;
  account_status: string;
  account_type: string;
  member_since?: string | null;
  nin_verified: boolean;
};

export type SupportMessage = {
  id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export type MembershipInfo = {
  user_id: number;
  member_id: string;
  name: string;
  email: string;
  account_status: string;
  account_type: string;
  member_since?: string | number | null;
  nin_verified: boolean;
  verified: boolean;
  membership_enabled?: boolean;
  amount?: number;
  description?: string;
  currency?: string;
  items?: Array<{ id?: string; title?: string; amount: number; description: string; features?: string[] }>;
  packages?: Array<{
    id?: string;
    title?: string;
    amount: number;
    description: string;
    features?: string[];
  }>;
  current?: {
    package_id: string;
    title: string;
    amount: number;
    status: string;
    renews_at?: string | null;
    billing?: string;
  } | null;
  billing_copy?: string;
};

export type WalletTransaction = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at?: string | null;
  kind?: "funding" | "order" | "payout" | "points";
  title?: string;
  subtitle?: string;
};

export type PayoutAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
  account_number_masked: string;
  label: string;
};

export type WalletMember = {
  member_id: string;
  name: string;
  account_type: "personal" | "business";
  account_type_label: string;
};

export type WalletInfo = {
  balance: number;
  wallet_address: string;
  currency: string;
  account_type?: string;
  referral_earnings_naira?: number;
  points?: number;
  cbc_points?: number;
  pending?: {
    amount: number;
    count: number;
  };
  current?: MembershipInfo["current"];
  membership_badge?: string | null;
  member_id?: string;
  payout_account?: PayoutAccount | null;
  funding?: WalletFundingOptions;
  transactions: WalletTransaction[];
};

export type WalletWithdrawOptions = {
  min_amount?: number;
  max_amount?: number;
  daily_limit?: number;
  paystack?: { enabled: boolean };
  manual?: { enabled: boolean };
};

export type WalletFundingOptions = {
  currency?: string;
  min_amount?: number;
  paystack?: { enabled: boolean; public_key?: string };
  safehaven?: { enabled: boolean; client_id?: string; environment?: string };
  manual?: {
    enabled: boolean;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
  };
  withdraw?: WalletWithdrawOptions | null;
};

export type WalletCheckout = {
  provider: "paystack" | "safehaven";
  reference: string;
  authorization_url?: string;
  public_key?: string;
  client_id?: string;
  environment?: string;
  amount: number;
};

export type PointsBreakdown = {
  key: string;
  label: string;
  count: number;
  points: number;
};

export type PointsInfo = {
  points: number;
  cbc: number;
  usd?: number;
  conversion?: {
    points_per_cbc: number;
    cbc_to_usd: number;
  };
  breakdown: PointsBreakdown[];
  earning_copy?: string;
};

export const getSecurity = () => readAccount<SecurityInfo>("/account/security");
export const changePassword = (current_password: string, new_password: string) =>
  readAccount("/account/security/password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
export const updateTwoFactor = (enabled: boolean, password: string) =>
  readAccount<{ two_factor_enabled: boolean }>("/account/security/two-factor", {
    method: "POST",
    body: JSON.stringify({ enabled, password }),
  });

export const getActivity = () => readAccount<ActivityItem[]>("/account/activity");
export const getMembership = () => readAccount<MembershipInfo>("/account/membership");
export const subscribeMembership = (package_id: string) =>
  readAccount<{ current: MembershipInfo["current"] }>("/account/membership/subscribe", {
    method: "POST",
    body: JSON.stringify({ package_id }),
  });
export const getWallet = () => readAccount<WalletInfo>("/account/wallet");
export const getWalletFunding = () =>
  readAccount<WalletFundingOptions>("/account/wallet/funding");
export const startPaystackFunding = (amount: number, callback_url?: string) =>
  readAccount<WalletCheckout>("/account/wallet/fund/paystack", {
    method: "POST",
    body: JSON.stringify({ amount, callback_url }),
  });
export const verifyPaystackFunding = (reference: string) =>
  readAccount<{ amount: number; reference: string }>("/account/wallet/fund/paystack/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
export const startSafehavenFunding = (amount: number, callback_url?: string) =>
  readAccount<WalletCheckout>("/account/wallet/fund/safehaven", {
    method: "POST",
    body: JSON.stringify({ amount, callback_url }),
  });
export const verifySafehavenFunding = (reference: string) =>
  readAccount<{ amount: number; reference: string }>("/account/wallet/fund/safehaven/verify", {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
export async function submitManualFunding(amount: number, proof: { uri: string; name?: string; type?: string }) {
  const form = new FormData();
  form.append("amount", String(amount));
  form.append("proof", {
    uri: proof.uri,
    name: proof.name || "transfer.jpg",
    type: proof.type || "image/jpeg",
  } as unknown as Blob);
  return readAccount<WalletTransaction>("/account/wallet/fund/manual", {
    method: "POST",
    body: form,
    timeoutMs: 60000,
  });
}
export const fundWallet = (amount: number) =>
  readAccount<WalletCheckout>("/account/wallet/fund", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
export const withdrawWallet = (amount: number, method?: "paystack" | "manual") =>
  readAccount<WalletTransaction>("/account/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ amount, method: method || "manual" }),
  });
export const updatePayoutAccount = (input: {
  bank_name: string;
  account_name: string;
  account_number: string;
}) =>
  readAccount<{ payout_account: PayoutAccount }>("/account/wallet/payout-account", {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const lookupWalletMember = (member_id: string) =>
  readAccount<WalletMember>(`/account/wallet/member?member_id=${encodeURIComponent(member_id)}`);
export const shareWallet = (member_id: string, amount: number) =>
  readAccount<{ amount: number; recipient: WalletMember }>("/account/wallet/share", {
    method: "POST",
    body: JSON.stringify({ member_id, amount }),
  });
export const getPoints = () => readAccount<PointsInfo>("/account/points");
export const getRewards = () => readAccount<PointsInfo>("/account/rewards");
export const getReferrals = () => readAccount<ReferralInfo>("/account/referrals");
export const applyReferral = (referral_code: string) =>
  readAccount("/account/referrals/apply", {
    method: "POST",
    body: JSON.stringify({ referral_code }),
  });

export const getPreferences = () => readAccount<PreferenceInfo>("/account/preferences");
export const updatePreferences = (body: Partial<Pick<PreferenceInfo, "language" | "area" | "appearance">>) =>
  readAccount<PreferenceInfo>("/account/preferences", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export type AccountExport = {
  exported_at: string;
  profile: AccountInfo & {
    user_id?: number;
    member_id?: string;
    username?: string | null;
    phone?: string | null;
    address?: string | null;
    bio?: string | null;
    business_name?: string | null;
    business_type?: string | null;
    business_email?: string | null;
    business_phone?: string | null;
    business_location?: string | null;
    business_hours?: string | null;
    hours_open?: string | null;
    hours_close?: string | null;
    hours_days?: string | null;
  };
  activity?: ActivityItem[];
  sales?: ActivityItem[];
  posts?: Array<{
    id: string;
    type?: string;
    text?: string | null;
    created_at?: string | null;
  }>;
  wallet?: {
    balance: number;
    wallet_address: string;
    currency?: string;
  };
  transactions?: WalletTransaction[];
  points?: PointsInfo;
  preferences?: Pick<PreferenceInfo, "language" | "area" | "appearance"> & Partial<PreferenceInfo>;
  referrals?: Partial<ReferralInfo> | null;
  friends?: Array<{
    user_id: number;
    name: string;
    created_at?: string | null;
  }>;
  listings?: Array<{
    id: string;
    name?: string | null;
    price?: string | null;
    status?: string | null;
    kind?: string | null;
    category?: string | null;
    stock?: string | null;
  }>;
  support?: SupportMessage[];
};

export const getAccount = () => readAccount<AccountInfo>("/account");
export const exportAccount = () => readAccount<AccountExport>("/account/export");
export const deactivateAccount = (password: string) =>
  readAccount("/account/deactivate", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
export const deleteAccount = (password: string) =>
  readAccount("/account/delete", {
    method: "POST",
    body: JSON.stringify({ password }),
    timeoutMs: 60000,
    skipUnauthorized: true,
  });

export const getSupportMessages = () => readAccount<SupportMessage[]>("/account/support");
export const sendSupportMessage = (subject: string, message: string) =>
  readAccount<SupportMessage>("/account/support", {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  });
