import { agentRequest, appendAgentImage } from './agentTransport';

export type Service = 'buy' | 'delivery';
export type AgentRole = 'agent' | 'requester';
export type Category = { slug: string; name: string };
export type AgentProfile = {
  user_id: number; user_firstname: string; user_lastname: string; user_name?: string | null; user_picture?: string;
  agent_type: 'buy' | 'deliver' | 'both' | null; agent_status?: string;
  agent_bio?: string; agent_accepting_requests: boolean; agent_rating_avg: number;
  agent_rating_count?: number;
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
export type AgentRequest = { request_id: number; title?: string; description?: string; package_description?: string; pickup_address?: string; destination_address?: string; status: string; target_budget?: number; images?: string[]; source_type?: Service; requester_user_id?: number; agent_user_id?: number };
export type Quote = { quote_id: number; agent_user_id: number; product_price?: number; fee_percent?: number; fee_amount?: number; total_price?: number; charge_amount?: number; note?: string; eta_note?: string; status: string };
export type QuoteFee = { productPrice: number; feePercent: number; feeAmount: number; totalPrice: number };
export type AgentReview = {
  review_id: number;
  job_id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string;
  reviewer_picture?: string | null;
};
export type Job = {
  job_id: number;
  source_type: Service;
  stage: number;
  stage_label: string;
  funded: boolean;
  escrow_status: string | null;
  product_amount: number | null;
  agent_fee_amount: number | null;
  cancelled_at?: string;
  vendor_paid_at?: string;
  payout_pending_manual?: boolean;
  cancellation_reason?: string;
  requester_user_id?: number;
  agent_user_id?: number;
  title?: string | null;
  description?: string | null;
  package_description?: string | null;
  images?: string[] | null;
  pickup_address?: string | null;
  destination_address?: string | null;
  reviewed?: boolean;
  review_rating?: number | null;
  review_comment?: string | null;
  needs_review?: boolean;
};

export function agentCounterpartyId(
  row: { requester_user_id?: number; agent_user_id?: number },
  asAgent: boolean
): number {
  return Number(asAgent ? row.requester_user_id : row.agent_user_id) || 0;
}
export type Point = { lat: number; lng: number };
export type MapPin = Point & { id: string | number; label: string; business_name?: string; address?: string; payment_status?: string; attributions?: { provider: string; providerUri?: string }[] };
export type MapRoute = {
  points: Point[];
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
};
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
  Object.entries(input).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') data.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
  for (const image of images) await appendAgentImage(data, field, image);
  return data;
}
function requestPayload(type: Service, body: Input): Input {
  const isPublic = body.isPublic === true || body.isPublic === 'true';
  const payload: Input = {
    isPublic,
    pickupAddress: body.pickupAddress,
    destinationAddress: body.destinationAddress,
    pickupLat: body.pickupLat,
    pickupLng: body.pickupLng,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
  };
  if (!isPublic) payload.agentUserId = body.agentUserId;
  if (type === 'buy') {
    payload.title = body.title;
    payload.description = body.description;
    payload.categorySlug = body.categorySlug;
    payload.targetBudget = body.targetBudget;
    payload.catalogueItemId = body.catalogueItemId;
    return payload;
  }
  payload.packageDescription = body.packageDescription;
  payload.packageSize = body.packageSize;
  return payload;
}
function isMultipart(body: unknown): body is FormData {
  return Boolean(body && typeof body === 'object' && typeof (body as FormData).append === 'function');
}
const get = <T>(path: string, params?: Input, auth = true) => agentRequest<T>(`/agent${path}${params ? '?' + query(params) : ''}`, { auth });
const send = <T>(path: string, body?: Input | FormData, method = 'POST') => agentRequest<T>(`/agent${path}`, { method, auth: true, body: isMultipart(body) ? body : body ? JSON.stringify(body) : undefined });
const requests = (type: Service) => type === 'buy' ? '/buy-requests' : '/delivery-requests';
export const agentApi = {
  categories: () => get<Category[]>('/categories', undefined, false),
  feeQuote: (productPrice: number) => get<QuoteFee>('/fee-quote', { productPrice }, false),
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
  createRequest: async (type: Service, body: Input, images: UploadImage[]) => send<AgentRequest>(requests(type), await form(requestPayload(type, body), images)),
  quotes: (type: Service, requestId: number) => get<Quote[]>(`${requests(type)}/${id(requestId)}/quotes`),
  myQuote: (type: Service, requestId: number) => get<Quote | null>(`${requests(type)}/${id(requestId)}/my-quote`),
  quote: (type: Service, requestId: number, body: Input) => send<Quote>(`${requests(type)}/${id(requestId)}/quotes`, body),
  claim: (type: Service, requestId: number, body: Input) => send<{ job: Job; quote: Quote }>(`${requests(type)}/${id(requestId)}/claim`, body),
  withdrawQuote: (type: Service, requestId: number) => send(`${requests(type)}/${id(requestId)}/quotes`, undefined, 'DELETE'),
  acceptQuote: (type: Service, requestId: number, quoteId: number) => send(`${requests(type)}/${id(requestId)}/accept`, { quoteId }),
  jobs: (role: AgentRole, page = 1) => get<Job[]>('/jobs', { role, page, limit: 20 }),
  job: (jobId: number) => get<Job>(`/jobs/${id(jobId)}`),
  fund: (jobId: number, body?: Input) => send<Job>(`/jobs/${id(jobId)}/fund`, body),
  purchase: (jobId: number, body: Input) => send<Job>(`/jobs/${id(jobId)}/purchase`, body),
  advance: (jobId: number, note = '') => send<Job>(`/jobs/${id(jobId)}/advance`, { note }),
  confirm: (jobId: number, note = '') => send<Job>(`/jobs/${id(jobId)}/confirm`, { note }),
  review: (jobId: number, body: { rating: number; comment?: string }) => send<{ review_id: number; rating: number; comment: string }>(`/jobs/${id(jobId)}/review`, body),
  pendingReviews: () => get<{ job_id: number; source_type: Service; agent_user_id: number }[]>('/jobs/reviews/pending'),
  publicReviews: (agentUserId: number, page = 1) => get<AgentReview[]>(`/directory/${id(agentUserId)}/reviews`, { page, limit: 20 }, false),
  cancel: (jobId: number, reason: string) => send<{ disputed: boolean; refunded: string | boolean }>(`/jobs/${id(jobId)}/cancel`, { reason, fault: null }),
  referrals: () => get<{ referral_link: string; referrals: { referred_business_user_id: number; incentive_status: string; incentive_amount: number }[] }>('/referrals'),
  mapConfig: () => get<MapConfig>('/map/config', undefined, false),
  mapPublic: (search = '') => get<MapPin[]>('/map/public', { search }, false),
  places: (q: string) =>
    agentRequest<MapPin[]>(`/agent/map/places?${query({ q })}`, { auth: true, timeoutMs: 12000 }),
  directions: (from: Point, to: Point) =>
    agentRequest<MapRoute>(`/agent/map/directions?${query({ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng })}`, {
      auth: true,
      timeoutMs: 12000,
    }),
  mapJobs: (role: AgentRole) => get<MapJob[]>('/map/jobs', { role }),
  jobLocations: (jobId: number, body: Input) => send(`/map/jobs/${id(jobId)}/locations`, body, 'PUT'),
  mapMine: () => get<MapPin[]>('/map/mine'),
  createPin: (point: Point) => send<MapPin>('/map', point),
  payPin: (pinId: string | number, label: string, amount: number) => send<MapPin>(`/map/${id(pinId)}/pay`, { label, amount }),
};

type SearchUser = { user_id: number; user_email?: string; account_type?: string };

export function escrowTotal(job: Pick<Job, 'product_amount' | 'agent_fee_amount'>): number {
  return Math.round((Number(job.product_amount || 0) + Number(job.agent_fee_amount || 0)) * 100) / 100;
}

export function vendorPayoutStatus(job: Job): string {
  if (job.source_type !== 'buy') return '';
  if (job.payout_pending_manual) return 'Vendor payout: Pending — waiting for admin to send the money';
  if (job.vendor_paid_at) return 'Vendor payout: Paid';
  return 'Vendor payout: Not sent';
}

export const BUY_JOB_STEPS = ['Accepted', 'Sourcing', 'Purchased', 'Out for delivery', 'Delivered'] as const;
export const DELIVERY_JOB_STEPS = ['Accepted', 'Picked up', 'Out for delivery', 'Delivered'] as const;

export function jobSteps(job: Pick<Job, 'source_type'>): readonly string[] {
  return job.source_type === 'delivery' ? DELIVERY_JOB_STEPS : BUY_JOB_STEPS;
}

export function jobStepIndex(job: Pick<Job, 'source_type' | 'stage'>): number {
  if (job.source_type !== 'delivery') return Math.max(0, Math.min(4, Number(job.stage) || 0));
  const stage = Number(job.stage) || 0;
  if (stage <= 1) return stage;
  if (stage >= 4) return 3;
  return 2;
}

export function jobTitle(job: Pick<Job, 'job_id' | 'source_type' | 'title' | 'package_description'>): string {
  return String(job.title || job.package_description || '').trim()
    || (job.source_type === 'delivery' ? 'Delivery request' : 'Buy request');
}

export function jobImages(job: Pick<Job, 'images'>): string[] {
  return Array.isArray(job.images) ? job.images.map(String).filter(Boolean) : [];
}

export function jobDescription(job: Pick<Job, 'description' | 'package_description' | 'title'>): string {
  const description = String(job.description || '').trim();
  if (description) return description;
  const packageText = String(job.package_description || '').trim();
  return packageText && packageText !== String(job.title || '').trim() ? packageText : '';
}

export function lastAgentStepIndex(job: Pick<Job, 'source_type'>): number {
  return job.source_type === 'delivery' ? 2 : 3;
}

/** Why the next stage cannot be selected, or null if it can. */
export function nextStageLock(job: Job, role: 'agent' | 'requester' = 'agent'): string | null {
  if (job.cancelled_at) return 'This job is cancelled.';
  const current = jobStepIndex(job);
  const lastAgent = lastAgentStepIndex(job);
  const funded = job.escrow_status === 'held';
  if (role === 'requester') {
    if (current === lastAgent && !funded) return 'This job is not funded.';
    return null;
  }
  if (current >= lastAgent) return 'Waiting for the customer to confirm delivery.';
  if (!funded) return 'Waiting for the customer to fund this job.';
  return null;
}

export async function resolveJosCityVendorUserId(email: string): Promise<number | null> {
  const q = String(email || '').trim().toLowerCase();
  if (!q.includes('@')) return null;
  const rows = await agentRequest<SearchUser[]>(`/users/search?q=${encodeURIComponent(q)}`, { auth: true });
  const businesses = (Array.isArray(rows) ? rows : []).filter((u) => String(u.account_type || '').toLowerCase() === 'business' && Number(u.user_id));
  const exact = businesses.find((u) => String(u.user_email || '').toLowerCase() === q);
  if (exact) return Number(exact.user_id);
  if (businesses.length === 1) return Number(businesses[0].user_id);
  return null;
}

export async function payVendorFromEscrow(jobId: number, values: Record<string, string>): Promise<string> {
  const email = String(values.vendorEmail || '').trim();
  const bankName = String(values.bankName || '').trim();
  const accountNumber = String(values.accountNumber || '').trim();
  const accountName = String(values.accountName || '').trim();
  const bankCode = String(values.bankCode || '').trim();
  const hasBank = Boolean(bankName && accountNumber && accountName);
  if (email) {
    const vendorUserId = await resolveJosCityVendorUserId(email);
    if (vendorUserId) {
      await agentApi.purchase(jobId, { vendorUserId });
      return 'Product amount sent from escrow to the JosCity business wallet.';
    }
    if (!hasBank) throw new Error('No JosCity business uses that email. Enter bank details to pay a vendor who is not on JosCity.');
  }
  if (!hasBank) throw new Error('Enter the JosCity business email, or bank details for a vendor who is not on JosCity.');
  const job = await agentApi.purchase(jobId, { bankName, accountNumber, accountName, ...(bankCode ? { bankCode } : {}) });
  return job.payout_pending_manual
    ? 'Vendor payout is pending. Admin will complete the transfer. This job stays pending until then.'
    : 'Product amount sent from escrow to the vendor via Paystack.';
}
