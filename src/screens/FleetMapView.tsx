import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Truck, RefreshCw, Navigation, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

interface LiveDriver {
  id: string;
  name: string;
  phone?: string;
  status: string;
  last_known_lat?: number;
  last_known_lng?: number;
  last_known_speed?: number;
  last_known_heading?: number;
  last_position_update?: string;
  load_id?: string;
  load_number?: string;
  load_status?: string;
  origin_city?: string;
  origin_state?: string;
  dest_city?: string;
  dest_state?: string;
  miles_driven?: number;
}

function timeAgo(ts?: string) {
  if (!ts) return 'Never';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

function statusColor(ts?: string) {
  if (!ts) return 'bg-gray-400';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 120) return 'bg-green-500';
  if (diff < 600) return 'bg-yellow-500';
  return 'bg-red-400';
}

export default function FleetMapView() {
  useAuth(); // ensure auth context is available
  const token = localStorage.getItem('hf_token') || '';
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

  const fetchFleet = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/fleet/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data: LiveDriver[] = await r.json();
        setDrivers(data);
        return data;
      }
    } catch (e) {
      console.error('[Fleet]', e);
    }
    return [];
  }, [token]);

  // ── Load Mapbox ──
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapError('no_token');
      setLoading(false);
      fetchFleet();
      return;
    }

    // Dynamically load Mapbox GL JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js';
    script.onload = () => setMapReady(true);
    script.onerror = () => setMapError('load_failed');
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, [MAPBOX_TOKEN, fetchFleet]);

  // ── Init map after script loads ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapboxgl = (window as any).mapboxgl;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-96, 38],
      zoom: 4,
    });
    mapInstanceRef.current = map;

    map.on('load', async () => {
      setLoading(false);
      const data = await fetchFleet();
      updateMarkers(data, map, mapboxgl);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // ── Update markers when drivers change ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateMarkers(data: LiveDriver[], map: any, mapboxgl: any) {
    const seen = new Set<string>();
    for (const d of data) {
      if (!d.last_known_lat || !d.last_known_lng) continue;
      seen.add(d.id);

      const el = document.createElement('div');
      el.className = 'flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg cursor-pointer';
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;

      if (d.last_known_heading != null) {
        el.style.transform = `rotate(${d.last_known_heading}deg)`;
      }

      if (markersRef.current.has(d.id)) {
        markersRef.current.get(d.id).setLngLat([d.last_known_lng, d.last_known_lat]);
      } else {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family:sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${d.name}</div>
            ${d.load_number ? `<div style="font-size:12px;color:#555">Load #${d.load_number}</div>` : ''}
            ${d.dest_city ? `<div style="font-size:12px;color:#555">→ ${d.dest_city}, ${d.dest_state}</div>` : ''}
            ${d.last_known_speed != null ? `<div style="font-size:12px;color:#555">${Math.round((d.last_known_speed || 0) * 2.237)} mph</div>` : ''}
            <div style="font-size:11px;color:#999;margin-top:4px">${timeAgo(d.last_position_update)}</div>
          </div>
        `);
        const marker = new mapboxgl.Marker(el)
          .setLngLat([d.last_known_lng, d.last_known_lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.set(d.id, marker);
      }
    }
    // Remove stale markers
    for (const [id, marker] of markersRef.current.entries()) {
      if (!seen.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }
  }

  // ── Poll every 30s ──
  useEffect(() => {
    if (!mapReady || mapError) {
      // No map — just poll for table
      fetchFleet().then(() => setLoading(false));
      intervalRef.current = setInterval(() => fetchFleet(), 30000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }

    intervalRef.current = setInterval(async () => {
      const data = await fetchFleet();
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateMarkers(data, mapInstanceRef.current, (window as any).mapboxgl);
      }
    }, 30000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mapError, fetchFleet]);

  // selectedDriver available for future detail panel use
  // const selectedDriver = drivers.find(d => d.id === selected);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Fleet Map</h1>
          <p className="text-sm text-gray-500">Updates every 30 seconds</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchFleet().then(() => setLoading(false)); }}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* No Mapbox token warning */}
      {mapError === 'no_token' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800">Mapbox token not configured</div>
            <div className="text-sm text-amber-700 mt-1">
              Add <code className="bg-amber-100 px-1 rounded">VITE_MAPBOX_TOKEN=pk.ey...</code> to your <code className="bg-amber-100 px-1 rounded">.env</code> file (Vercel env vars) to enable the live map.
              Drivers are still shown in the table below.
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Driver list */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-700">Active Drivers ({drivers.length})</div>
          </div>
          {drivers.length === 0 && !loading && (
            <div className="p-6 text-center text-gray-400 text-sm">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No active drivers
            </div>
          )}
          {drivers.map(d => (
            <button
              key={d.id}
              onClick={() => {
                setSelected(d.id === selected ? null : d.id);
                if (mapInstanceRef.current && d.last_known_lat && d.last_known_lng) {
                  mapInstanceRef.current.flyTo({ center: [d.last_known_lng, d.last_known_lat], zoom: 10 });
                  markersRef.current.get(d.id)?.togglePopup();
                }
              }}
              className={`w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition ${selected === d.id ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor(d.last_position_update)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{d.name}</div>
                  {d.load_number && (
                    <div className="text-xs text-gray-500 truncate">Load #{d.load_number}</div>
                  )}
                  {d.dest_city && (
                    <div className="text-xs text-blue-600 truncate">→ {d.dest_city}, {d.dest_state}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {d.last_known_speed != null && (
                    <div className="text-xs font-semibold text-gray-700">{Math.round((d.last_known_speed || 0) * 2.237)} mph</div>
                  )}
                  <div className="text-xs text-gray-400 flex items-center gap-0.5 justify-end">
                    <Clock className="w-3 h-3" />
                    {timeAgo(d.last_position_update)}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {selected === d.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  {d.last_known_lat && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {d.last_known_lat.toFixed(4)}, {d.last_known_lng?.toFixed(4)}</div>}
                  {d.last_known_heading != null && <div className="flex items-center gap-1"><Navigation className="w-3 h-3" /> Heading {Math.round(d.last_known_heading)}°</div>}
                  {d.miles_driven != null && d.miles_driven > 0 && <div>Miles driven this load: {d.miles_driven.toFixed(1)}</div>}
                  {d.origin_city && <div>{d.origin_city}, {d.origin_state} → {d.dest_city}, {d.dest_state}</div>}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Map */}
        {!mapError ? (
          <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden relative min-h-[400px]">
            <div ref={mapRef} className="w-full h-full" />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-white text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading map...
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback table when no Mapbox */
          <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-600">Driver</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Load</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Destination</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Speed</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Last Update</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Position</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusColor(d.last_position_update)}`} />
                        <span className="font-medium text-gray-900">{d.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{d.load_number ? `#${d.load_number}` : '—'}</td>
                    <td className="p-4 text-gray-600">{d.dest_city ? `${d.dest_city}, ${d.dest_state}` : '—'}</td>
                    <td className="p-4 text-gray-600">
                      {d.last_known_speed != null ? `${Math.round((d.last_known_speed || 0) * 2.237)} mph` : '—'}
                    </td>
                    <td className="p-4 text-gray-500 text-xs">{timeAgo(d.last_position_update)}</td>
                    <td className="p-4 text-gray-400 text-xs">
                      {d.last_known_lat ? `${d.last_known_lat.toFixed(3)}, ${d.last_known_lng?.toFixed(3)}` : 'No GPS'}
                    </td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No active drivers with GPS data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
