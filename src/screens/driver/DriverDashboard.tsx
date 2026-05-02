import { useEffect, useState } from 'react';
import { MapPin, Calendar, Package, LogOut, ChevronRight, CheckCircle, Truck, Upload } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '../../lib/utils';

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

async function driverApi(path: string, method = 'GET', body?: any) {
  const token = localStorage.getItem('hf_driver_token');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

interface Props {
  driver: any;
  onLogout: () => void;
}

export default function DriverDashboard({ driver, onLogout }: Props) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null);

  const fetchLoads = async () => {
    const l = await driverApi('/api/driver/loads').catch(() => []);
    setLoads(l);
    setLoading(false);
  };

  useEffect(() => { fetchLoads(); }, []);

  if (selectedLoad) {
    return (
      <LoadDetail
        load={selectedLoad}
        onBack={() => { setSelectedLoad(null); fetchLoads(); }}
        onUpdated={(updated) => { setSelectedLoad(updated); fetchLoads(); }}
      />
    );
  }

  const activeLoads = loads.filter(l => ['DISPATCHED', 'IN_TRANSIT'].includes(l.status));
  const completedLoads = loads.filter(l => ['DELIVERED', 'INVOICED'].includes(l.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-brand-200 text-sm">Welcome back,</p>
            <h1 className="text-xl font-bold">{driver.name}</h1>
          </div>
          <button onClick={onLogout} className="p-2 bg-brand-700 rounded-xl">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-brand-700/60 rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold">{activeLoads.length}</div>
            <div className="text-xs text-brand-200 mt-0.5">Active</div>
          </div>
          <div className="flex-1 bg-brand-700/60 rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold">{completedLoads.length}</div>
            <div className="text-xs text-brand-200 mt-0.5">Completed</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {loading && <p className="text-center text-gray-400 py-8">Loading loads...</p>}

        {/* Active loads */}
        {activeLoads.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Loads</h2>
            <div className="space-y-3">
              {activeLoads.map(load => (
                <LoadCard key={load.id} load={load} onSelect={() => setSelectedLoad(load)} />
              ))}
            </div>
          </div>
        )}

        {!loading && activeLoads.length === 0 && (
          <div className="text-center py-12">
            <Truck className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">No active loads</p>
            <p className="text-gray-300 text-sm mt-1">Check back when a load is assigned to you</p>
          </div>
        )}

        {/* Completed loads */}
        {completedLoads.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completed</h2>
            <div className="space-y-2">
              {completedLoads.map(load => (
                <LoadCard key={load.id} load={load} onSelect={() => setSelectedLoad(load)} dimmed />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadCard({ load, onSelect, dimmed = false }: { load: any; onSelect: () => void; dimmed?: boolean }) {
  const statusColors: Record<string, string> = {
    DISPATCHED: 'bg-amber-100 text-amber-700',
    IN_TRANSIT: 'bg-blue-100 text-blue-700',
    DELIVERED: 'bg-green-100 text-green-700',
    INVOICED: 'bg-purple-100 text-purple-700',
  };
  const statusLabels: Record<string, string> = {
    DISPATCHED: 'Assigned — Tap to Accept',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    INVOICED: 'Invoiced',
  };

  return (
    <button onClick={onSelect} className={cn('w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition active:scale-95', dimmed && 'opacity-60')}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-bold text-gray-900 text-base">#{load.load_number}</span>
          {load.customer_name && <p className="text-xs text-gray-400 mt-0.5">{load.customer_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', statusColors[load.status] || 'bg-gray-100 text-gray-500')}>
            {statusLabels[load.status] || load.status}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
      {(load.origin_city || load.dest_city) && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">{load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}</span>
        </div>
      )}
      {load.pickup_date && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
          <Calendar className="w-3.5 h-3.5" />
          Pickup: {formatDate(load.pickup_date)}
        </div>
      )}
      {load.rate && (
        <div className="mt-2 text-sm font-semibold text-brand-600">{formatCurrency(load.rate)}</div>
      )}
    </button>
  );
}

function LoadDetail({ load, onBack, onUpdated }: { load: any; onBack: () => void; onUpdated: (l: any) => void }) {
  const [updating, setUpdating] = useState(false);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podPreview, setPodPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPodFile(file);
    setPodPreview(URL.createObjectURL(file));
  };

  const uploadPod = async (): Promise<string | null> => {
    if (!podFile) return null;
    // Convert file to base64 and upload via server (server uses service key for Supabase)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(podFile);
    });
    const data = await driverApi(`/api/driver/loads/${load.id}/pod`, 'POST', {
      image_base64: base64,
      mime_type: podFile.type,
    });
    return data.pod_url || null;
  };

  const handleAccept = async () => {
    setUpdating(true);
    setError('');
    try {
      const updated = await driverApi(`/api/driver/loads/${load.id}/status`, 'PATCH', { status: 'IN_TRANSIT' });
      onUpdated(updated);
    } catch (err: any) { setError(err.message); }
    setUpdating(false);
  };

  const handleDeliver = async () => {
    if (!podFile) { setError('Please take or upload a POD photo first'); return; }
    setUpdating(true);
    setError('');
    try {
      const pod_url = await uploadPod();
      if (!pod_url) { setError('Photo upload failed — please try again'); setUpdating(false); return; }
      const updated = await driverApi(`/api/driver/loads/${load.id}/status`, 'PATCH', { status: 'DELIVERED', pod_url });
      onUpdated(updated);
    } catch (err: any) { setError(err.message); }
    setUpdating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 pt-10 pb-5">
        <button onClick={onBack} className="text-brand-200 text-sm mb-3 flex items-center gap-1">
          ← Back to loads
        </button>
        <h1 className="text-xl font-bold">Load #{load.load_number}</h1>
        {load.customer_name && <p className="text-brand-200 text-sm">{load.customer_name}</p>}
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Route card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Pickup</p>
            <p className="font-semibold text-gray-900">{load.origin_city}, {load.origin_state}</p>
            {load.origin_address && <p className="text-sm text-gray-500">{load.origin_address}</p>}
            {load.pickup_date && <p className="text-sm text-brand-600 mt-1">📅 {formatDate(load.pickup_date)}</p>}
          </div>
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Delivery</p>
            <p className="font-semibold text-gray-900">{load.dest_city}, {load.dest_state}</p>
            {load.dest_address && <p className="text-sm text-gray-500">{load.dest_address}</p>}
            {load.delivery_date && <p className="text-sm text-brand-600 mt-1">📅 {formatDate(load.delivery_date)}</p>}
          </div>
        </div>

        {/* Load details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Load Details</p>
          <div className="space-y-2">
            {load.cargo_description && (
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-sm text-gray-700">{load.cargo_description}</span>
              </div>
            )}
            {load.miles && <div className="text-sm text-gray-600">Miles: <span className="font-medium">{load.miles}</span></div>}
            {load.rate && <div className="text-sm text-gray-600">Rate: <span className="font-semibold text-brand-600">{formatCurrency(load.rate)}</span></div>}
            {load.fuel_surcharge && <div className="text-sm text-gray-600">⛽ Fuel Surcharge: <span className="font-medium">{formatCurrency(load.fuel_surcharge)}</span></div>}
            {load.bol_number && <div className="text-sm text-gray-600">BOL: <span className="font-medium">{load.bol_number}</span></div>}
          </div>
        </div>

        {/* POD upload — only show when In Transit */}
        {load.status === 'IN_TRANSIT' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Proof of Delivery</p>
            <label className="block cursor-pointer">
              {podPreview ? (
                <img src={podPreview} alt="POD" className="w-full rounded-xl object-cover max-h-48" />
              ) : load.pod_url ? (
                <img src={load.pod_url} alt="POD" className="w-full rounded-xl object-cover max-h-48" />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Tap to take or upload photo</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </label>
            {(podPreview || load.pod_url) && (
              <label className="block mt-2 text-center text-xs text-brand-500 underline cursor-pointer">
                Replace photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>
        )}

        {/* Delivered POD view */}
        {load.status === 'DELIVERED' && load.pod_url && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-sm font-medium text-green-700">POD Submitted</p>
            </div>
            <img src={load.pod_url} alt="POD" className="w-full rounded-xl object-cover max-h-48" />
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

        {/* Action buttons */}
        {load.status === 'DISPATCHED' && (
          <button onClick={handleAccept} disabled={updating}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-bold text-base transition disabled:opacity-50 shadow-lg shadow-brand-200">
            {updating ? 'Accepting...' : '✓ Accept Load'}
          </button>
        )}

        {load.status === 'IN_TRANSIT' && (
          <button onClick={handleDeliver} disabled={updating}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-bold text-base transition disabled:opacity-50 shadow-lg shadow-green-200">
            {updating ? 'Uploading & Submitting...' : '📦 Mark as Delivered'}
          </button>
        )}

        {load.status === 'DELIVERED' && (
          <div className="flex items-center justify-center gap-2 py-4 text-green-600 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Load Delivered
          </div>
        )}
      </div>
    </div>
  );
}
