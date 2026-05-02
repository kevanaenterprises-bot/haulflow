import { useEffect, useState } from 'react';
import { Plus, MapPin, Calendar, DollarSign, User } from 'lucide-react';
import { api } from '../lib/api';
import type { Load, LoadStatus, Driver, Customer } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import CreateLoadModal from '../components/tms/CreateLoadModal';
import AssignDriverModal from '../components/tms/AssignDriverModal';

const COLUMNS: { status: LoadStatus; label: string; color: string; bg: string }[] = [
  { status: 'WAITING_DISPATCH',   label: 'Waiting on Dispatch',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  { status: 'DISPATCHED',         label: 'Dispatched',             color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200' },
  { status: 'IN_TRANSIT',         label: 'In Transit',             color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  { status: 'DELIVERED',          label: 'Delivered',              color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { status: 'WAITING_INVOICING',  label: 'Waiting on Invoicing',   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  { status: 'INVOICED',           label: 'Invoiced',               color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
];

export default function LoadsView() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assignLoad, setAssignLoad] = useState<Load | null>(null);

  const fetchAll = async () => {
    try {
      const [l, d, c] = await Promise.all([api.get('/api/loads'), api.get('/api/drivers'), api.get('/api/customers')]);
      setLoads(l);
      setDrivers(d);
      setCustomers(c);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Poll every 15s for status updates from driver app
  useEffect(() => {
    const interval = setInterval(() => api.get('/api/loads').then(setLoads).catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  const byStatus = (status: LoadStatus) => loads.filter(l => l.status === status);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading loads...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Load Board</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New Load
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex-shrink-0 w-72">
            <div className={cn('border rounded-xl overflow-hidden', col.bg)}>
              <div className={cn('px-4 py-3 flex items-center justify-between border-b', col.bg)}>
                <span className={cn('font-semibold text-sm', col.color)}>{col.label}</span>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', col.color, 'bg-white/60')}>
                  {byStatus(col.status).length}
                </span>
              </div>
              <div className="p-3 space-y-3 min-h-[200px]">
                {byStatus(col.status).map(load => (
                  <LoadCard
                    key={load.id}
                    load={load}
                    onAssign={() => setAssignLoad(load)}
                    onRefresh={fetchAll}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Paid column - collapsed */}
        <div className="flex-shrink-0 w-72">
          <PaidColumn loads={loads.filter(l => l.status === 'PAID')} />
        </div>
      </div>

      {showCreate && (
        <CreateLoadModal
          customers={customers}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchAll(); }}
        />
      )}
      {assignLoad && (
        <AssignDriverModal
          load={assignLoad}
          drivers={drivers}
          onClose={() => setAssignLoad(null)}
          onAssigned={() => { setAssignLoad(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

function LoadCard({ load, onAssign, onRefresh }: { load: Load; onAssign: () => void; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete load ${load.load_number}?`)) return;
    setDeleting(true);
    try { await api.delete(`/api/loads/${load.id}`); onRefresh(); }
    catch (e: any) { alert(e.message); setDeleting(false); }
  };

  const handleCreateInvoice = async () => {
    setInvoicing(true);
    try { await api.post(`/api/loads/${load.id}/invoice`, {}); onRefresh(); }
    catch (e: any) { alert(e.message); setInvoicing(false); }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 space-y-2">
      <div className="flex items-start justify-between">
        <span className="font-bold text-gray-900 text-sm">#{load.load_number}</span>
        <button onClick={handleDelete} disabled={deleting} className="text-gray-300 hover:text-red-400 text-xs transition">✕</button>
      </div>

      {(load.origin_city || load.dest_city) && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}</span>
        </div>
      )}

      {load.customer_name && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Building2Icon />
          <span className="truncate">{load.customer_name}</span>
        </div>
      )}

      {load.driver_name && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <User className="w-3 h-3" />
          <span>{load.driver_name}</span>
        </div>
      )}

      {load.rate && (
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
          <DollarSign className="w-3 h-3" />
          {formatCurrency(load.rate)}
        </div>
      )}

      {load.pickup_date && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          {formatDate(load.pickup_date)}
        </div>
      )}

      {load.status === 'WAITING_DISPATCH' && (
        <button
          onClick={onAssign}
          className="w-full text-xs bg-brand-500 hover:bg-brand-600 text-white py-1.5 rounded-lg font-medium transition"
        >
          Assign Driver
        </button>
      )}
      {load.status === 'DISPATCHED' && (
        <button
          onClick={onAssign}
          className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg font-medium transition"
        >
          Reassign Driver
        </button>
      )}
      {load.status === 'WAITING_INVOICING' && (
        <button
          onClick={handleCreateInvoice}
          disabled={invoicing}
          className="w-full text-xs bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg font-medium transition disabled:opacity-50"
        >
          {invoicing ? 'Creating...' : '📄 Create Invoice'}
        </button>
      )}
    </div>
  );
}

function PaidColumn({ loads }: { loads: Load[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden bg-gray-50 border-gray-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-200"
      >
        <span className="font-semibold text-sm text-gray-600">Paid</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-gray-600 bg-white/60">{loads.length}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {loads.map(l => (
            <div key={l.id} className="bg-white rounded-lg border border-gray-100 p-3 text-xs text-gray-500">
              <span className="font-bold text-gray-700">#{l.load_number}</span>
              {l.customer_name && <span className="ml-2">{l.customer_name}</span>}
              {l.rate && <span className="ml-2 font-semibold text-green-600">{formatCurrency(l.rate)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Building2Icon() {
  return <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
