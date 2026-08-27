import { apiFetch, readJson } from "./client";

export type MembershipPlanItem = {
  id?: string;
  title?: string;
  amount: number;
  description: string;
  features?: string[];
  color?: string;
};

export type MembershipPlan = {
  enabled: boolean;
  amount: number;
  description: string;
  currency: string;
  items: MembershipPlanItem[];
};

export type MembershipSettings = {
  personal: MembershipPlan;
  business: MembershipPlan;
};

export const DEFAULT_MEMBERSHIP_SETTINGS: MembershipSettings = {
  personal: {
    enabled: false,
    amount: 0,
    description: "",
    currency: "NGN",
    items: [{ id: "primary", amount: 0, description: "" }],
  },
  business: {
    enabled: true,
    amount: 0,
    description: "",
    currency: "NGN",
    items: [{ id: "primary", amount: 0, description: "" }],
  },
};

type Envelope = {
  success?: boolean;
  data?: Partial<MembershipSettings>;
};

const toPlan = (
  row: Partial<MembershipPlan> | undefined,
  fallback: MembershipPlan
): MembershipPlan => {
  const items = Array.isArray(row?.items) && row.items.length
    ? row.items.map((item, index) => ({
        id: String(item?.id || `item-${index + 1}`),
        title: String(item?.title || ""),
        amount: Number.isFinite(Number(item?.amount)) ? Number(item.amount) : 0,
        description: String(item?.description || ""),
        features: Array.isArray(item?.features) ? item.features.map((line) => String(line)) : undefined,
        color: item?.color ? String(item.color) : undefined,
      }))
    : [
        {
          id: "primary",
          title: "",
          amount: Number.isFinite(Number(row?.amount)) ? Number(row?.amount) : fallback.amount,
          description: String(row?.description ?? fallback.description),
        },
      ];
  return {
    enabled: row?.enabled === undefined ? fallback.enabled : Boolean(row.enabled),
    amount: items[0].amount,
    description: items[0].description,
    currency: String(row?.currency || fallback.currency),
    items,
  };
};

export function formatMembershipAmount(plan: Pick<MembershipPlan, "amount"> | MembershipPlanItem): string {
  const amount = Number(plan.amount || 0);
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function isPersonalMembershipEnabled(settings: MembershipSettings): boolean {
  return settings.personal.enabled === true;
}

export async function getMembershipSettings(): Promise<MembershipSettings> {
  try {
    const response = await apiFetch("/membership", { timeoutMs: 12000 });
    const payload = await readJson<Envelope>(response);
    if (!response.ok || !payload.data) return DEFAULT_MEMBERSHIP_SETTINGS;
    return {
      personal: toPlan(payload.data.personal, DEFAULT_MEMBERSHIP_SETTINGS.personal),
      business: toPlan(payload.data.business, DEFAULT_MEMBERSHIP_SETTINGS.business),
    };
  } catch {
    return DEFAULT_MEMBERSHIP_SETTINGS;
  }
}
