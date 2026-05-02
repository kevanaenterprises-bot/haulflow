import { useEffect, useState } from 'react';
import { Plus, MapPin, Calendar, DollarSign, User, X, Download, Printer, ChevronDown, Truck, Clock, FileText, TrendingUp, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Load, LoadStatus, Driver, Customer } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import CreateLoadModal from '../components/tms/CreateLoadModal';
import AssignDriverModal from '../components/tms/AssignDriverModal';

const SECTIONS: { status: LoadStatus; label: string; sublabel: string; color: string; border: string; icon: React.ElementType }[] = [
  { status: 'WAITING_DISPATCH',  label: 'Waiting on Dispatch',  sublabel: 'Loads that need a driver assigned',      color: 'text-amber-700',   border: 'border-amber-300',   icon: Clock },
  { status: 'DISPATCHED',        label: 'Dispatched',            sublabel: 'Driver assigned, en route to pickup',    color: 'text-sky-700',     border: 'border-sky-300',     icon: Truck },
  { status: 'IN_TRANSIT',        label: 'In Transit',            sublabel: 'Actively on the road',                  color: 'text-blue-700',    border: 'border-blue-300',    icon: Truck },
  { status: 'WAITING_INVOICING', label: 'Waiting on Invoice',    sublabel: 'Delivered — ready to generate invoice', color: 'text-orange-700',  border: 'border-orange-300',  icon: FileText },
  { status: 'INVOICED',          label: 'Waiting on Payment',    sublabel: 'Invoice sent — awaiting payment',       color: 'text-emerald-700', border: 'border-emerald-300', icon: TrendingUp },
];

export default function LoadsView() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [assignLoad, setAssignLoad] = useState<Load | null>(null);
  const [previewLoad, setPreviewLoad] = useState<Load | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [l, d, c] = await Promise.all([api.get('/api/loads'), api.get('/api/drivers'), api.get('/api/customers')]);
      setLoads(l); setDrivers(d); setCustomers(c);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    const interval = setInterval(() => api.get('/api/loads').then(setLoads).catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  const byStatus = (status: LoadStatus) => loads.filter(l => l.status === status);
  const paidLoads = loads.filter(l => l.status === 'PAID');

  // Stats
  const awaitingDispatch = byStatus('WAITING_DISPATCH').length;
  const inTransit = byStatus('IN_TRANSIT').length;
  const pendingPayment = byStatus('INVOICED').length;
  const invoicedTotal = loads.filter(l => l.status === 'INVOICED').reduce((s, l) => s + (l.rate || 0), 0);

  const toggleCollapse = (status: string) => setCollapsed(p => ({ ...p, [status]: !p[status] }));

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading loads...</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Command Center</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your loads and dispatch</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className={cn('p-2 rounded-lg hover:bg-gray-100 transition text-gray-400', refreshing && 'animate-spin')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Load
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting Dispatch" value={awaitingDispatch} sub="loads to assign" icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard label="In Transit" value={inTransit} sub="active shipments" icon={Truck} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard label="Pending Payment" value={pendingPayment} sub="invoices sent" icon={FileText} iconBg="bg-purple-100" iconColor="text-purple-600" />
        <StatCard label="Pending Payment Total" value={formatCurrency(invoicedTotal)} sub="awaiting payment" icon={TrendingUp} iconBg="bg-green-100" iconColor="text-green-600" />
      </div>

      {/* Pipeline status bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-1 overflow-x-auto text-xs font-medium shadow-sm">
        {SECTIONS.map((s, i) => (
          <div key={s.status} className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => document.getElementById(`section-${s.status}`)?.scrollIntoView({ behavior: 'smooth' })}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition', s.color)}
            >
              {s.label}
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{byStatus(s.status).length}</span>
            </button>
            {i < SECTIONS.length - 1 && <span className="text-gray-300">›</span>}
          </div>
        ))}
        <span className="text-gray-300 flex-shrink-0">›</span>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition text-green-600 flex-shrink-0">
          Paid <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{paidLoads.length}</span>
        </button>
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {SECTIONS.map(section => {
          const sectionLoads = byStatus(section.status);
          const isOpen = !collapsed[section.status];
          const total = sectionLoads.reduce((s, l) => s + (l.rate || 0), 0);
          return (
            <div key={section.status} id={`section-${section.status}`} className={cn('bg-white border rounded-xl overflow-hidden shadow-sm', section.border)}>
              <button
                onClick={() => toggleCollapse(section.status)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', `bg-${section.color.split('-')[1]}-50`)}>
                    <section.icon className={cn('w-4 h-4', section.color)} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{section.label}</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', section.color, 'bg-gray-100')}>{sectionLoads.length}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{section.sublabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {total > 0 && <span className="text-sm font-semibold text-gray-700">{formatCurrency(total)}</span>}
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {sectionLoads.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">No loads in this stage</p>
                  ) : (
                    <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {sectionLoads.map(load => (
                        <LoadCard
                          key={load.id}
                          load={load}
                          onAssign={() => setAssignLoad(load)}
                          onRefresh={() => fetchAll(true)}
                          onPreview={() => setPreviewLoad(load)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Paid section */}
        <PaidSection loads={paidLoads} />
      </div>

      {showCreate && (
        <CreateLoadModal customers={customers} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchAll(true); }} />
      )}
      {assignLoad && (
        <AssignDriverModal load={assignLoad} drivers={drivers} onClose={() => setAssignLoad(null)} onAssigned={() => { setAssignLoad(null); fetchAll(true); }} />
      )}
      {previewLoad && (
        <InvoicePreviewModal load={previewLoad} onClose={() => setPreviewLoad(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor }: { label: string; value: string | number; sub: string; icon: React.ElementType; iconBg: string; iconColor: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

function LoadCard({ load, onAssign, onRefresh, onPreview }: { load: Load; onAssign: () => void; onRefresh: () => void; onPreview: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [editingInvNum, setEditingInvNum] = useState(false);
  const [invNumDraft, setInvNumDraft] = useState('');
  const [savingInvNum, setSavingInvNum] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete load #${load.load_number}?`)) return;
    setDeleting(true);
    try { await api.delete(`/api/loads/${load.id}`); onRefresh(); }
    catch (e: any) { alert(e.message); setDeleting(false); }
  };

  const handleCreateInvoice = async () => {
    setInvoicing(true);
    try { await api.post(`/api/loads/${load.id}/invoice`, {}); onRefresh(); }
    catch (e: any) { alert(e.message); setInvoicing(false); }
  };

  const startEditInvNum = (currentNum: string) => {
    setInvNumDraft(currentNum);
    setEditingInvNum(true);
  };

  const saveInvNum = async () => {
    if (!invNumDraft.trim()) return;
    setSavingInvNum(true);
    try {
      await api.patch(`/api/invoices/by-load/${load.id}/number`, { invoice_number: invNumDraft.trim() });
      onRefresh();
      setEditingInvNum(false);
    } catch (e: any) { alert(e.message); }
    setSavingInvNum(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-bold text-gray-900 text-sm">#{load.load_number}</span>
        </div>
        <button onClick={handleDelete} disabled={deleting} className="text-gray-200 hover:text-red-400 transition p-1 -mr-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 pb-3 space-y-2.5">
        {/* Shipper / Receiver */}
        {load.origin_city && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 mb-0.5">Shipper</p>
            <p className="text-xs text-gray-600 leading-tight">
              {[load.origin_address, load.origin_city, load.origin_state].filter(Boolean).join(', ')}
            </p>
          </div>
        )}
        {load.dest_city && (
          <div>
            <p className="text-xs font-semibold text-brand-600 mb-0.5">Receiver</p>
            <p className="text-xs text-gray-600 leading-tight">
              {[load.dest_address, load.dest_city, load.dest_state].filter(Boolean).join(', ')}
            </p>
          </div>
        )}

        {/* Customer */}
        {load.customer_name && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2Icon />
            <span className="truncate">{load.customer_name}</span>
          </div>
        )}

        {/* Driver */}
        {load.driver_name && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <User className="w-3 h-3" />
            <span>{load.driver_name}</span>
          </div>
        )}

        {/* Dates & Rate */}
        <div className="flex items-center justify-between">
          {load.pickup_date && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              {formatDate(load.pickup_date)}
              {load.delivery_date && <span> – {formatDate(load.delivery_date)}</span>}
            </div>
          )}
          {load.rate && (
            <span className="text-sm font-bold text-emerald-600 ml-auto">{formatCurrency(load.rate)}</span>
          )}
        </div>

        {/* Invoice number — visible on card for WAITING_INVOICING and INVOICED */}
        {(load.status === 'WAITING_INVOICING' || load.status === 'INVOICED') && load.invoice_number && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
            {editingInvNum ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  autoFocus
                  value={invNumDraft}
                  onChange={e => setInvNumDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveInvNum(); if (e.key === 'Escape') setEditingInvNum(false); }}
                  className="flex-1 text-xs border border-brand-300 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <button onClick={saveInvNum} disabled={savingInvNum} className="text-xs text-brand-600 font-semibold hover:text-brand-700">
                  {savingInvNum ? '...' : 'Save'}
                </button>
                <button onClick={() => setEditingInvNum(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <button
                onClick={() => load.status !== 'PAID' && startEditInvNum(load.invoice_number ?? '')}
                className="text-xs font-mono text-brand-600 font-semibold hover:text-brand-700 hover:underline transition"
                title="Click to edit invoice number"
              >
                {load.invoice_number}
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button className="flex-1 text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 rounded-lg font-medium transition">
            View Details
          </button>
          {load.status === 'WAITING_DISPATCH' && (
            <button onClick={onAssign} className="flex-1 text-xs bg-brand-500 hover:bg-brand-600 text-white py-1.5 rounded-lg font-medium transition">
              Assign Driver
            </button>
          )}
          {load.status === 'DISPATCHED' && (
            <button onClick={onAssign} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg font-medium transition">
              Reassign
            </button>
          )}
          {load.status === 'WAITING_INVOICING' && (
            <button onClick={handleCreateInvoice} disabled={invoicing} className="flex-1 text-xs bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg font-medium transition disabled:opacity-50">
              {invoicing ? '...' : 'Create Invoice'}
            </button>
          )}
          {load.status === 'INVOICED' && (
            <button onClick={onPreview} className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg font-medium transition">
              View Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaidSection({ loads }: { loads: Load[] }) {
  const [open, setOpen] = useState(false);
  const total = loads.reduce((s, l) => s + (l.rate || 0), 0);
  return (
    <div className="bg-white border border-green-200 rounded-xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">Paid Loads</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-green-700 bg-gray-100">{loads.length}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">View completed and paid loads</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-sm font-semibold text-green-600">{formatCurrency(total)}</span>}
          <span className="text-sm text-brand-500 font-medium">View All →</span>
        </div>
      </button>
      {open && loads.length > 0 && (
        <div className="border-t border-gray-100 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loads.map(l => (
            <div key={l.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-xs text-gray-500">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-700">#{l.load_number}</span>
                {l.rate && <span className="font-semibold text-green-600">{formatCurrency(l.rate)}</span>}
              </div>
              {l.customer_name && <p className="truncate">{l.customer_name}</p>}
              {(l.origin_city || l.dest_city) && (
                <p className="text-gray-400 mt-0.5">{l.origin_city}, {l.origin_state} → {l.dest_city}, {l.dest_state}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Building2Icon() {
  return <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}

function InvoicePreviewModal({ load, onClose }: { load: Load; onClose: () => void }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/invoices/by-load/${load.id}`)
      .then(setInv).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [load.id]);

  const handleDownload = () => {
    if (!inv) return;
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/invoices/${inv.id}/pdf?token=${localStorage.getItem('hf_token')}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Invoice Preview</h2>
          <div className="flex gap-2">
            <button onClick={handleDownload} className="flex items-center gap-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition">
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
        </div>
        {loading && <div className="p-12 text-center text-gray-400">Loading invoice...</div>}
        {error && <div className="p-6 text-red-600 text-sm">{error}</div>}
        {inv && (
          <div className="p-8 space-y-6 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xl font-bold text-brand-700">{inv.company_name_own}</p>
                {inv.company_phone && <p className="text-gray-500 text-xs mt-1">{inv.company_phone}</p>}
                {inv.company_email_own && <p className="text-gray-500 text-xs">{inv.company_email_own}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">INVOICE</p>
                <p className="text-brand-600 font-semibold mt-1">#{inv.invoice_number}</p>
                <p className="text-gray-400 text-xs mt-1">{inv.created_at ? formatDate(inv.created_at) : ''}</p>
              </div>
            </div>
            <div className="border-t pt-4 grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Bill To</p>
                <p className="font-semibold text-gray-900">{inv.customer_name || '—'}</p>
                {inv.customer_email && <p className="text-gray-500">{inv.customer_email}</p>}
                {inv.customer_address && <p className="text-gray-500">{inv.customer_address}</p>}
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Load Details</p>
                <p className="text-gray-700">Load #: <span className="font-semibold">{inv.load_number}</span></p>
                {inv.bol_number && <p className="text-gray-500">BOL: {inv.bol_number}</p>}
                {inv.pickup_date && <p className="text-gray-500">Pickup: {formatDate(inv.pickup_date)}</p>}
                {inv.delivery_date && <p className="text-gray-500">Delivery: {formatDate(inv.delivery_date)}</p>}
              </div>
            </div>
            {(inv.origin_city || inv.dest_city) && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {inv.origin_city}, {inv.origin_state} → {inv.dest_city}, {inv.dest_state}
              </div>
            )}
            <table className="w-full text-sm border-t">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Description</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inv.load_rate > 0 && <tr><td className="py-2 px-3 text-gray-700">Freight Charge</td><td className="py-2 px-3 text-right font-medium">{formatCurrency(inv.load_rate)}</td></tr>}
                {inv.fuel_surcharge > 0 && <tr><td className="py-2 px-3 text-gray-700">⛽ Fuel Surcharge{inv.miles ? ` (${inv.miles} mi)` : ''}</td><td className="py-2 px-3 text-right font-medium">{formatCurrency(inv.fuel_surcharge)}</td></tr>}
                {inv.extra_stop_fee > 0 && <tr><td className="py-2 px-3 text-gray-700">Extra Stop Fee</td><td className="py-2 px-3 text-right font-medium">{formatCurrency(inv.extra_stop_fee)}</td></tr>}
                {inv.lumper_fee > 0 && <tr><td className="py-2 px-3 text-gray-700">Lumper Fee</td><td className="py-2 px-3 text-right font-medium">{formatCurrency(inv.lumper_fee)}</td></tr>}
              </tbody>
              <tfoot>
                <tr className="bg-brand-600 text-white">
                  <td className="py-3 px-3 font-bold rounded-bl-lg">Total Due</td>
                  <td className="py-3 px-3 text-right font-bold text-lg rounded-br-lg">{formatCurrency(inv.amount)}</td>
                </tr>
              </tfoot>
            </table>
            {inv.payment_terms && <p className="text-xs text-gray-400 text-center">Payment due within {inv.payment_terms} days. Thank you for your business.</p>}
            {inv.pod_url && (
              <div className="border-t pt-4">
                <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Proof of Delivery</p>
                <img src={inv.pod_url} alt="POD" className="rounded-xl max-h-48 object-cover" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
