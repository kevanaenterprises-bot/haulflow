import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LogOut, Truck, Mic, ChevronRight, Calendar,
  Package, AlertTriangle, ArrowLeft, Camera, Upload, X, CheckCircle,
  FileText, RotateCcw, Landmark, Radio, Fuel, Plus, Trash2, ClipboardList,
} from 'lucide-react';
import { cn, formatDate, formatCurrency } from '../../lib/utils';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

async function driverApi(path: string, method = 'GET', body?: any) {
  const token = localStorage.getItem('hf_driver_token');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

interface Props {
  driver: any;
  onLogout: () => void;
}

type View = 'dashboard' | 'detail' | 'fuel' | 'inspection';

export default function DriverDashboard({ driver, onLogout }: Props) {
  const [load, setLoad] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(
    (localStorage.getItem('hf_voice') as any) || 'female'
  );
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showAcceptWarning, setShowAcceptWarning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState('');

  // Road Tour — historical markers (persisted across page refresh)
  const [tourActive, setTourActive] = useState<boolean>(() => localStorage.getItem('hf_tour_active') === '1');
  const [tourMarker, setTourMarker] = useState<{ title: string; summary: string } | null>(null);
  const tourWatchRef = useRef<number | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());
  const lastFetchRef = useRef<{ lat: number; lng: number } | null>(null);

  const fetchLoad = useCallback(async () => {
    try {
      const loads = await driverApi('/api/driver/loads');
      const active = loads.find((l: any) => ['DISPATCHED', 'IN_TRANSIT'].includes(l.status));
      setLoad(active || null);
    } catch { setLoad(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLoad();
    const interval = setInterval(fetchLoad, 30000); // refresh every 30 s
    return () => clearInterval(interval);
  }, [fetchLoad]);

  const toggleVoice = () => {
    const next = voiceGender === 'female' ? 'male' : 'female';
    setVoiceGender(next);
    localStorage.setItem('hf_voice', next);
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      voiceGender === 'female'
        ? v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Victoria')
        : v.name.toLowerCase().includes('male') || v.name.includes('Alex') || v.name.includes('Daniel')
    );
    if (preferred) utt.voice = preferred;
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const updated = await driverApi(`/api/driver/loads/${load.id}/status`, 'PATCH', { status: 'IN_TRANSIT' });
      setLoad(updated);
      setShowAcceptWarning(false);
      speak(`Load ${load.load_number} accepted. Heading to ${load.dest_city}, ${load.dest_state}. Drive safe.`);
    } catch (e: any) { setError(e.message); }
    setAccepting(false);
  };

  const handleReturn = async () => {
    setReturning(true);
    setError('');
    try {
      await driverApi(`/api/driver/loads/${load.id}/return`, 'PATCH');
      setLoad(null);
      setShowReturnConfirm(false);
      setView('dashboard');
    } catch (e: any) { setError(e.message); }
    setReturning(false);
  };

  // Fetch nearby historical markers from Wikipedia geo API
  const fetchNearbyMarkers = useCallback(async (lat: number, lng: number) => {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=8000&gslimit=10&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages: any[] = data?.query?.geosearch || [];
      // Filter to likely historical/landmark articles
      const keywords = ['historic', 'monument', 'landmark', 'marker', 'memorial', 'battlefield', 'fort', 'bridge', 'station', 'museum', 'church', 'cemetery', 'national'];
      const filtered = pages.filter(p =>
        keywords.some(k => p.title.toLowerCase().includes(k)) || pages.indexOf(p) < 3
      );
      for (const page of filtered.slice(0, 5)) {
        if (announcedRef.current.has(page.pageid.toString())) continue;
        // Get a short extract
        const extractRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`);
        const extractData = await extractRes.json();
        const summary = extractData?.extract?.split('. ')[0] || '';
        if (!summary) continue;
        announcedRef.current.add(page.pageid.toString());
        setTourMarker({ title: page.title, summary });
        speak(`Historical marker nearby: ${page.title}. ${summary}`);
        break; // announce one at a time
      }
    } catch { /* silent fail — no disruption to driver */ }
  }, [speak]);

  // Internal start — used by both the button click and the auto-resume effect.
  // `announce` controls whether the activation phrase is spoken (silent on auto-resume).
  const beginTourWatch = useCallback((announce: boolean) => {
    if (!navigator.geolocation) {
      if (announce) speak('Location services are not available on this device.');
      return false;
    }
    if (tourWatchRef.current !== null) return true; // already watching
    announcedRef.current = new Set();
    if (announce) speak('Road Tour activated. Historical markers along your route will be announced.');
    tourWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const last = lastFetchRef.current;
        const distMoved = last ? Math.hypot(lat - last.lat, lng - last.lng) : 999;
        if (distMoved > 0.007) {
          lastFetchRef.current = { lat, lng };
          fetchNearbyMarkers(lat, lng);
        }
      },
      () => { /* location error — silent */ },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
    return true;
  }, [fetchNearbyMarkers, speak]);

  const startTour = () => {
    if (!beginTourWatch(true)) return;
    setTourActive(true);
    localStorage.setItem('hf_tour_active', '1');
  };

  const stopTour = () => {
    if (tourWatchRef.current !== null) {
      navigator.geolocation.clearWatch(tourWatchRef.current);
      tourWatchRef.current = null;
    }
    setTourActive(false);
    setTourMarker(null);
    localStorage.removeItem('hf_tour_active');
    speak('Road Tour stopped.');
  };

  // Auto-resume the tour after a page refresh if it was active before.
  useEffect(() => {
    if (tourActive && tourWatchRef.current === null) {
      beginTourWatch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (tourWatchRef.current !== null) navigator.geolocation.clearWatch(tourWatchRef.current);
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // GEOFENCE DETECTION — fires enter/exit events when driver crosses the
  // shipper or receiver geofence on the active load. Server records timestamps.
  // ────────────────────────────────────────────────────────────────────────
  const geofenceWatchRef = useRef<number | null>(null);
  // Track which stops the driver is currently *inside* so we only fire on transitions
  const insideRef = useRef<{ shipper: boolean; receiver: boolean }>({ shipper: false, receiver: false });

  useEffect(() => {
    // Tear down any previous watcher when the active load changes
    if (geofenceWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geofenceWatchRef.current);
      geofenceWatchRef.current = null;
    }
    insideRef.current = { shipper: false, receiver: false };

    if (!load) return;
    if (!['DISPATCHED', 'IN_TRANSIT'].includes(load.status)) return;
    const sLat = load.shipper_lat  != null ? parseFloat(load.shipper_lat)  : null;
    const sLng = load.shipper_lng  != null ? parseFloat(load.shipper_lng)  : null;
    const rLat = load.receiver_lat != null ? parseFloat(load.receiver_lat) : null;
    const rLng = load.receiver_lng != null ? parseFloat(load.receiver_lng) : null;
    if ((sLat == null || sLng == null) && (rLat == null || rLng == null)) return; // nothing to watch
    if (!navigator.geolocation) return;

    const radiusMeters = parseFloat(load.geofence_radius) || 300;

    // Haversine distance in meters between two lat/lng pairs
    const distMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const R = 6371000;
      const toRad = (d: number) => d * Math.PI / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng/2)**2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    const post = (stop_type: 'pickup' | 'delivery', event_type: 'enter' | 'exit', lat: number, lng: number) => {
      driverApi('/api/driver/geofence', 'POST', {
        load_id: load.id,
        stop_id: stop_type,
        stop_type,
        event_type,
        lat,
        lng,
      }).catch(() => { /* silent — server dedupes; transient failures retried on next pulse */ });
    };

    geofenceWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;

        if (sLat != null && sLng != null) {
          const inside = distMeters(lat, lng, sLat, sLng) <= radiusMeters;
          if (inside && !insideRef.current.shipper) {
            insideRef.current.shipper = true;
            post('pickup', 'enter', lat, lng);
          } else if (!inside && insideRef.current.shipper) {
            insideRef.current.shipper = false;
            post('pickup', 'exit', lat, lng);
          }
        }
        if (rLat != null && rLng != null) {
          const inside = distMeters(lat, lng, rLat, rLng) <= radiusMeters;
          if (inside && !insideRef.current.receiver) {
            insideRef.current.receiver = true;
            post('delivery', 'enter', lat, lng);
          } else if (!inside && insideRef.current.receiver) {
            insideRef.current.receiver = false;
            post('delivery', 'exit', lat, lng);
          }
        }
      },
      () => { /* GPS error — silent, retried automatically */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    return () => {
      if (geofenceWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geofenceWatchRef.current);
        geofenceWatchRef.current = null;
      }
    };
  }, [load?.id, load?.status, load?.shipper_lat, load?.shipper_lng, load?.receiver_lat, load?.receiver_lng, load?.geofence_radius]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Truck className="w-10 h-10 text-brand-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">Welcome back</p>
            <h1 className="text-lg font-bold">{driver.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice toggle */}
            <button
              onClick={toggleVoice}
              title={`Voice: ${voiceGender}`}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              {voiceGender === 'female' ? <Mic className="w-4 h-4 text-pink-400" /> : <Mic className="w-4 h-4 text-blue-400" />}
              <span className={voiceGender === 'female' ? 'text-pink-400' : 'text-blue-400'}>
                {voiceGender === 'female' ? '♀ Female' : '♂ Male'}
              </span>
            </button>
            <button onClick={onLogout} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-xl transition">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* No load state */}
      {!load && (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <Truck className="w-16 h-16 text-gray-700 mb-4" />
          <h2 className="text-xl font-bold text-gray-300 mb-2">No Active Load</h2>
          <p className="text-gray-500 text-sm mb-6">Check back when dispatch assigns you a load.</p>
          <button
            onClick={fetchLoad}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}

      {/* Load view */}
      {load && view === 'dashboard' && (
        <div className="px-4 py-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/30 px-4 py-3 rounded-xl">{error}</p>}

          {/* Status badge */}
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold',
            load.status === 'DISPATCHED' ? 'bg-amber-900/40 text-amber-300' : 'bg-blue-900/40 text-blue-300'
          )}>
            <div className={cn('w-2 h-2 rounded-full animate-pulse', load.status === 'DISPATCHED' ? 'bg-amber-400' : 'bg-blue-400')} />
            {load.status === 'DISPATCHED' ? 'Assigned — Awaiting Acceptance' : 'In Transit'}
          </div>

          {/* Load card */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xl font-bold">#{load.load_number}</span>
                  {load.customer_name && <p className="text-gray-400 text-sm mt-0.5">{load.customer_name}</p>}
                </div>
                {load.rate && <span className="text-brand-400 font-bold text-lg">{formatCurrency(load.rate)}</span>}
              </div>
            </div>

            {/* Route */}
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="w-0.5 flex-1 bg-gray-600 my-1" />
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup</p>
                    <p className="font-semibold">{load.origin_city}, {load.origin_state}</p>
                    {load.origin_address && <p className="text-sm text-gray-400">{load.origin_address}</p>}
                    {load.pickup_date && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{formatDate(load.pickup_date)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery</p>
                    <p className="font-semibold">{load.dest_city}, {load.dest_state}</p>
                    {load.dest_address && <p className="text-sm text-gray-400">{load.dest_address}</p>}
                    {load.delivery_date && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{formatDate(load.delivery_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {load.cargo_description && (
                <div className="flex items-start gap-2 pt-1 border-t border-gray-700">
                  <Package className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-400">{load.cargo_description}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-gray-700 space-y-3">
              {/* Road Tour */}
              <button
                onClick={tourActive ? stopTour : startTour}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition',
                  tourActive
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-brand-600 hover:bg-brand-500 text-white'
                )}
              >
                {tourActive
                  ? <><Radio className="w-5 h-5 animate-pulse" /> Road Tour Active — Tap to Stop</>
                  : <><Landmark className="w-5 h-5" /> Start Road Tour</>
                }
              </button>

              {/* Active marker announcement card */}
              {tourActive && tourMarker && (
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3">
                  <p className="text-xs text-amber-400 uppercase tracking-wide font-medium mb-1 flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" /> Nearby Historical Marker
                  </p>
                  <p className="text-sm font-semibold text-white">{tourMarker.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tourMarker.summary}</p>
                </div>
              )}
              {tourActive && !tourMarker && (
                <div className="bg-gray-700/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Scanning for historical markers along your route...</p>
                </div>
              )}

              {/* Accept Load (only when DISPATCHED) */}
              {load.status === 'DISPATCHED' && (
                <button
                  onClick={() => setShowAcceptWarning(true)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-xl font-bold text-base transition"
                >
                  <CheckCircle className="w-5 h-5" />
                  Accept Load
                </button>
              )}

              {/* Open Load (only when IN_TRANSIT) */}
              {load.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => setView('detail')}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-base transition"
                >
                  <FileText className="w-5 h-5" />
                  Open Load
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Return to Dispatch */}
              <button
                onClick={() => setShowReturnConfirm(true)}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl font-medium text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                Return Load to Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load detail view */}
      {load && view === 'detail' && (
        <LoadDetail
          load={load}
          speak={speak}
          onBack={() => { setView('dashboard'); fetchLoad(); }}
          onDelivered={() => { setLoad(null); setView('dashboard'); }}
        />
      )}

      {/* Fuel log view */}
      {view === 'fuel' && (
        <FuelLog load={load} onBack={() => setView('dashboard')} />
      )}

      {/* Pre-trip inspection view */}
      {view === 'inspection' && (
                <PreTripInspection driver={driver} onBack={() => setView('dashboard')} />
              )}

      {/* Bottom nav — only on dashboard and fuel views */}
      {view !== 'detail' && view !== 'inspection' && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex z-40">
          <button
            onClick={() => setView('dashboard')}
            className={cn('flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition',
              view === 'dashboard' ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300')}
          >
            <Truck className="w-5 h-5" />
            My Load
          </button>
          <button
            onClick={() => setView('fuel')}
            className={cn('flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition',
              view === 'fuel' ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300')}
          >
            <Fuel className="w-5 h-5" />
            Fuel Log
          </button>
                  <button
                              onClick={() => setView('inspection')}
                              className={cn('flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition',
                                                        view === 'inspection' ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300')}
                            >
                            <ClipboardList className="w-5 h-5" />
                            Inspection
                  </button>
        </div>
      )}

      {/* Accept warning modal */}
      {showAcceptWarning && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 border border-gray-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg">Accept Load #{load?.load_number}?</h3>
                <p className="text-gray-400 text-sm mt-2">
                  By accepting this load, you confirm that you will track your location from pickup until arrival at the receiver. Your location will be visible to dispatch until delivery is complete.
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowAcceptWarning(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleAccept} disabled={accepting} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50">
                {accepting ? 'Accepting...' : 'Accept & Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return confirm modal */}
      {showReturnConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 border border-gray-700">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg">Return Load to Dispatch?</h3>
                <p className="text-gray-400 text-sm mt-2">
                  This will send load #{load?.load_number} back to the dispatch queue. Dispatch will need to reassign it.
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowReturnConfirm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleReturn} disabled={returning} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50">
                {returning ? 'Returning...' : 'Yes, Return It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Load Detail Screen
// ─────────────────────────────────────────────
function LoadDetail({
  load: initialLoad,
  speak,
  onBack,
  onDelivered,
}: {
  load: any;
  speak: (t: string) => void;
  onBack: () => void;
  onDelivered: () => void;
}) {
  const [load] = useState(initialLoad);
  const [bol, setBol] = useState(load.bol_number || '');
  const [extraStop, setExtraStop] = useState(load.extra_stop_fee || '');
  const [lumper, setLumper] = useState(load.lumper_fee || '');
  const [detention, setDetention] = useState(load.detention_fee || '');
  const [podFiles, setPodFiles] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const bolFilled = bol.trim().length > 0;
  const canDeliver = bolFilled && podFiles.length > 0;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newEntries = Array.from(files).map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setPodFiles(prev => [...prev, ...newEntries]);
  };

  const removePod = (idx: number) => {
    setPodFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadAllPods = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const { file } of podFiles) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await driverApi(`/api/driver/loads/${load.id}/pod`, 'POST', {
        image_base64: base64,
        mime_type: file.type,
      });
      if (data.pod_url) urls.push(data.pod_url);
    }
    return urls;
  };

  const handleDeliver = async () => {
    if (!canDeliver) return;
    setDelivering(true);
    setError('');
    try {
      setUploading(true);
      const pod_urls = await uploadAllPods();
      setUploading(false);
      if (!pod_urls.length) { setError('POD photo upload failed — try again'); setDelivering(false); return; }
      await driverApi(`/api/driver/loads/${load.id}/status`, 'PATCH', {
        status: 'DELIVERED',
        pod_url: pod_urls[0],
        pod_urls,
        bol_number: bol,
        extra_stop_fee: extraStop ? parseFloat(extraStop) : null,
        lumper_fee: lumper ? parseFloat(lumper) : null,
        detention_fee: detention ? parseFloat(detention) : null,
      });
      speak(`Load ${load.load_number} delivered. Great work.`);
      onDelivered();
    } catch (e: any) { setError(e.message); }
    setUploading(false);
    setDelivering(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-10">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 pt-10 pb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-400 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Load #{load.load_number}</h1>
            {load.customer_name && <p className="text-gray-400 text-sm">{load.customer_name}</p>}
          </div>
          <span className="text-xs bg-blue-900/50 text-blue-300 px-3 py-1.5 rounded-full font-medium">In Transit</span>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Route summary */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <div className="w-0.5 flex-1 bg-gray-600 my-1" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup</p>
                <p className="font-semibold text-sm">{load.origin_city}, {load.origin_state}</p>
                {load.origin_address && <p className="text-xs text-gray-500">{load.origin_address}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery</p>
                <p className="font-semibold text-sm">{load.dest_city}, {load.dest_state}</p>
                {load.dest_address && <p className="text-xs text-gray-500">{load.dest_address}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* BOL Number — required */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
            BOL Number <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={bol}
            onChange={e => setBol(e.target.value)}
            placeholder="Enter BOL number"
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-base"
          />
          {!bolFilled && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Required before POD upload is enabled
            </p>
          )}
        </div>

        {/* Fee fields */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Additional Charges</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Extra Stop</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={extraStop}
                  onChange={e => setExtraStop(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-6 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Lumper</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={lumper}
                  onChange={e => setLumper(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-6 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Detention</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={detention}
                  onChange={e => setDetention(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-6 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* POD Upload */}
        <div className={cn('bg-gray-800 rounded-2xl border p-4 space-y-3 transition', bolFilled ? 'border-gray-700' : 'border-gray-700 opacity-50 pointer-events-none')}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              Proof of Delivery {podFiles.length > 0 && <span className="text-green-400">({podFiles.length} photo{podFiles.length > 1 ? 's' : ''})</span>}
            </p>
            {!bolFilled && <span className="text-xs text-amber-400">Enter BOL first</span>}
          </div>

          {/* Existing POD previews */}
          {podFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {podFiles.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt={`POD ${i + 1}`} className="w-full h-24 object-cover rounded-xl" />
                  <button
                    onClick={() => removePod(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-1.5 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl text-xs font-medium text-gray-300 transition"
            >
              <Camera className="w-5 h-5 text-brand-400" />
              Camera
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-1.5 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl text-xs font-medium text-gray-300 transition"
            >
              <Upload className="w-5 h-5 text-purple-400" />
              Gallery
            </button>
            <button
              onClick={() => filesRef.current?.click()}
              className="flex flex-col items-center gap-1.5 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl text-xs font-medium text-gray-300 transition"
            >
              <FileText className="w-5 h-5 text-blue-400" />
              Files
            </button>
          </div>

          {/* Hidden inputs */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={e => addFiles(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" multiple onChange={e => addFiles(e.target.files)} />
          <input ref={filesRef} type="file" accept="image/*,application/pdf" className="hidden" multiple onChange={e => addFiles(e.target.files)} />
        </div>

        {error && <p className="text-sm text-red-400 bg-red-900/30 px-4 py-3 rounded-xl">{error}</p>}

        {/* Deliver button */}
        <button
          onClick={handleDeliver}
          disabled={!canDeliver || delivering}
          className={cn(
            'w-full py-4 rounded-2xl font-bold text-base transition',
            canDeliver && !delivering
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          )}
        >
          {delivering
            ? (uploading ? `Uploading ${podFiles.length} photo${podFiles.length > 1 ? 's' : ''}...` : 'Marking Delivered...')
            : !bolFilled
              ? 'Enter BOL to Continue'
              : podFiles.length === 0
                ? 'Add POD Photo to Continue'
                : '✓ Mark as Delivered'}
        </button>

        {/* Requirements checklist */}
        <div className="space-y-1.5">
          <div className={cn('flex items-center gap-2 text-sm', bolFilled ? 'text-green-400' : 'text-gray-500')}>
            <CheckCircle className={cn('w-4 h-4', bolFilled ? 'text-green-400' : 'text-gray-600')} />
            BOL number entered
          </div>
          <div className={cn('flex items-center gap-2 text-sm', podFiles.length > 0 ? 'text-green-400' : 'text-gray-500')}>
            <CheckCircle className={cn('w-4 h-4', podFiles.length > 0 ? 'text-green-400' : 'text-gray-600')} />
            POD photo attached ({podFiles.length})
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Fuel Log Screen
// ─────────────────────────────────────────────
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function FuelLog({ load }: { load: any | null; onBack?: () => void }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    state: '',
    gallons: '',
    price_per_gallon: '',
    total_amount: '',
    truck_unit: '',
    notes: '',
  });

  const fetchEntries = useCallback(async () => {
    const data = await driverApi('/api/driver/fuel').catch(() => []);
    setEntries(data);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Auto-calc total when gallons + price change
  const updateForm = (field: string, value: string) => {
    const updated = { ...form, [field]: value };
    if ((field === 'gallons' || field === 'price_per_gallon') && updated.gallons && updated.price_per_gallon) {
      const total = parseFloat(updated.gallons) * parseFloat(updated.price_per_gallon);
      if (!isNaN(total)) updated.total_amount = total.toFixed(2);
    }
    setForm(updated);
  };

  const handleSave = async () => {
    if (!form.state || !form.gallons || !form.total_amount) {
      setError('State, gallons, and total amount are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await driverApi('/api/driver/fuel', 'POST', {
        ...form,
        load_id: load?.id || null,
        gallons: parseFloat(form.gallons),
        price_per_gallon: form.price_per_gallon ? parseFloat(form.price_per_gallon) : null,
        total_amount: parseFloat(form.total_amount),
      });
      setForm({ purchase_date: new Date().toISOString().slice(0, 10), state: '', gallons: '', price_per_gallon: '', total_amount: '', truck_unit: '', notes: '' });
      setShowForm(false);
      fetchEntries();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fuel entry?')) return;
    await driverApi(`/api/driver/fuel/${id}`, 'DELETE').catch(() => {});
    fetchEntries();
  };

  const totalGallons = entries.reduce((s, e) => s + parseFloat(e.gallons || 0), 0);
  const totalSpent = entries.reduce((s, e) => s + parseFloat(e.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <div className="bg-gray-800 border-b border-gray-700 px-4 pt-10 pb-4">
        <h1 className="text-xl font-bold">Fuel Log</h1>
        <p className="text-gray-400 text-sm mt-0.5">Track fuel purchases for IFTA reporting</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Total Gallons</p>
              <p className="text-xl font-bold text-brand-400">{totalGallons.toFixed(1)}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Total Spent</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalSpent)}</p>
            </div>
          </div>
        )}

        {/* Add entry button */}
        <button
          onClick={() => setShowForm(s => !s)}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white py-3.5 rounded-xl font-bold transition"
        >
          <Plus className="w-5 h-5" />
          {showForm ? 'Cancel' : 'Log Fuel Purchase'}
        </button>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-300">New Fuel Entry</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={form.purchase_date} onChange={e => updateForm('purchase_date', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">State <span className="text-red-400">*</span></label>
                <select value={form.state} onChange={e => updateForm('state', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500">
                  <option value="">Select</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gallons <span className="text-red-400">*</span></label>
                <input type="number" inputMode="decimal" placeholder="0.0" value={form.gallons} onChange={e => updateForm('gallons', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">$/Gallon</label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={form.price_per_gallon} onChange={e => updateForm('price_per_gallon', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total $ <span className="text-red-400">*</span></label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={form.total_amount} onChange={e => updateForm('total_amount', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Truck Unit #</label>
                <input type="text" placeholder="e.g. Truck 42" value={form.truck_unit} onChange={e => updateForm('truck_unit', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" placeholder="Optional" value={form.notes} onChange={e => updateForm('notes', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500" />
              </div>
            </div>

            {load && <p className="text-xs text-brand-400">📎 Will be linked to Load #{load.load_number}</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Fuel Entry'}
            </button>
          </div>
        )}

        {/* Entries list */}
        {entries.length === 0 && !showForm && (
          <div className="text-center py-12">
            <Fuel className="w-12 h-12 mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">No fuel entries yet</p>
          </div>
        )}
        <div className="space-y-2">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-gray-800 rounded-xl border border-gray-700 p-3 flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{e.gallons} gal</span>
                  <span className="text-xs bg-brand-900/50 text-brand-300 px-2 py-0.5 rounded-full font-medium">{e.state}</span>
                  {e.truck_unit && <span className="text-xs text-gray-500">{e.truck_unit}</span>}
                </div>
                <p className="text-sm font-semibold text-green-400">{formatCurrency(e.total_amount)}</p>
                <p className="text-xs text-gray-500">{e.purchase_date?.slice(0, 10)}{e.price_per_gallon ? ` · $${parseFloat(e.price_per_gallon).toFixed(3)}/gal` : ''}</p>
                {e.notes && <p className="text-xs text-gray-500 italic">{e.notes}</p>}
              </div>
              <button onClick={() => handleDelete(e.id)} className="p-1 text-gray-600 hover:text-red-400 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// Pre-Trip Inspection Screen
// ─────────────────────────────────────────────

const INSPECTION_ITEMS = [
    'Tires & Wheels',
    'Brakes',
    'Lights & Reflectors',
    'Horn',
    'Windshield & Wipers',
    'Mirrors',
    'Fluids (Oil, Coolant, Washer)',
    'Coupling Devices',
    'Emergency Equipment',
    'Cargo Securement',
  ];

type ItemStatus = 'pass' | 'fail' | 'pending';

interface InspectionItemState {
    name: string;
    status: ItemStatus;
    notes: string;
    photo_url: string | null;
    photo_preview: string | null;
}

function PreTripInspection({ driver, onBack }: { driver: any; onBack: () => void }) {
  const ITEMS = [
    'Tires & Wheels', 'Brakes', 'Lights & Reflectors', 'Horn',
    'Windshield & Wipers', 'Mirrors', 'Fluids', 'Coupling Devices',
    'Emergency Equipment', 'Cargo Securement',
  ];

  type ItemStatus = 'pending' | 'pass' | 'fail';
  interface ItemState {
    status: ItemStatus;
    notes: string;
    photo_url: string | null;
    photo_preview: string | null;
  }

  const [items, setItems] = React.useState<Record<string, ItemState>>(() =>
    Object.fromEntries(ITEMS.map(name => [name, { status: 'pending', notes: '', photo_url: null, photo_preview: null }]))
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [alreadyDone, setAlreadyDone] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [notifiedShop, setNotifiedShop] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await driverApi('/api/driver/dvir/today', 'GET');
        if (data?.submitted) setAlreadyDone(true);
      } catch {}
    })();
  }, []);

  const setStatus = (name: string, status: ItemStatus) => {
    setItems(prev => ({ ...prev, [name]: { ...prev[name], status } }));
  };
  const setNotes = (name: string, notes: string) => {
    setItems(prev => ({ ...prev, [name]: { ...prev[name], notes } }));
  };
  const handlePhoto = (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = ev.target?.result as string;
      setItems(prev => ({ ...prev, [name]: { ...prev[name], photo_url: preview, photo_preview: preview } }));
    };
    reader.readAsDataURL(file);
  };

  const allReviewed = Object.values(items).every(i => i.status !== 'pending');
  const failedItems = Object.entries(items).filter(([, v]) => v.status === 'fail');
  const failsMissingPhoto = failedItems.filter(([, v]) => !v.photo_url).length;
  const canSubmit = allReviewed && failsMissingPhoto === 0;
  const reviewed = Object.values(items).filter(i => i.status !== 'pending').length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        driver_name: driver.name,
        truck_unit: driver.truck_unit || '',
        items: Object.entries(items).map(([name, v]) => ({
          name,
          status: v.status,
          notes: v.notes,
          photo_url: v.photo_url,
        })),
      };
      const result = await driverApi('/api/driver/dvir/submit', 'POST', payload);
      setNotifiedShop(result?.shop_notified || false);
      setSubmitted(true);
    } catch (err: any) {
      alert('Submission failed: ' + (err.message || 'Unknown error'));
    }
    setSubmitting(false);
  };

  if (alreadyDone) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Inspection Already Submitted</h2>
        <p className="text-gray-400 text-sm text-center mb-6">You already completed your pre-trip inspection today.</p>
        <button onClick={onBack} className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-xl font-semibold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (submitted) {
    const passCount = Object.values(items).filter(i => i.status === 'pass').length;
    const failCount = Object.values(items).filter(i => i.status === 'fail').length;
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Inspection Submitted!</h2>
        <div className="flex gap-4 mb-4">
          <span className="text-green-400">{passCount} Pass</span>
          <span className="text-red-400">{failCount} Fail</span>
        </div>
        {notifiedShop && <p className="text-yellow-400 text-sm mb-4">Fleet manager has been notified of defects.</p>}
        <button onClick={onBack} className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-xl font-semibold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-800 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-lg">Pre-Trip Inspection</h1>
          <p className="text-xs text-gray-400">{driver.name} &middot; {new Date().toLocaleDateString()}</p>
        </div>
        <div className="ml-auto text-xs text-gray-400">{reviewed}/{ITEMS.length} reviewed</div>
      </div>

      <div className="h-1 bg-gray-800">
        <div
          className="h-1 bg-brand-500 transition-all duration-300"
          style={{ width: String(Math.round((reviewed / ITEMS.length) * 100)) + '%' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ITEMS.map(name => {
          const item = items[name];
          return (
            <div key={name} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(name, 'pass')}
                    className={'px-3 py-1 rounded-lg text-xs font-semibold transition ' + (item.status === 'pass' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600')}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => setStatus(name, 'fail')}
                    className={'px-3 py-1 rounded-lg text-xs font-semibold transition ' + (item.status === 'fail' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600')}
                  >
                    Fail
                  </button>
                </div>
              </div>
              {item.status === 'fail' && (
                <div className="mt-2 space-y-2">
                  <textarea
                    placeholder="Notes (optional)..."
                    value={item.notes}
                    onChange={e => setNotes(name, e.target.value)}
                    className="w-full bg-gray-800 text-sm text-white rounded-lg p-2 resize-none border border-gray-700 focus:outline-none focus:border-brand-500"
                    rows={2}
                  />
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id={'photo-' + name}
                      className="hidden"
                      onChange={e => handlePhoto(name, e)}
                    />
                    <label
                      htmlFor={'photo-' + name}
                      className={'flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer transition ' + (item.photo_url ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600')}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {item.photo_url ? 'Photo captured' : 'Take photo (required)'}
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800 space-y-2">
        {failsMissingPhoto > 0 && (
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {failsMissingPhoto} failed item{failsMissingPhoto !== 1 ? 's' : ''} need{failsMissingPhoto === 1 ? 's' : ''} a photo
          </div>
        )}
        {!allReviewed && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {ITEMS.length - reviewed} item{ITEMS.length - reviewed !== 1 ? 's' : ''} remaining
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition"
        >
          {submitting ? 'Submitting...' : !allReviewed ? ('Review ' + (ITEMS.length - reviewed) + ' remaining') : failsMissingPhoto > 0 ? 'Add photos for failed items' : 'Submit Inspection'}
        </button>
      </div>
    </div>
  );
}
