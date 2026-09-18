import { useSyncExternalStore } from "react";
export const JOB_STEPS = ["Accepted", "Sourcing", "Ready for delivery", "Out for delivery", "Delivered"] as const;
export type PreviewRequest = { id: string; title: string; service: string; category: string; description: string; budget: string; pickup: string; destination: string; deadline: string; images: string[]; customer: string; target?: string; stage: number; agent?: string; publicHandoff?: boolean };
const phoneImage = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&auto=format&fit=crop";
let state = {
  avatar: "", accepting: true, services: ["Help me buy", "Help me deliver"], category: "Electronics, Groceries", bio: "Helping Jos find gadgets and everyday essentials.",
  requests: [
    { id: "sample-buy", title: "Samsung Galaxy S25 (256GB)", service: "Help me buy", category: "Phones & gadgets", description: "Find a new, sealed 256GB phone, preferably black. Confirm warranty and share a receipt. Reference photo is illustrative.", budget: "1050000", pickup: "Terminus", destination: "Rayfield, Jos", deadline: "Tomorrow, before 5pm", images: [phoneImage], customer: "Chidi N. (sample)", stage: -1 },
    { id: "sample-delivery", title: "Deliver a sealed package", service: "Help me deliver", category: "Parcels", description: "One sealed parcel, approximately 2kg. Keep upright and call on arrival.", budget: "3000", pickup: "Terminus market entrance", destination: "Rayfield, Jos", deadline: "Today, before 6pm", images: [], customer: "Amina D. (sample)", stage: -1 },
  ] as PreviewRequest[],
};
const listeners = new Set<() => void>();
export function updateAgentPreview(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
export function updatePreviewRequest(id: string, patch: Partial<PreviewRequest>) { updateAgentPreview({ requests: state.requests.map(item => item.id === id ? { ...item, ...patch } : item) }); }
export function addPreviewRequest(request: PreviewRequest) { updateAgentPreview({ requests: [request, ...state.requests] }); }
export function useAgentPreview() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state, () => state); }
export const SAMPLE_AGENTS = [
  { id: "amina", name: "Amina Danjuma", rating: 4.9, jobs: 240, category: "Fashion, Groceries", bio: "Personal shopping and careful deliveries around Rayfield.", accepting: true },
  { id: "john", name: "John Musa", rating: 4.8, jobs: 126, category: "Electronics, Groceries", bio: "Phones, gadgets and everyday essentials in Jos North.", accepting: true },
  { id: "daniel", name: "Daniel Pam", rating: 4.7, jobs: 92, category: "Furniture, Building materials", bio: "Sourcing home essentials and bulky items in Bukuru.", accepting: false },
];
