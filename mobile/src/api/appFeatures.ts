import { apiFetch, readJson } from "./client";

export type FeatureKey = "membership" | "rewards" | "wallet" | "cbc_points";

export type AppFeature = {
  enabled: boolean;
  coming_soon_label: string;
  title: string;
};

export type AppFeaturesMap = Record<FeatureKey, AppFeature>;

export const DEFAULT_APP_FEATURES: AppFeaturesMap = {
  membership: { enabled: false, coming_soon_label: "Coming soon", title: "Membership" },
  rewards: { enabled: false, coming_soon_label: "Coming soon", title: "Rewards" },
  wallet: { enabled: false, coming_soon_label: "Coming soon", title: "Wallet" },
  cbc_points: { enabled: false, coming_soon_label: "Coming soon", title: "CBC points" },
};

type Envelope = {
  success?: boolean;
  data?: Partial<Record<FeatureKey, Partial<AppFeature>>>;
};

export async function getAppFeatures(): Promise<AppFeaturesMap> {
  try {
    const response = await apiFetch("/app-features", { timeoutMs: 12000 });
    const payload = await readJson<Envelope>(response);
    if (!response.ok || !payload.data) return DEFAULT_APP_FEATURES;

    const next = { ...DEFAULT_APP_FEATURES };
    (Object.keys(DEFAULT_APP_FEATURES) as FeatureKey[]).forEach((key) => {
      const row = payload.data?.[key];
      if (!row) return;
      next[key] = {
        enabled: Boolean(row.enabled),
        coming_soon_label: String(row.coming_soon_label || DEFAULT_APP_FEATURES[key].coming_soon_label),
        title: String(row.title || DEFAULT_APP_FEATURES[key].title),
      };
    });
    return next;
  } catch {
    return DEFAULT_APP_FEATURES;
  }
}
