import { useSyncExternalStore } from "react";
export const JOB_STEPS = ["Accepted", "Sourcing", "Ready for delivery", "Out for delivery", "Delivered"] as const;
export type PreviewRequest = { id: string; title: string; service: string; category: string; description: string; budget: string; pickup: string; destination: string; deadline: string; images: string[]; customer: string; target?: string; stage: number; agent?: string; publicHandoff?: boolean };
let state = {
  requestAlerts: true, jobAlerts: true, messageAlerts: true,
  firstName: "", lastName: "", username: "", phone: "", email: "", gender: "", address: "",
  avatar: "", nin: "", accepting: true, services: [] as string[], category: "", bio: "", workingAreas: "",
  requests: [] as PreviewRequest[],
};
const listeners = new Set<() => void>();
export function getAgentPreview() { return state; }
export function updateAgentPreview(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
export function updatePreviewRequest(id: string, patch: Partial<PreviewRequest>) { updateAgentPreview({ requests: state.requests.map(item => item.id === id ? { ...item, ...patch } : item) }); }
export function addPreviewRequest(request: PreviewRequest) { updateAgentPreview({ requests: [request, ...state.requests] }); }
export function useAgentPreview() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state, () => state); }
export const SAMPLE_AGENTS = [
  { id: "amina", name: "Amina Danjuma", rating: 4.9, jobs: 240, category: "Fashion, Groceries", bio: "Personal shopping and careful deliveries around Rayfield.", accepting: true },
  { id: "john", name: "John Musa", rating: 4.8, jobs: 126, category: "Electronics, Groceries", bio: "Phones, gadgets and everyday essentials in Jos North.", accepting: true },
  { id: "daniel", name: "Daniel Pam", rating: 4.7, jobs: 92, category: "Furniture, Building materials", bio: "Sourcing home essentials and bulky items in Bukuru.", accepting: false },
];

export function formatAgentAmount(value: string | number): string {
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "0";
}
