import { useEffect, useRef, useState } from 'react';
import { agentApi as api, Bounds, inBounds, MapConfig, MapJob, MapPin, MapRoute, PLATEAU_BOUNDS, Point } from '../api/agent';
import { directionsFallback, searchPlacesFallback } from '../api/mapSearch';

export function usePlateauMap(mode: 'personal' | 'business' | 'agent') {
  const [layer, setLayer] = useState('Businesses'), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [config, setConfig] = useState<MapConfig>({ bounds: PLATEAU_BOUNDS, listing_price: null, places_enabled: false });
  const [pins, setPins] = useState<MapPin[]>([]), [jobs, setJobs] = useState<MapJob[]>([]), [mine, setMine] = useState<MapPin[]>([]);
  const [point, setPoint] = useState<Point>({ lat: 9.8965, lng: 8.8583 }), [selection, setSelection] = useState<Point | null>(null), [me, setMe] = useState<Point | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null), [destination, setDestination] = useState<MapPin | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [routing, setRouting] = useState(false);
  const [sharing, setSharingState] = useState(false), [accepting, setAccepting] = useState(false), [revision, setRevision] = useState(0);
  const generation = useRef(0), mutating = useRef(false), routeTicket = useRef(0);
  const refresh = () => setRevision(v => v + 1);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 500); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    let current = true;
    api.mapConfig().then(c => { if (current) setConfig(c); }).catch(e => { if (current) setError(e.message); });
    if (mode === 'agent') api.me().then(p => { if (current) setAccepting(p.agent_status === 'active' && (p.agent_accepting_requests !== false)); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [mode, revision]);
  useEffect(() => {
    const ticket = ++generation.current;
    setLoading(true); setError(''); setPins([]); setJobs([]); setRoute(null);
    if (layer !== 'Places') setDestination(null);
    async function load() {
      if (layer === 'Deliveries') {
        const data = await api.mapJobs(mode === 'agent' ? 'agent' : 'requester');
        if (ticket !== generation.current) return;
        setJobs(data);
        setPins(data.flatMap(job => (['pickup','destination'] as const).flatMap(kind => {
          const lat = job[`${kind}_lat`], lng = job[`${kind}_lng`];
          if (lat == null || lng == null || !inBounds({ lat: Number(lat), lng: Number(lng) }, config.bounds)) return [];
          return [{ id: `${job.job_id}-${kind}`, label: `#${job.job_id} ${kind}`, address: job[`${kind}_address`], lat: Number(lat), lng: Number(lng) }];
        })));
      } else if (layer === 'Places') {
        if (search.length < 2) return;
        let rows: MapPin[] = [];
        try {
          rows = await api.places(search);
        } catch (first) {
          try {
            rows = await searchPlacesFallback(search, config.bounds);
          } catch {
            throw first;
          }
          if (!rows.length) throw first;
        }
        if (ticket !== generation.current) return;
        setPins(rows);
        if (rows[0]) {
          setDestination(rows[0]);
          setSelection(rows[0]);
          setPoint(rows[0]);
        } else {
          setDestination(null);
        }
      } else {
        const rows = await api.mapPublic(search);
        if (ticket === generation.current) setPins(rows.map(p => ({ ...p, lat: Number(p.lat), lng: Number(p.lng), label: p.label || p.business_name || 'Business' })));
      }
    }
    load().catch(e => { if (ticket === generation.current) setError(e.message); }).finally(() => { if (ticket === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [layer, search, revision, mode, config.bounds]);
  useEffect(() => {
    if (mode !== 'business') return;
    let current = true;
    api.mapMine().then(rows => { if (current) setMine(rows); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [mode, revision]);
  useEffect(() => {
    if (!destination || !me) {
      setRoute(null);
      setRouting(false);
      return;
    }
    const ticket = ++routeTicket.current;
    setRouting(true);
    async function loadRoute() {
      try {
        let next: MapRoute | null = null;
        try {
          next = await api.directions(me!, destination!);
        } catch {
          next = await directionsFallback(me!, destination!);
        }
        if (ticket !== routeTicket.current) return;
        setRoute(next);
      } catch {
        if (ticket === routeTicket.current) setRoute(null);
      } finally {
        if (ticket === routeTicket.current) setRouting(false);
      }
    }
    void loadRoute();
    return () => { routeTicket.current++; };
  }, [destination, me]);
  async function run(fn: () => Promise<unknown>, success: string) {
    if (mutating.current) return;
    mutating.current = true; setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(success); refresh(); }
    catch(e) { setError(e instanceof Error ? e.message : 'Unable to save. Please retry.'); }
    finally { mutating.current = false; setBusy(false); }
  }
  function select(p: Point & Partial<MapPin>) {
    if (!inBounds(p, config.bounds)) { setError('Choose a position inside the Plateau service area.'); return; }
    setSelection(p);
    setPoint(p);
    if (typeof p.label === 'string' && p.label) {
      setDestination({ id: p.id ?? `${p.lat},${p.lng}`, label: p.label, address: p.address, lat: p.lat, lng: p.lng });
    }
  }
  function locate(p: Point) {
    setMe(p);
    if (!inBounds(p, config.bounds)) {
      setNotice('You are outside the Plateau service area. Your pin is still shown.');
      return false;
    }
    if (!destination) setPoint(p);
    setNotice('Your location is pinned on the map.');
    return true;
  }
  async function setSharing(next: boolean) {
    setError('');
    if (mode === 'agent' && next) {
      try {
        if (!accepting) {
          await api.updateMe({ accepting: true });
          setAccepting(true);
        }
        setSharingState(true);
      } catch (e) {
        setSharingState(false);
        setError(e instanceof Error ? e.message : 'Could not start location sharing.');
      }
      return;
    }
    setSharingState(next);
  }
  return { layer, setLayer, query, setQuery, searchNow: () => setSearch(query.trim()), config, pins, jobs, mine, point, me, selection, select, locate, route, destination, routing, error, setError, notice, setNotice, loading, busy, refresh, run, sharing, setSharing, accepting };
}

export function directionsUrl(pin: Point & { address?: string }, origin?: Point | null) {
  const destination = encodeURIComponent(pin.address || `${pin.lat},${pin.lng}`);
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
export function placeUrl(pin: Point & { address?: string }) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.address || `${pin.lat},${pin.lng}`)}`;
}
export function clampPoint(point: Point, bounds: Bounds): Point {
  return { lat: Math.max(bounds.minLat, Math.min(bounds.maxLat, point.lat)), lng: Math.max(bounds.minLng, Math.min(bounds.maxLng, point.lng)) };
}
