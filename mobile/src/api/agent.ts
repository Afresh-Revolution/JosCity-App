import { agentRequest, appendAgentImage } from './agentTransport';

export type Service = 'buy' | 'delivery';
export type AgentRole = 'agent' | 'requester';
export type Category = { slug: string; name: string };
export type AgentProfile = {
  user_id: number; user_firstname: string; user_lastname: string; user_picture?: string;
  agent_type: 'buy' | 'deliver' | 'both' | null; agent_status?: string;
  agent_bio?: string; agent_accepting_requests: boolean; agent_rating_avg: number;
  agent_completed_jobs_count: number; categories?: Category[];
  agent_base_address?: string; agent_working_areas?: string[]; agent_transport_mode?: string;
  agent_max_package_size?: string; agent_vehicle_info?: string; agent_vehicle_plate_number?: string;
  star_level?: {
    level: number;
    label: string;
    jobs_required: number;
    can_withdraw: boolean;
    jobs_completed?: number;
    progress?: number;
    next?: { level: number; label: string; jobs_required: number } | null;
    levels?: Array<{
      level: number;
      label: string;
      jobs_required: number;
      can_withdraw: boolean;
      reached?: boolean;
      current?: boolean;
    }>;
  };
  distance_km?: number;
};
export type CatalogueItem = {
  item_id: number;
  agent_user_id: number;
  title: string;
  description?: string;
  category_slug?: string;
  product_price: number;
  agent_fee_percent: number;
  fee_amount: number;
  total_price: number;
  images?: string[];
  status: string;
  source_kind?: "joscity" | "external";
  source_label?: string;
  source_name?: string;
  source_url?: string;
  listing_id?: number | null;
};
export type CatalogueSourceListing = {
  listing_id: number;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  seller_user_id?: number;
  business_name: string;
};
export type AgentRequest = { request_id: number; title?: string; description?: string; package_description?: string; pickup_address?: string; destination_address?: string; status: string; target_budget?: number; images?: string[]; source_type?: Service };
export type Quote = { quote_id: number; agent_user_id: number; product_price?: number; fee_percent?: number; fee_amount?: number; total_price?: number; charge_amount?: number; note?: string; eta_note?: string; status: string };
export type Job = { job_id: number; source_type: Service; stage: number; stage_label: string; funded: boolean; escrow_status: string | null; product_amount: number | null; agent_fee_amount: number | null; cancelled_at?: string; vendor_paid_at?: string; payout_pending_manual?: boolean; cancellation_reason?: string };
export type Point = { lat: number; lng: number };
export type MapPin = Point & { id: string | number; label: string; business_name?: string; address?: string; payment_status?: string; attributions?: { provider: string; providerUri?: string }[] };
export type MapJob = { job_id: number; source_type: Service; stage: number; pickup_address?: string; pickup_lat?: number | null; pickup_lng?: number | null; destination_address?: string; destination_lat?: number | null; destination_lng?: number | null };
export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
export const PLATEAU_BOUNDS: Bounds = { minLat: 8.3, maxLat: 10.15, minLng: 8.4, maxLng: 9.9 };
export const inBounds = (p: Point, b = PLATEAU_BOUNDS) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
export type MapConfig = { bounds: Bounds; listing_price: number | null; places_enabled: boolean };
export type UploadImage = { uri: string; name: string; type: string } | File;
export type Input = Record<string, unknown>;
const id = (value: number | string) => encodeURIComponent(String(value));
function query(input: Input = {}) { return Object.entries(input).filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&'); }
async function form(input: Input, images: UploadImage[] = [], field = 'images') {
  const data = new FormData();
  Object.entries(input).forEach(([k,v]) => { if (v !== undefined && v !== null) data.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
  for (const image of images) await appendAgentImage(data, field, image);
  return data;
}
const get = <T>(path: string, params?: Input, auth = true) => agentRequest<T>(`/agent${path}${params ? '?' + query(params) : ''}`, { auth });
const send = <T>(path: string, body?: Input | FormData, method = 'POST') => agentRequest<T>(`/agent${path}`, { method, auth: true, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
const requests = (type: Service) => type === 'buy' ? '/buy-requests' : '/delivery-requests';
export const agentApi = {
  categories: () => get<Category[]>('/categories', undefined, false),
  me: () => get<AgentProfile>('/me'),
  become: (body: Input) => send<{ otpSent: boolean }>('/become', body),
  confirmOtp: (code: string) => send<{ agentStatus: string }>('/confirm-otp', { code }),
  resendOtp: () => send('/resend-otp'),
  updateMe: (body: Input) => send<AgentProfile>('/me', body, 'PUT'),
  vehiclePhoto: async (image: UploadImage) => send<AgentProfile>('/me/vehicle-photo', await form({}, [image], 'photo')),
  liveLocation: (point: Point) => send('/me/live-location', point),
  dashboard: () => get<{ active_jobs: number; held_agent_fees: number; completed_today: number; pending_quotes: number }>('/me/dashboard'),
  directory: (params: Input = {}) => get<AgentProfile[]>('/directory', params, false),
  profile: (userId: number) => get<AgentProfile>(`/directory/${id(userId)}`, undefined, false),
  catalogue: (params: Input = {}) => get<CatalogueItem[]>('/catalogue/public', params, false),
  catalogueItem: (itemId: number) => get<CatalogueItem>(`/catalogue/public/${id(itemId)}`, undefined, false),
  myCatalogue: () => get<CatalogueItem[]>('/catalogue/mine', { includeInactive: true }),
  sourceListings: (search = '') => get<CatalogueSourceListing[]>('/catalogue/source-listings', { search }),
  saveCatalogue: async (body: Input, images: UploadImage[], itemId?: number) => send<CatalogueItem>(`/catalogue${itemId ? '/' + id(itemId) : ''}`, await form(body, images), itemId ? 'PUT' : 'POST'),
  deleteCatalogue: (itemId: number) => send(`/catalogue/${id(itemId)}`, undefined, 'DELETE'),
  requests: (type: Service, role: AgentRole, page = 1) => get<AgentRequest[]>(`${requests(type)}/${role === 'agent' ? 'open' : 'mine'}`, { page, limit: 20 }),
  createRequest: async (type: Service, body: Input, images: UploadImage[]) => send<AgentRequest>(requests(type), await form(body, images)),
  quotes: (type: Service, requestId: number) => get<Quote[]>(`${requests(type)}/${id(requestId)}/quotes`),
  myQuote: (type: Service, requestId: number) => get<Quote | null>(`${requests(type)}/${id(requestId)}/my-quote`),
  quote: (type: Service, requestId: number, body: Input) => send<Quote>(`${requests(type)}/${id(requestId)}/quotes`, body),
  withdrawQuote: (type: Service, requestId: number) => send(`${requests(type)}/${id(requestId)}/quotes`, undefined, 'DELETE'),
  acceptQuote: (type: Service, requestId: number, quoteId: number) => send(`${requests(type)}/${id(requestId)}/accept`, { quoteId }),
  jobs: (role: AgentRole, page = 1) => get<Job[]>('/jobs', { role, page, limit: 20 }),
  job: (jobId: number) => get<Job>(`/jobs/${id(jobId)}`),
  fund: (jobId: number) => send<Job>(`/jobs/${id(jobId)}/fund`),
  purchase: (jobId: number, body: Input) => send<Job>(`/jobs/${id(jobId)}/purchase`, body),
  advance: (jobId: number, note = '') => send<Job>(`/jobs/${id(jobId)}/advance`, { note }),
  confirm: (jobId: number, note = '') => send<Job>(`/jobs/${id(jobId)}/confirm`, { note }),
  cancel: (jobId: number, reason: string) => send<{ disputed: boolean; refunded: string | boolean }>(`/jobs/${id(jobId)}/cancel`, { reason, fault: null }),
  referrals: () => get<{ referral_link: string; referrals: { referred_business_user_id: number; incentive_status: string; incentive_amount: number }[] }>('/referrals'),
  mapConfig: () => get<MapConfig>('/map/config', undefined, false),
  mapPublic: (search = '') => get<MapPin[]>('/map/public', { search }, false),
  places: (q: string) => get<MapPin[]>('/map/places', { q }),
  mapJobs: (role: AgentRole) => get<MapJob[]>('/map/jobs', { role }),
  jobLocations: (jobId: number, body: Input) => send(`/map/jobs/${id(jobId)}/locations`, body, 'PUT'),
  mapMine: () => get<MapPin[]>('/map/mine'),
  createPin: (point: Point) => send<MapPin>('/map', point),
  payPin: (pinId: string | number, label: string, amount: number) => send<MapPin>(`/map/${id(pinId)}/pay`, { label, amount }),
};
