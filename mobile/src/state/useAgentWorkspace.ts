import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi as api, AgentProfile, AgentRequest, CatalogueItem, Category, Job, Service, UploadImage } from '../api/agent';
import { agentRequest } from '../api/agentTransport';

export type Field = { key: string; label: string; value?: string; required?: boolean; type?: 'number' | 'password' | 'multiline'; options?: { value: string; label: string }[] };
export type Editor = { title: string; fields: Field[]; imageLimit?: number; submit: (values: Record<string, string>, images: UploadImage[]) => Promise<unknown> };
export type Action = { label: string; run: () => void; disabled?: boolean };
export type Panel = { key: string; title: string; lines: string[]; images?: string[]; actions?: Action[] };
const money = (value: unknown) => `NGN ${Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const name = (p: AgentProfile) => `${p.user_firstname || ''} ${p.user_lastname || ''}`.trim();
const options = (values: string[]) => values.map(value => ({ value, label: value }));
const sizes = options(['small', 'medium', 'large', 'bulky']);
const transport = options(['walking', 'bicycle', 'motorcycle', 'tricycle', 'car']);
const numeric = (key: string, label: string, value?: unknown): Field => ({ key, label, type: 'number', value: value == null ? '' : String(value), required: true });
export function useAgentWorkspace(role: 'agent' | 'requester', initialTab = 'dashboard', initialService: Service = 'buy', initialTarget = '') {
  const [tab, setTab] = useState(initialTab), [service, setService] = useState<Service>(initialService);
  const [search, setSearch] = useState(''), [debounced, setDebounced] = useState(''), [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]), [profile, setProfile] = useState<AgentProfile | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]), [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const revision = useRef(0), mutation = useRef(false), [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const run = useCallback(async (fn: () => Promise<unknown>, message = 'Saved', reload = true) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await fn(); setNotice(typeof result === 'string' ? result : message); if (reload) { setEditor(null); refresh(); } }
    catch (e) { setError(e instanceof Error ? e.message : 'Request failed. Please try again.'); }
    finally { mutation.current = false; setBusy(false); }
  }, [refresh]);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { let active = true; api.categories().then(rows => { if (active) setCategories(rows); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { setPage(1); }, [tab, service]);
  const categoryField = (value = ''): Field => ({ key: 'categorySlug', label: 'Category', required: true, value, options: categories.map(c => ({ value: c.slug, label: c.name })) });
  const openRequest = (target = initialTarget, item?: CatalogueItem) => { const requestService = item ? 'buy' : service; setEditor({
    title: requestService === 'buy' ? 'Help me buy' : 'Help me deliver', imageLimit: 3,
    fields: [
      ...(requestService === 'buy' ? [{ key: 'title', label: 'Item', required: true, value: item?.title }, categoryField(item?.category_slug), numeric('targetBudget', 'Budget (NGN)', item?.total_price)] : [{ key: 'packageSize', label: 'Package size', options: sizes, required: true }]),
      { key: 'description', label: requestService === 'buy' ? 'Description and instructions' : 'Package description', required: true, type: 'multiline' },
      { key: 'recipient', label: 'Who can quote?', value: target ? 'direct' : 'public', required: true, options: [...(target ? [{ value: 'direct', label: item ? 'Catalogue agent' : 'Selected agent' }] : []), { value: 'public', label: 'Available agents' }] },
      { key: 'pickupAddress', label: 'Pickup address', required: requestService === 'delivery' },
      { key: 'destinationAddress', label: 'Delivery address', required: true },
      { key: 'pickupLat', label: 'Pickup latitude (optional)', type: 'number' }, { key: 'pickupLng', label: 'Pickup longitude (optional)', type: 'number' },
      { key: 'destinationLat', label: 'Delivery latitude (optional)', type: 'number' }, { key: 'destinationLng', label: 'Delivery longitude (optional)', type: 'number' },
    ],
    submit: (v, images) => api.createRequest(requestService, { ...v, isPublic: v.recipient === 'public', agentUserId: v.recipient === 'direct' ? target : undefined, catalogueItemId: item?.item_id, ...(requestService === 'delivery' ? { packageDescription: v.description } : {}) }, images),
  }); };
  function editProfile(p: AgentProfile) {
    setEditor({ title: 'Agent profile', fields: [
      { key: 'bio', label: 'Bio', value: p.agent_bio, type: 'multiline' },
      { key: 'accepting', label: 'Accepting requests', value: String(p.agent_accepting_requests), options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
      { key: 'baseAddress', label: 'Base address', value: p.agent_base_address },
      { key: 'workingAreas', label: 'Working areas (comma separated)', value: p.agent_working_areas?.join(', ') },
      { key: 'categories', label: 'Specialty slugs (comma separated)', value: p.categories?.map(c => c.slug).join(', ') },
      { key: 'transportMode', label: 'Transport', value: p.agent_transport_mode, options: transport },
      { key: 'maxPackageSize', label: 'Maximum package', value: p.agent_max_package_size, options: sizes },
      { key: 'vehicleInfo', label: 'Vehicle', value: p.agent_vehicle_info }, { key: 'vehiclePlateNumber', label: 'Vehicle plate', value: p.agent_vehicle_plate_number },
    ], submit: v => api.updateMe({ ...v, accepting: v.accepting === 'true', workingAreas: v.workingAreas.split(',').map(s => s.trim()).filter(Boolean), categories: v.categories.split(',').map(s => s.trim()).filter(Boolean), transportMode: v.transportMode || undefined, maxPackageSize: v.maxPackageSize || undefined }) });
  }
  function catalogueEditor(item?: CatalogueItem) {
    setEditor({ title: item ? 'Edit catalogue item' : 'Add catalogue item', imageLimit: 6, fields: [
      { key: 'sourceKind', label: 'Source', value: item?.source_kind || 'external', required: true, options: [{ value: 'joscity', label: 'JosCity business' }, { value: 'external', label: 'External shop' }] },
      { key: 'listingId', label: 'JosCity listing ID (if sourcing from a business)', value: item?.listing_id ? String(item.listing_id) : '' },
      { key: 'sourceName', label: 'Shop or business name', value: item?.source_name },
      { key: 'sourceUrl', label: 'Shop link (external only)', value: item?.source_url },
      { key: 'title', label: 'Title', value: item?.title, required: true }, { key: 'description', label: 'Description', value: item?.description, type: 'multiline' },
      categoryField(item?.category_slug), numeric('productPrice', 'Product price (NGN)', item?.product_price), numeric('agentFeePercent', 'Agent fee (%)', item?.agent_fee_percent),
      ...(item ? [{ key: 'status', label: 'Status', value: item.status, options: options(['active', 'inactive']) }] : []),
    ], submit: (v, images) => api.saveCatalogue(v, images, item?.item_id) });
  }
  function quoteEditor(request: AgentRequest) {
    const ticket = revision.current;
    void run(async () => {
      const quote = await api.myQuote(service, request.request_id);
      if (ticket !== revision.current) return;
      // This lookup is intentionally distinct from the requester-only quotes endpoint.
      setEditor({ title: 'Your quote', fields: service === 'buy' ? [numeric('productPrice', 'Product price (NGN)', quote?.product_price), numeric('feePercent', 'Agent fee (%)', quote?.fee_percent), { key: 'note', label: 'Note', value: quote?.note }] : [numeric('chargeAmount', 'Delivery charge (NGN)', quote?.charge_amount), { key: 'etaNote', label: 'Pickup estimate', value: quote?.eta_note }], submit: v => api.quote(service, request.request_id, v) });
    }, '', false);
  }
  function showQuotes(request: AgentRequest) {
    const ticket = revision.current;
    void run(async () => {
      const quotes = await api.quotes(service, request.request_id);
      if (ticket !== revision.current) return;
      setPanels([{ key: 'back', title: request.title || 'Delivery quotes', lines: ['Accept a quote to create an unfunded job. You choose when to fund it from your wallet.'], actions: [{ label: 'Back to requests', run: refresh }] }, ...quotes.map(q => ({
        key: String(q.quote_id), title: `Agent ${q.agent_user_id}`, lines: [q.status, service === 'buy' ? `Product ${money(q.product_price)} · Fee ${q.fee_percent}% (${money(q.fee_amount)})` : 'Delivery charge', `Total ${money(q.total_price ?? q.charge_amount)}`, q.note || q.eta_note || ''],
        actions: q.status === 'pending' ? [{ label: 'Accept quote', run: () => setEditor({ title: `Accept quote for ${money(q.total_price ?? q.charge_amount)}?`, fields: [], submit: () => api.acceptQuote(service, request.request_id, q.quote_id) }) }] : [],
      }))]);
    }, '', false);
  }
  function jobPanel(job: Job): Panel {
    const active = !job.cancelled_at && job.stage < 4;
    const actions: Action[] = [{ label: 'Refresh job details', run: () => void run(async () => { const ticket = revision.current; const fresh = await api.job(job.job_id); if (ticket === revision.current) setPanels([jobPanel(fresh)]); }, '', false) }];
    if (active && role === 'requester' && !job.funded) actions.push({ label: 'Fund from wallet', run: () => setEditor({ title: 'Fund this job from your JosCity wallet?', fields: [], submit: () => api.fund(job.job_id) }) });
    if (active && job.escrow_status === 'held') {
      if (role === 'requester' && job.stage === (job.source_type === 'buy' ? 3 : 2)) actions.push({ label: 'Confirm received', run: () => setEditor({ title: 'Confirm delivery and release the agent fee?', fields: [{ key: 'note', label: 'Note (optional)' }], submit: v => api.confirm(job.job_id, v.note) }) });
      if (role === 'agent' && job.source_type === 'buy' && job.stage === 1) actions.push({ label: 'Pay vendor / confirm purchase', run: () => setEditor({ title: 'Vendor payment', fields: [
        { key: 'vendorMemberId', label: "Vendor's JosCity member ID (or enter bank details below)" }, { key: 'bankName', label: 'Bank name' }, { key: 'accountNumber', label: 'Account number' }, { key: 'accountName', label: 'Account name' },
      ], submit: async v => { const vendor = v.vendorMemberId ? await agentRequest<{ user_id: number }>(`/account/wallet/member?member_id=${encodeURIComponent(v.vendorMemberId)}`, { auth: true }) : null; return api.purchase(job.job_id, { ...v, vendorUserId: vendor?.user_id }); } }) });
      else if (role === 'agent' && job.stage < (job.source_type === 'buy' ? 3 : 2)) actions.push({ label: 'Advance job', run: () => setEditor({ title: 'Advance to the next stage?', fields: [{ key: 'note', label: 'Progress note' }], submit: v => api.advance(job.job_id, v.note) }) });
    }
    if (active) actions.push({ label: 'Cancel job', run: () => setEditor({ title: 'Cancel job', fields: [{ key: 'reason', label: 'Reason (vendor payments may require support review)', required: true, type: 'multiline' }], submit: async v => { const result = await api.cancel(job.job_id, v.reason); return result.disputed ? 'A dispute was opened. Support will review the vendor payment; no refund has been issued yet.' : result.refunded ? `Cancellation processed: ${result.refunded === 'full' ? 'full refund' : 'fee refund'}.` : 'Job cancelled.'; } }) });
    return { key: String(job.job_id), title: `${job.source_type === 'buy' ? 'Purchase' : 'Delivery'} #${job.job_id}`, lines: [job.cancelled_at ? 'Cancelled' : job.stage_label, `Escrow: ${job.escrow_status || 'Not funded'}`, `Product: ${money(job.product_amount)} · Agent fee: ${money(job.agent_fee_amount)}`, job.payout_pending_manual ? 'Vendor bank transfer awaiting admin processing' : ''], actions };
  }
  useEffect(() => {
    const ticket = ++revision.current;
    setLoading(true); setError(''); setPanels([]);
    const actionPanels = async (): Promise<Panel[]> => {
      if (tab === 'directory') {
        const rows = await api.directory({ search: debounced, type: service === 'delivery' ? 'deliver' : 'buy', page, limit: 20 });
        return rows.map(p => ({ key: String(p.user_id), title: name(p), lines: [p.agent_bio || '', `${p.agent_rating_avg || 0} stars · ${p.agent_completed_jobs_count || 0} jobs`, p.agent_accepting_requests ? 'Accepting requests' : 'Not accepting'], actions: [
          { label: 'View profile', run: () => void run(async () => { const ticket = revision.current; const detail = await api.profile(p.user_id); if (ticket !== revision.current) return; setPanels([{ key: String(p.user_id), title: name(detail), lines: [detail.agent_bio || '', detail.categories?.map(c => c.name).join(', ') || '', detail.star_level?.label || ''], actions: [{ label: 'Request this agent', disabled: !detail.agent_accepting_requests, run: () => openRequest(String(p.user_id)) }, { label: 'Back', run: refresh }] }]); }, '', false) },
          { label: 'Request this agent', disabled: !p.agent_accepting_requests, run: () => openRequest(String(p.user_id)) },
        ] }));
      }
      if (tab === 'requests') {
        const rows = await api.requests(service, role, page);
        return rows.map(r => ({ key: String(r.request_id), title: r.title || r.package_description || `Delivery #${r.request_id}`, lines: [r.status, r.description || '', r.pickup_address ? `Pickup: ${r.pickup_address}` : '', r.destination_address ? `Delivery: ${r.destination_address}` : '', r.target_budget ? `Budget ${money(r.target_budget)}` : ''], images: r.images, actions: role === 'requester' ? [{ label: 'View quotes', run: () => showQuotes(r) }] : [
          { label: 'View / edit my quote', run: () => quoteEditor(r) }, { label: 'Withdraw my quote', run: () => setEditor({ title: 'Withdraw your quote?', fields: [], submit: () => api.withdrawQuote(service, r.request_id) }) },
        ] }));
      }
      if (tab === 'jobs') return (await api.jobs(role, page)).map(jobPanel);
      if (tab === 'catalogue') {
        const rows = role === 'agent' ? await api.myCatalogue() : await api.catalogue({ search: debounced, page, limit: 20 });
        return rows.map(item => ({ key: String(item.item_id), title: item.title, lines: [item.description || '', item.source_name ? `${item.source_kind === 'joscity' ? 'JosCity' : 'External'} · ${item.source_name}` : '', `Product ${money(item.product_price)} · Fee ${item.agent_fee_percent}% (${money(item.fee_amount)})`, `Total ${money(item.total_price)}`, ...(role === 'agent' ? [item.status] : [])], images: item.images, actions: role === 'agent' ? [
          { label: 'Edit', run: () => catalogueEditor(item) }, { label: 'Delete', run: () => setEditor({ title: `Delete ${item.title}?`, fields: [], submit: () => api.deleteCatalogue(item.item_id) }) },
        ] : [{ label: 'Request item', run: () => { setService('buy'); openRequest(String(item.agent_user_id), item); } }] }));
      }
      if (tab === 'referrals') {
        const result = await api.referrals();
        return [{ key: 'link', title: 'Your referral link', lines: [result.referral_link, 'Share this link with a business. Rewards are processed automatically.'] }, ...result.referrals.map((r,i) => ({ key: String(i), title: `Business ${r.referred_business_user_id}`, lines: [r.incentive_status, money(r.incentive_amount)] }))];
      }
      if (tab === 'wallet') {
        const [wallet, stats] = await Promise.all([agentRequest<{ balance: number }>('/account/wallet', { auth: true }), api.dashboard()]);
        const held = stats.held_agent_fees;
        return [{ key: 'balance', title: 'Normal wallet', lines: [money(wallet.balance), 'Add money or withdraw from your JosCity wallet.'] }, { key: 'escrow', title: 'Protected agent fees', lines: [money(held), 'Held fees are released when the requester confirms delivery.'] }, { key: 'rewards', title: 'CBC rewards', lines: ['Coming soon'] }];
      }
      const p = await api.me();
      if (ticket === revision.current) setProfile(p);
      if (!p.agent_type || p.agent_status !== 'active') return [{ key: 'onboarding', title: p.agent_type ? 'Agent account' : 'Become an agent', lines: [p.agent_status === 'pending_review' ? 'Your signup details are on file. You can use the dashboard while verification finishes.' : 'Use the services, specialties and NIN from the create account page. They are applied when you sign in.', p.agent_status || ''] }];
      const result: Panel[] = [{ key: 'profile', title: name(p), lines: [p.agent_bio || '', p.star_level?.label || '', `${p.agent_rating_avg || 0} stars · ${p.agent_completed_jobs_count || 0} completed jobs`, p.agent_accepting_requests ? 'Accepting requests' : 'Not accepting'], actions: [
        { label: 'Edit agent profile', run: () => editProfile(p) },
        { label: p.agent_accepting_requests ? 'Pause requests' : 'Accept requests', run: () => void run(() => api.updateMe({ accepting: !p.agent_accepting_requests })) },
        { label: 'Upload vehicle photo', run: () => setEditor({ title: 'Vehicle photo', fields: [], imageLimit: 1, submit: (_v, images) => { if (!images[0]) throw new Error('Choose a vehicle photo'); return api.vehiclePhoto(images[0]); } }) },
      ] }];
      if (tab === 'dashboard') { const stats = await api.dashboard(); result.push({ key: 'stats', title: 'Your work', lines: [`${stats.active_jobs} active jobs`, `${stats.completed_today} completed today`, `${stats.pending_quotes} pending quotes`] }); }
      return result;
    };
    actionPanels().then(rows => { if (ticket === revision.current) setPanels(rows); }).catch(e => { if (ticket === revision.current) setError(e.message || 'Unable to load. Please retry.'); }).finally(() => { if (ticket === revision.current) setLoading(false); });
    return () => { revision.current++; };
  }, [tab, service, debounced, page, version, role, categories]);
  const tabs = role === 'agent' ? ['dashboard', 'requests', 'jobs', 'catalogue', 'profile', 'wallet', 'referrals'] : ['directory', 'requests', 'jobs', 'catalogue'];
  return { tab, setTab, tabs, service, setService, search, setSearch, page, setPage, panels, profile, error, notice, loading, busy, editor, setEditor, refresh, run, openRequest, catalogueEditor };
}
