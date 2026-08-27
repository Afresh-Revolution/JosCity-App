/**
 * Public app config. The mobile client talks to the New_Joscity HTTP API,
 * which already uses the JosCity Supabase Postgres database.
 * Never put database passwords, JWT secrets, or SMTP keys in the app.
 */
function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const PRODUCTION_API =
  "https://api-joscity-com-phqud.ondigitalocean.app/api";

function resolveApiBase(): string {
  const raw = trimSlash(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? PRODUCTION_API
  );
  const withApi = raw.endsWith("/api") ? raw : `${raw}/api`;
  if (!__DEV__ && /^http:\/\//i.test(withApi)) {
    return PRODUCTION_API;
  }
  return withApi;
}

export const env = {
  apiBaseUrl: resolveApiBase(),
  paystackPublicKey: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  safehavenClientId: process.env.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID || "",
};
