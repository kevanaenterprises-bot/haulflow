import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Search, X, Download, Printer, FileText, MapPin, DollarSign, Calendar,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Invoice } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';

const METHOD_LABEL: Record<string, string> = {
  ach: 'ACH', cash: 'Cash', check: 'Check', wire: 'Wire',
};

const METHOD_BADGE: Record<string, string> = {
  ach:   'bg-blue-100 text-blue-700',
  cash:  'bg-emerald-100 text-emerald-700',
  check: 'bg-purple-100 text-purple-700',
  wire:  'bg-sky-100 text-sky-700',
};

export default function PaidInvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const fetchAll = async () => {
    try {
      const inv = await api.get('/api/invoices');
      setInvoices(inv);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const paid = useMemo(() => {
    return invoices
      .filter(i => i.status === 'PAID')
      .sort((a, b) => {
        const at = new Date(a.paid_at || a.created_at || 0).getTime();
        const bt = new Date(b.paid_at || b.created_at || 0).getTime();
        return bt - at;
      });
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paid.filter(i => {
      if (methodFilter !== 'all' && (i.payment_method || '').toLowerCase() !== methodFilter) return false;
      if (!q) return true;
      const fields = [
        i.invoice_number,
        (i as any).load_number,
        (i as any).customer_name,
        i.check_number,
      ].filter(Boolean).map(s => String(s).toLowerCase());
      return fields.some(f => f.includes(q));
    });
  }, [paid, search, methodFilter]);

  const totalCollected = paid.reduce((s, i) => s + (parseFloat(String(i.amount_paid ?? i.amount)) || 0), 0);

  // This-month total
  const thisMonth = (() => {
    const now = new Date();
    return paid.filter(i => {
      if (!i.paid_at) return false;
      const d = new Date(i.paid_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  })();
  const thisMonthTotal = thisMonth.reduce((s, i) => s + (parseFloat(String(i.amount_paid ?? i.amount)) || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading paid invoices...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paid Invoices</h1>
          <p className="text-sm text-gray-400 mt-0.5">All collected invoices with reprint access</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total Collected" value={formatCurrency(totalCollected)} sub={`${paid.length} invoice${paid.length === 1 ? '' : 's'}`} icon={CheckCircle} color="green" />
        <SummaryCard label="Collected This Month" value={formatCurrency(thisMonthTotal)} sub={`${thisMonth.length} invoice${thisMonth.length === 1 ? '' : 's'}`} icon={Calendar} color="blue" />
        <SummaryCard label="Avg. Per Invoice" value={paid.length ? formatCurrency(totalCollected / paid.length) : '—'} sub="across all paid" icon={DollarSign} color="purple" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice #, load #, customer, or check #"
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
          />
        </div>
        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="all">All payment methods</option>
          <option value="ach">ACH</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="wire">Wire</option>
        </select>
      </div>

      {/* Empty state */}
      {paid.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No paid invoices yet. Once you mark an invoice paid, it'll show up here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-sm">No invoices match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Load</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Method</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Check / Ref</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount Paid</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Date Paid</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inv => {
                  const method = (inv.payment_method || '').toLowerCase();
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <button onClick={() => setViewing(inv)} className="hover:text-brand-600 hover:underline transition">
                          {inv.invoice_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600">#{(inv as any).load_number || inv.load_id?.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-600">{(inv as any).customer_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', METHOD_BADGE[method] || 'bg-gray-100 text-gray-600')}>
                          {METHOD_LABEL[method] || (inv.payment_method || '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {method === 'check' && inv.check_number ? (
                          <div>
                            <div>#{inv.check_number}</div>
                            {inv.check_date && <div className="text-gray-400">{formatDate(inv.check_date)}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        {formatCurrency(inv.amount_paid ?? inv.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{inv.paid_at ? formatDate(inv.paid_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewing(inv)}
                            className="flex items-center gap-1 text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded-lg transition"
                          >
                            <FileText className="w-3 h-3" /> View
                          </button>
                          <button
                            onClick={() => reprintInvoice(inv.id)}
                            className="flex items-center gap-1 text-xs bg-brand-500 hover:bg-brand-600 text-white px-2.5 py-1.5 rounded-lg transition"
                          >
                            <Printer className="w-3 h-3" /> Reprint
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && <PaidInvoiceModal invoice={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function reprintInvoice(invoiceId: string) {
  const apiUrl = (import.meta as any).env.VITE_API_URL || '';
  const token = localStorage.getItem('hf_token') || '';
  window.open(`${apiUrl}/api/invoices/${invoiceId}/pdf?token=${encodeURIComponent(token)}`, '_blank');
}

function SummaryCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: React.ElementType; color: 'green' | 'blue' | 'purple';
}) {
  const colors = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  iconBg: 'bg-green-100',  iconColor: 'text-green-600'  },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-600'   },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  }[color];
  return (
    <div className={cn('rounded-xl p-4 border', colors.bg, colors.border)}>
      <div className="flex items-center gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', colors.iconBg)}>
          <Icon className={cn('w-4 h-4', colors.iconColor)} />
        </div>
        <div>
          <p className={cn('text-xs font-medium', colors.text)}>{label}</p>
          <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function PaidInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/invoices/by-load/${invoice.load_id}`)
      .then(setInv)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [invoice.load_id]);

  const podUrls: string[] = (() => {
    if (!inv) return [];
    try {
      const arr = inv.pod_urls;
      if (Array.isArray(arr) && arr.length) return arr;
      if (typeof arr === 'string') return JSON.parse(arr);
    } catch {}
    if (inv.pod_url) return [inv.pod_url];
    return [];
  })();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900">Invoice {invoice.invoice_number}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Paid {invoice.paid_at ? formatDate(invoice.paid_at) : ''}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => reprintInvoice(invoice.id)}
              className="flex items-center gap-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
        </div>

        {/* Body */}
        {loading && <div className="p-12 text-center text-gray-400">Loading invoice…</div>}
        {error && <div className="p-6 text-red-600 text-sm">{error}</div>}
        {inv && (
          <div className="p-6 space-y-6 text-sm">
            {/* Payment receipt panel */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-800">Payment Received</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Method</p>
                  <p className="font-semibold text-gray-900">{METHOD_LABEL[(invoice.payment_method || '').toLowerCase()] || invoice.payment_method || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Amount Paid</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(invoice.amount_paid ?? invoice.amount)}</p>
                </div>
                {invoice.payment_method?.toLowerCase() === 'check' && invoice.check_number && (
                  <div>
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Check #</p>
                    <p className="font-mono font-semibold text-gray-900">{invoice.check_number}</p>
                  </div>
                )}
                {invoice.payment_method?.toLowerCase() === 'check' && invoice.check_date && (
                  <div>
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Check Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(invoice.check_date)}</p>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="col-span-2">
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Recorded</p>
                    <p className="text-gray-700">{new Date(invoice.paid_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice summary */}
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
                {inv.detention_fee > 0 && <tr><td className="py-2 px-3 text-gray-700">Detention Fee</td><td className="py-2 px-3 text-right font-medium">{formatCurrency(inv.detention_fee)}</td></tr>}
              </tbody>
              <tfoot>
                <tr className="bg-brand-600 text-white">
                  <td className="py-3 px-3 font-bold rounded-bl-lg">Total</td>
                  <td className="py-3 px-3 text-right font-bold text-lg rounded-br-lg">{formatCurrency(inv.amount)}</td>
                </tr>
              </tfoot>
            </table>

            {/* POD images */}
            {podUrls.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs uppercase text-gray-400 font-semibold mb-2">Proof of Delivery ({podUrls.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {podUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-brand-400 transition block bg-gray-100">
                      <img src={url} alt={`POD ${i+1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
