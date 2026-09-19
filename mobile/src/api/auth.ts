import { apiFetch, readJson, uploadForm } from "./client";
import type { AccountType, StoredUser } from "../storage/session";
import { friendlyError } from "../utils/errors";

type ApiMessage = {
  success?: boolean;
  error?: boolean | string;
  message?: string;
  token?: string;
  user?: StoredUser;
  data?: StoredUser;
  activation_required?: boolean;
  two_factor_required?: boolean;
};

export type AuthResult = {
  success: boolean;
  message?: string;
  token?: string;
  user?: StoredUser;
  activation_required?: boolean;
  two_factor_required?: boolean;
};

async function parseAuth(response: Response): Promise<AuthResult> {
  let data: ApiMessage = {};
  try {
    data = await readJson<ApiMessage>(response);
  } catch {
    return {
      success: false,
      message: friendlyError(`Server error: ${response.status} ${response.statusText}`),
    };
  }

  if (!response.ok) {
    return {
      success: false,
      message: friendlyError(
        data.message ||
          (typeof data.error === "string" ? data.error : undefined) ||
          "Request failed"
      ),
    };
  }

  return {
    success: true,
    token: data.token,
    user: data.user || data.data,
    message: data.message,
    activation_required: data.activation_required,
    two_factor_required: data.two_factor_required,
  };
}

export async function loginPersonal(params: {
  email: string;
  password: string;
  activationCode?: string;
  twoFactorCode?: string;
}): Promise<AuthResult> {
  const response = await apiFetch("/auth/personal/login", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      email: params.email.toLowerCase().trim(),
      password: params.password,
      activation_code: params.activationCode?.trim().replace(/\s+/g, "") || "",
      two_factor_code: params.twoFactorCode?.trim().replace(/\s+/g, "") || "",
    }),
  });
  return parseAuth(response);
}

export async function loginBusiness(params: {
  email: string;
  password: string;
  activationCode?: string;
}): Promise<AuthResult> {
  const response = await apiFetch("/auth/business/login", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      email: params.email.toLowerCase().trim(),
      password: params.password,
      activation_code: params.activationCode?.trim().replace(/\s+/g, "") || "",
    }),
  });
  return parseAuth(response);
}

export async function checkActivationRequired(
  email: string,
  accountType: AccountType
): Promise<AuthResult> {
  const response = await apiFetch("/auth/activation-required", {
    method: "POST",
    timeoutMs: 15000,
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      account_type: accountType === "business" ? "business" : "personal",
    }),
  });
  return parseAuth(response);
}

export async function resendActivation(
  email: string,
  accountType: AccountType
): Promise<AuthResult> {
  const response = await apiFetch("/auth/resend-activation", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      account_type: accountType === "business" ? "business" : "personal",
    }),
  });
  return parseAuth(response);
}

export async function getUserProfile(options?: {
  token?: string;
  skipUnauthorized?: boolean;
}): Promise<AuthResult> {
  const response = await apiFetch("/profile", {
    method: "GET",
    auth: true,
    timeoutMs: 20000,
    token: options?.token,
    skipUnauthorized: options?.skipUnauthorized,
  });
  return parseAuth(response);
}

export async function updatePersonalProfile(params: {
  user_firstname: string;
  user_lastname: string;
  user_phone: string;
  user_email: string;
  address: string;
  user_bio?: string;
  nin_number?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
  business_location?: string;
  business_description?: string;
  CAC_number?: string;
}): Promise<AuthResult> {
  const response = await apiFetch("/users/profile", {
    method: "PUT",
    auth: true,
    timeoutMs: 20000,
    body: JSON.stringify({
      user_firstname: params.user_firstname.trim(),
      user_lastname: params.user_lastname.trim(),
      user_phone: params.user_phone.trim(),
      user_email: params.user_email.toLowerCase().trim(),
      address: params.address.trim(),
      ...(params.user_bio != null ? { user_bio: params.user_bio } : {}),
      ...(params.nin_number ? { nin_number: params.nin_number.replace(/\D/g, "") } : {}),
      ...(params.business_name
        ? {
            business_name: params.business_name.trim(),
            business_phone: (params.business_phone || params.user_phone).trim(),
            business_email: (params.business_email || params.user_email).toLowerCase().trim(),
            business_location: (params.business_location || params.address).trim(),
            ...(params.business_description != null
              ? { business_description: params.business_description }
              : {}),
            ...(params.CAC_number
              ? { CAC_number: params.CAC_number.trim().toUpperCase() }
              : {}),
          }
        : {}),
    }),
  });
  return parseAuth(response);
}

export async function requestPasswordResetOtp(
  email: string,
  accountType: AccountType
): Promise<AuthResult> {
  const response = await apiFetch("/auth/forgot-password", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      account_type: accountType === "business" ? "business" : "personal",
    }),
  });
  return parseAuth(response);
}

export async function verifyPasswordResetOtp(
  email: string,
  otp: string
): Promise<AuthResult> {
  const response = await apiFetch("/auth/confirm-reset", {
    method: "POST",
    timeoutMs: 20000,
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      reset_key: otp.trim(),
    }),
  });
  return parseAuth(response);
}

export async function registerPersonal(params: {
  user_firstname: string;
  user_lastname: string;
  user_gender?: string;
  user_phone: string;
  user_email: string;
  nin_number?: string;
  address?: string;
  user_password: string;
  referral_code?: string;
  signup_intent?: "personal" | "agent";
}): Promise<AuthResult> {
  const response = await apiFetch("/auth/personal/signup", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      user_firstname: params.user_firstname.trim(),
      user_lastname: params.user_lastname.trim(),
      user_gender: params.user_gender?.trim() || "",
      user_phone: params.user_phone.trim(),
      user_email: params.user_email.toLowerCase().trim(),
      nin_number: params.nin_number?.trim() || "",
      address: params.address?.trim() || "",
      user_password: params.user_password,
      referral_code: params.referral_code?.trim() || "",
      signup_intent: params.signup_intent || "personal",
    }),
  });
  return parseAuth(response);
}

export async function registerBusiness(params: {
  business_name: string;
  business_type: string;
  business_email: string;
  business_phone: string;
  business_location: string;
  business_password: string;
  CAC_number?: string;
  business_description?: string;
  terms_accepted: boolean;
}): Promise<AuthResult> {
  const response = await apiFetch("/auth/business/signup", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      business_name: params.business_name.trim(),
      business_type: params.business_type.trim(),
      business_email: params.business_email.toLowerCase().trim(),
      business_phone: params.business_phone.trim(),
      business_location: params.business_location.trim(),
      business_password: params.business_password,
      CAC_number: params.CAC_number?.trim() || "",
      business_description: params.business_description?.trim() || "",
      terms_accepted: params.terms_accepted,
    }),
  });
  return parseAuth(response);
}

export async function fetchBusinessCategories(): Promise<
  { slug: string; name: string }[]
> {
  try {
    const response = await apiFetch("/auth/business/categories", {
      method: "GET",
      timeoutMs: 15000,
    });
    const data = await readJson<{
      categories?: { slug?: string; name?: string }[];
    }>(response);
    if (!response.ok || !Array.isArray(data.categories)) return [];
    return data.categories
      .map((item) => ({
        slug: String(item.slug || "").trim(),
        name: String(item.name || "").trim(),
      }))
      .filter((item) => item.slug && item.name);
  } catch {
    return [];
  }
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<AuthResult> {
  const response = await apiFetch("/auth/reset-password", {
    method: "POST",
    timeoutMs: 30000,
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      reset_key: otp.trim(),
      new_password: newPassword,
      confirm: newPassword,
    }),
  });
  return parseAuth(response);
}

export async function uploadProfilePicture(params: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}): Promise<{ success: boolean; user_picture?: string; message?: string }> {
  const uri = params.uri;
  const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const name = params.name || `avatar.${ext === "png" ? "png" : "jpg"}`;
  const type =
    params.mimeType ||
    (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

  const form = new FormData();
  form.append(
    "picture",
    {
      uri,
      name,
      type,
    } as unknown as Blob
  );

  try {
    const { promise } = uploadForm("/profile/picture", form, {
      timeoutMs: 60000,
    });
    const result = await promise;
    const data = result.data as typeof result.data & { user_picture?: string };
    if (!result.ok) {
      return {
        success: false,
        message: data.message || "Failed to upload profile picture",
      };
    }
    return {
      success: true,
      user_picture: data.user_picture,
      message: data.message,
    };
  } catch {
    return { success: false, message: "Could not upload profile picture" };
  }
}

export async function uploadCoverPicture(params: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}): Promise<{ success: boolean; user_cover?: string; message?: string }> {
  const uri = params.uri;
  const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const name = params.name || `cover.${ext === "png" ? "png" : "jpg"}`;
  const type =
    params.mimeType ||
    (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");

  const form = new FormData();
  form.append(
    "cover",
    {
      uri,
      name,
      type,
    } as unknown as Blob
  );

  try {
    const response = await apiFetch("/profile/cover", {
      method: "POST",
      auth: true,
      timeoutMs: 45000,
      body: form,
    });
    const data = await readJson<{
      success?: boolean;
      user_cover?: string;
      message?: string;
    }>(response);
    if (!response.ok) {
      return {
        success: false,
        message: data.message || "Failed to upload cover photo",
      };
    }
    return {
      success: true,
      user_cover: data.user_cover,
      message: data.message,
    };
  } catch {
    return { success: false, message: "Could not upload cover photo" };
  }
}
