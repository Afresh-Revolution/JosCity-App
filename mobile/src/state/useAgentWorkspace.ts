import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi as api, AgentProfile, AgentRequest, CatalogueItem, Category, Job, Service, UploadImage, agentCounterpartyId, escrowTotal, jobImages, jobTitle, payVendorFromEscrow, vendorPayoutStatus } from '../api/agent';
import { agentRequest } from '../api/agentTransport';
import { ensureBlockedUsers, filterUnblocked } from '../storage/blockedUsers';

import { formatMoneyInput, parseMoneyInput } from '../utils/format';

export type Field = { key: string; label: string; value?: string; required?: boolean; type?: 'number' | 'money' | 'password' | 'multiline'; options?: { value: string; label: string }[] };
export type Editor = { title: string; fields: Field[]; imageLimit?: number; submit: (values: Record<string, string>, images: UploadImage[]) => Promise<unknown> };
export type Action = { label: string; run: () => void; disabled?: boolean; profileUserId?: number; picture?: string | null };
export type Panel = { key: string; title: string; lines: string[]; images?: string[]; actions?: Action[]; job?: Job };
const money = (value: unknown) => `NGN ${Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const name = (p: AgentProfile) => `${p.user_firstname || ''} ${p.user_lastname || ''}`.trim();
const options = (values: string[]) => values.map(value => ({ value, label: value }));
const sizes = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'bulky', label: 'Bulky' },
];
const transport = options(['walking', 'bicycle', 'motorcycle', 'tricycle', 'car']);
const moneyField = (key: string, label: string, value?: unknown): Field => ({
  key,
  label,
  type: 'money',
  value: value == null || value === '' ? '' : formatMoneyInput(typeof value === 'number' ? value : String(value)),
  required: true,
});
function visibleAgentError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed. Please try again.';
  if (/FormDataPart/i.test(message)) return 'Could not attach those photos. Try choosing them again.';
  return message;
}
export function useAgentWorkspace(role: 'agent' | 'requester', initialTab = 'dashboard', initialService: Service = 'buy', initialTarget = '') {
  const [tab, setTab] = useState(initialTab), [service, setService] = useState<Service>(initialService);
  const [search, setSearch] = useState(''), [debounced, setDebounced] = useState(''), [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]), [profile, setProfile] = useState<AgentProfile | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]), [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [cbcCardOn, setCbcCardOn] = useState(false);
  const revision = useRef(0), mutation = useRef(false), [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const run = useCallback(async (fn: () => Promise<unknown>, message = 'Saved', reload = true) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await fn(); setNotice(typeof result === 'string' ? result : message); if (reload) { setEditor(null); refresh(); } }
    catch (e) { setError(visibleAgentError(e)); }
    finally { mutation.current = false; setBusy(false); }
  }, [refresh]);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { let active = true; api.categories().then(rows => { if (active) setCategories(rows); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    void agentRequest<{ cbc_card?: { enabled?: boolean } }>('/account/wallet/funding', { auth: true })
      .then((data) => { if (active) setCbcCardOn(Boolean(data?.cbc_card?.enabled)); })
      .catch(() => { if (active) setCbcCardOn(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { setPage(1); }, [tab, service]);
  const categoryField = (value = ''): Field => ({ key: 'categorySlug', label: 'Category', required: true, value, options: categories.map(c => ({ value: c.slug, label: c.name })) });
  const openRequest = (target = initialTarget, item?: CatalogueItem) => { const requestService = item ? 'buy' : service; setEditor({
    title: requestService === 'buy' ? 'Help me buy' : 'Help me deliver', imageLimit: 3,
    fields: [
      { key: 'recipient', label: 'Who can quote?', value: target ? 'direct' : 'public', required: true, options: [...(target ? [{ value: 'direct', label: item ? 'Catalogue agent' : 'Selected agent' }] : []), { value: 'public', label: 'Available agents' }] },
      ...(requestService === 'buy' ? [{ key: 'title', label: 'Item', required: true, value: item?.title }, categoryField(item?.category_slug), moneyField('targetBudget', 'Budget (NGN)', item?.total_price)] : [{ key: 'packageSize', label: 'Package size', options: sizes, required: true }]),
      { key: 'description', label: requestService === 'buy' ? 'Description and instructions' : 'Package description', required: true, type: 'multiline' },
      { key: 'pickupAddress', label: 'Pickup address', required: requestService === 'delivery' },
      { key: 'destinationAddress', label: 'Delivery address', required: true },
    ],
    submit: (v, images) => {
      const { recipient, description, pickupAddress, destinationAddress, targetBudget, ...rest } = v;
      const budget = parseMoneyInput(targetBudget);
      return api.createRequest(requestService, {
        ...rest,
        isPublic: recipient === 'public',
        agentUserId: recipient === 'direct' ? target : undefined,
        catalogueItemId: item?.item_id,
        pickupAddress: pickupAddress?.trim() || undefined,
        destinationAddress: destinationAddress?.trim() || undefined,
        ...(requestService === 'delivery' ? { packageDescription: description } : { description }),
        ...(requestService === 'buy' && budget != null && !Number.isNaN(budget) ? { targetBudget: budget } : {}),
      }, images);
    },
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
      categoryField(item?.category_slug), moneyField('productPrice', 'Product price (NGN)', item?.product_price),
      ...(item ? [{ key: 'status', label: 'Status', value: item.status, options: options(['active', 'inactive']) }] : []),
    ], submit: (v, images) => api.saveCatalogue(v, images, item?.item_id) });
  }
  function quoteEditor(request: AgentRequest) {
    const ticket = revision.current;
    void run(async () => {
      const quote = await api.myQuote(service, request.request_id);
      if (ticket !== revision.current) return;
      // This lookup is intentionally distinct from the requester-only quotes endpoint.
      setEditor({ title: 'Your quote', fields: service === 'buy' ? [moneyField('productPrice', 'Product price (NGN)', quote?.product_price), { key: 'note', label: 'Note', value: quote?.note }] : [moneyField('chargeAmount', 'Delivery charge (NGN)', quote?.charge_amount), { key: 'etaNote', label: 'Pickup estimate', value: quote?.eta_note }], submit: v => service === 'buy' ? api.quote(service, request.request_id, { productPrice: v.productPrice, note: v.note }) : api.quote(service, request.request_id, v) });
    }, '', false);
  }
  function showQuotes(request: AgentRequest) {
    const ticket = revision.current;
    void run(async () => {
      const quotes = await api.quotes(service, request.request_id);
      if (ticket !== revision.current) return;
      setPanels([{ key: 'back', title: request.title || 'Delivery quotes', lines: ['Accept a quote to create an unfunded job. You choose when to fund it from your wallet.'], actions: [{ label: 'Back to requests', run: refresh }] }, ...quotes.map(q => ({
        key: String(q.quote_id), title: `Agent ${q.agent_user_id}`, lines: [q.status, service === 'buy' ? `Product ${money(q.product_price)} · Fee ${q.fee_percent}% (${money(q.fee_amount)})` : 'Delivery charge', `Total ${money(q.total_price ?? q.charge_amount)}`, q.note || q.eta_note || ''],
        actions: q.status === 'pending' ? [{ label: 'Accept quote', run: () => setEditor({ title: `Accept quote for ${money(q.total_price ?? q.charge_amount)}? Product plus delivery will be held in escrow when you fund the job.`, fields: [], submit: () => api.acceptQuote(service, request.request_id, q.quote_id) }) }] : [],
      }))]);
    }, '', false);
  }
  function jobPanel(job: Job): Panel {
    const active = !job.cancelled_at && job.stage < 4;
    const actions: Action[] = [{ label: 'Refresh job details', run: () => void run(async () => { const ticket = revision.current; const fresh = await api.job(job.job_id); if (ticket === revision.current) setPanels([jobPanel(fresh)]); }, '', false) }];
    if (active && role === 'requester' && !job.funded) {
      const held = money(escrowTotal(job));
      actions.push({ label: 'Fund from wallet', run: () => setEditor({ title: `Hold ${held} in escrow? Product ${money(job.product_amount)} plus delivery ${money(job.agent_fee_amount)} stays protected until the vendor is paid.`, fields: [], submit: async () => { await api.fund(job.job_id); return `${held} is now held in escrow.`; } }) });
      if (cbcCardOn) {
        actions.push({
          label: 'Pay with CBC',
          run: () => setEditor({
            title: `Hold ${held} in escrow with CBC? Product ${money(job.product_amount)} plus delivery ${money(job.agent_fee_amount)}.`,
            fields: [
              { key: 'card_number', label: 'CBC card number', required: true },
              { key: 'cvc', label: 'CVC', required: true, type: 'password' },
              { key: 'card_pin', label: 'Card PIN', required: true, type: 'password' },
            ],
            submit: async (v) => { await api.fund(job.job_id, { method: 'cbc_card', card_number: v.card_number, cvc: v.cvc, card_pin: v.card_pin }); return `${held} is now held in escrow.`; },
          }),
        });
      }
    }
    if (active && job.escrow_status === 'held') {
      if (role === 'requester' && job.stage === (job.source_type === 'buy' ? 3 : 2)) actions.push({ label: 'Confirm received', run: () => setEditor({ title: 'Confirm delivery and release the agent fee?', fields: [{ key: 'note', label: 'Note (optional)' }], submit: v => api.confirm(job.job_id, v.note) }) });
      if (role === 'agent' && job.source_type === 'buy' && job.stage === 1) actions.push({ label: 'Pay vendor from escrow', run: () => setEditor({ title: 'Pay vendor from escrow', fields: [
        { key: 'vendorEmail', label: 'JosCity business email (wallet transfer if they are on JosCity)' }, { key: 'bankName', label: 'Bank name (if not on JosCity)' }, { key: 'accountNumber', label: 'Account number' }, { key: 'accountName', label: 'Account name' }, { key: 'bankCode', label: 'Paystack bank code (optional)' },
      ], submit: v => payVendorFromEscrow(job.job_id, v) }) });
    }
    if (active) actions.push({ label: 'Cancel job', run: () => setEditor({ title: 'Cancel job', fields: [{ key: 'reason', label: 'Reason (vendor payments may require support review)', required: true, type: 'multiline' }], submit: async v => { const result = await api.cancel(job.job_id, v.reason); return result.disputed ? 'A dispute was opened. Support will review the vendor payment; no refund has been issued yet.' : result.refunded ? `Cancellation processed: ${result.refunded === 'full' ? 'full refund' : 'fee refund'}.` : 'Job cancelled.'; } }) });
    if (!active && role === 'requester' && job.stage === 4 && !job.reviewed && !job.review_rating) {
      actions.push({ label: 'Rate this agent', run: () => setEditor({ title: 'Rate this agent (1–5 stars). Hate speech and curse words are not allowed.', fields: [{ key: 'rating', label: 'Stars (1-5)', required: true, type: 'number' }, { key: 'comment', label: 'Review (optional)', type: 'multiline' }], submit: async v => { const rating = Number(v.rating); if (rating < 1 || rating > 5) throw new Error('Choose 1 to 5 stars'); await api.review(job.job_id, { rating, comment: v.comment }); return 'Thanks. Your rating is now public on the agent’s profile.'; } }) });
    }
    return { key: String(job.job_id), title: jobTitle(job), lines: [job.cancelled_at ? 'Cancelled' : job.payout_pending_manual ? 'Pending vendor payout' : job.stage_label, job.escrow_status === 'held' ? `Escrow holding ${money(escrowTotal(job))} (product ${money(job.product_amount)} + delivery ${money(job.agent_fee_amount)})` : `Escrow: ${job.escrow_status || 'Not funded'} · Total ${money(escrowTotal(job))}`, vendorPayoutStatus(job)].filter(Boolean), images: jobImages(job), actions, job };
  }
  useEffect(() => {
    const ticket = ++revision.current;
    setLoading(true); setError(''); setPanels([]);
    const actionPanels = async (): Promise<Panel[]> => {
      await ensureBlockedUsers();
      if (tab === 'directory') {
        const rows = filterUnblocked(await api.directory({ search: debounced, type: service === 'delivery' ? 'deliver' : 'buy', page, limit: 20 }), (p) => p.user_id);
        return rows.map(p => ({ key: String(p.user_id), title: name(p), lines: [p.agent_bio || '', `${Number(p.agent_rating_avg || 0).toFixed(1)} stars · ${p.agent_completed_jobs_count || 0} jobs`, p.agent_accepting_requests ? 'Accepting requests' : 'Not accepting'], actions: [
          { label: 'View profile', profileUserId: p.user_id, picture: p.user_picture, run: () => {} },
          { label: 'Request this agent', disabled: !p.agent_accepting_requests, run: () => openRequest(String(p.user_id)) },
        ] }));
      }
      if (tab === 'requests') {
        const rows = filterUnblocked(await api.requests(service, role, page), (r) => agentCounterpartyId(r, role === 'agent'));
        return rows.map(r => ({ key: String(r.request_id), title: r.title || r.package_description || `Delivery #${r.request_id}`, lines: [r.status, r.description || '', r.pickup_address ? `Pickup: ${r.pickup_address}` : '', r.destination_address ? `Delivery: ${r.destination_address}` : '', r.target_budget ? `Budget ${money(r.target_budget)}` : ''], images: r.images, actions: role === 'requester' ? [{ label: 'View quotes', run: () => showQuotes(r) }] : [
          { label: 'View / edit my quote', run: () => quoteEditor(r) }, { label: 'Withdraw my quote', run: () => setEditor({ title: 'Withdraw your quote?', fields: [], submit: () => api.withdrawQuote(service, r.request_id) }) },
        ] }));
      }
      if (tab === 'jobs') return filterUnblocked(await api.jobs(role, page), (job) => agentCounterpartyId(job, role === 'agent')).map(jobPanel);
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
        return [{ key: 'balance', title: 'Normal wallet', lines: [money(wallet.balance), 'Add money or withdraw from your JosCity wallet.'] }, { key: 'escrow', title: 'Protected agent fees', lines: [money(held), 'Held fees are released when the requester confirms delivery.'] }];
      }
      const p = await api.me();
      if (ticket === revision.current) setProfile(p);
      if (!p.agent_type || p.agent_status !== 'active') return [{ key: 'onboarding', title: p.agent_type ? 'Agent account' : 'Become an agent', lines: [p.agent_status === 'pending_review' ? 'Your signup details are on file. You can use the dashboard while verification finishes.' : 'Use the services, specialties and NIN from the create account page. They are applied when you sign in.', p.agent_status || ''] }];
      const result: Panel[] = [{ key: 'profile', title: name(p), lines: [p.agent_bio || '', p.star_level?.label || '', `${p.agent_rating_avg || 0} stars · ${p.agent_completed_jobs_count || 0} completed jobs`, p.agent_accepting_requests ? 'Accepting requests' : 'Not accepting'], actions: [
        { label: 'Edit agent profile', run: () => editProfile(p) },
        { label: p.agent_accepting_requests ? 'Pause requests' : 'Accept requests', run: () => void run(() => api.updateMe({ accepting: !p.agent_accepting_requests })) },
        { label: 'Upload vehicle photo', run: () => setEditor({ title: 'Vehicle photo', fields: [], imageLimit: 1, submit: (_v, images) => { if (!images[0]) throw new Error('Choose a vehicle photo'); return api.vehiclePhoto(images[0]); } }) },
      ] }];
      if (tab === 'dashboard') {
        const [stats, jobs] = await Promise.all([api.dashboard(), api.jobs(role, 1)]);
        const pendingPayouts = jobs.filter(j => j.payout_pending_manual).length;
        result.push({ key: 'stats', title: 'Your work', lines: [`${stats.active_jobs} active jobs`, `${stats.completed_today} completed today`, `${stats.pending_quotes} pending quotes`, pendingPayouts ? `${pendingPayouts} vendor payout${pendingPayouts === 1 ? '' : 's'} pending admin payment` : 'No vendor payouts waiting on admin'] });
      }
      return result;
    };
    actionPanels().then(rows => { if (ticket === revision.current) setPanels(rows); }).catch(e => { if (ticket === revision.current) setError(e.message || 'Unable to load. Please retry.'); }).finally(() => { if (ticket === revision.current) setLoading(false); });
    return () => { revision.current++; };
  }, [tab, service, debounced, page, version, role, categories, cbcCardOn]);
  const tabs = role === 'agent' ? ['dashboard', 'requests', 'jobs', 'catalogue', 'profile', 'wallet', 'referrals'] : ['directory', 'requests', 'jobs'];
  return { tab, setTab, tabs, service, setService, search, setSearch, page, setPage, panels, profile, error, notice, loading, busy, editor, setEditor, refresh, run, openRequest, catalogueEditor };
}
