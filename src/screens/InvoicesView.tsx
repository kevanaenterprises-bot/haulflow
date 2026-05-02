import { useEffect, useState } from 'react';
import { FileText, DollarSign, Send, CheckCircle, Clock, ChevronDown, Search, X, BarChart2, Download } from 'lucide-react';
import { api } from '../lib/api';
import type { Invoice } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [showAging, setShowAging] = useState(false);
  const [aging, setAging] = useState<any>(null);

  const fetch = async () => {
    const inv = await api.get('/api/invoices').catch(() => []);
    setInvoices(inv);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      await api.post(`/api/invoices/${id}/send`, {});
      alert('Invoice sent successfully!');
    } catch (err: any) {
      alert('Failed to send: ' + err.message);
    }
    setSending(null);
  };

  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(id);
    try {
      await api.patch(`/api/invoices/${id}/pay`, {});
      fetch();
    } catch (err: any) {
      alert(err.message);
    }
    setMarkingPaid(null);
  };

  const unpaid = invoices.filter(i => i.status === 'UNPAID');
  const paid = invoices.filter(i => i.status === 'PAID');
  const totalUnpaid = unpaid.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = paid.reduce((sum, i) => sum + (i.amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { api.get('/api/reports/ar-aging').then(a => { setAging(a); setShowAging(true); }); }}
            className="flex items-center gap-2 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-lg transition font-medium"
          >
            <BarChart2 className="w-4 h-4" /> AR Aging
          </button>
          <button
            onClick={() => { api.get('/api/invoices/audit').then(a => { setAudit(a); setShowAudit(true); }); }}
            className="flex items-center gap-2 text-sm border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
          >
            <Search className="w-4 h-4 text-gray-500" /> Invoice Audit
          </button>
        </div>
      </div>
      {showAudit && audit && <AuditModal audit={audit} onClose={() => setShowAudit(false)} />}
      {showAging && aging && <ARAgingModal aging={aging} onClose={() => setShowAging(false)} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Outstanding</span>
          </div>
          <div className="text-2xl font-bold text-amber-800">{formatCurrency(totalUnpaid)}</div>
          <div className="text-xs text-amber-600 mt-1">{unpaid.length} invoice{unpaid.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Collected</span>
          </div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-green-600 mt-1">{paid.length} invoice{paid.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No invoices yet. They are created automatically when a load is delivered.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Load</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <InvoiceBreakdown inv={inv} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">#{(inv as any).load_number || inv.load_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600">{(inv as any).customer_name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.created_at ? formatDate(inv.created_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSend(inv.id)}
                        disabled={sending === inv.id}
                        className="flex items-center gap-1 text-xs bg-brand-500 hover:bg-brand-600 text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        {sending === inv.id ? 'Sending...' : 'Send'}
                      </button>
                      {inv.status === 'UNPAID' && (
                        <button
                          onClick={() => handleMarkPaid(inv.id)}
                          disabled={markingPaid === inv.id}
                          className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          <DollarSign className="w-3 h-3" />
                          {markingPaid === inv.id ? '...' : 'Paid'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditModal({ audit, onClose }: { audit: any; onClose: () => void }) {
  const { invoices, next_number, prefix } = audit;

  // Detect numeric gaps in invoice numbers
  const numbers = invoices
    .map((i: any) => { const m = i.invoice_number.match(/(\d+)$/); return m ? parseInt(m[1]) : null; })
    .filter((n: any) => n !== null) as number[];
  const gaps: number[] = [];
  if (numbers.length > 1) {
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      for (let g = sorted[i - 1] + 1; g < sorted[i]; g++) gaps.push(g);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Invoice Number Audit</h2>
            <p className="text-xs text-gray-400 mt-0.5">Next invoice: <span className="font-semibold text-brand-600">{prefix}-{next_number}</span></p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        {gaps.length > 0 && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-700 mb-1">⚠️ {gaps.length} Gap{gaps.length > 1 ? 's' : ''} Detected</p>
            <p className="text-xs text-red-600">Missing numbers: {gaps.map(g => `${prefix}-${g}`).join(', ')}</p>
          </div>
        )}
        {gaps.length === 0 && invoices.length > 0 && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-medium">
            ✓ No gaps — all invoice numbers are sequential
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="pb-2 font-semibold text-gray-500 text-xs">#</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs">Invoice</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs">Date</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs">Amount</th>
                <th className="pb-2 font-semibold text-gray-500 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv: any, idx: number) => (
                <tr key={inv.invoice_number} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-300 text-xs">{idx + 1}</td>
                  <td className="py-2 font-semibold text-gray-900">{inv.invoice_number}</td>
                  <td className="py-2 text-gray-500">{inv.created_at ? formatDate(inv.created_at) : '—'}</td>
                  <td className="py-2 text-gray-700">{formatCurrency(inv.amount)}</td>
                  <td className="py-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No invoices yet.</p>}
        </div>
      </div>
    </div>
  );
}

function InvoiceBreakdown({ inv }: { inv: any }) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = inv.load_rate || inv.fuel_surcharge || inv.extra_stop_fee || inv.lumper_fee;

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-semibold text-gray-900 hover:text-brand-600 transition">
        {inv.invoice_number}
        {hasBreakdown && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && hasBreakdown && (
        <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs space-y-1 min-w-[200px]">
          {inv.load_rate && <div className="flex justify-between"><span className="text-gray-500">Line Haul</span><span className="font-medium">{formatCurrency(inv.load_rate)}</span></div>}
          {inv.fuel_surcharge && <div className="flex justify-between text-amber-700"><span>⛽ Fuel Surcharge{inv.miles ? ` (${inv.miles} mi)` : ''}</span><span className="font-medium">{formatCurrency(inv.fuel_surcharge)}</span></div>}
          {inv.extra_stop_fee && <div className="flex justify-between"><span className="text-gray-500">Extra Stop</span><span className="font-medium">{formatCurrency(inv.extra_stop_fee)}</span></div>}
          {inv.lumper_fee && <div className="flex justify-between"><span className="text-gray-500">Lumper</span><span className="font-medium">{formatCurrency(inv.lumper_fee)}</span></div>}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{formatCurrency(inv.amount)}</span></div>
        </div>
      )}
    </div>
  );
}

// ── AR Aging Modal ──
const BUCKET_COLORS: Record<string, { bg: string; text: string; bar: string; label: string }> = {
  '0-30':  { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500',  label: 'Current (0–30 days)' },
  '31-60': { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500', label: '31–60 days' },
  '61-90': { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', label: '61–90 days' },
  '90+':   { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500',    label: 'Over 90 days' },
};

function ARAgingModal({ aging, onClose }: { aging: any; onClose: () => void }) {
  const { rows, buckets, grand_total } = aging;
  const [filterBucket, setFilterBucket] = useState<string | null>(null);

  const visibleRows: any[] = filterBucket ? rows.filter((r: any) => r.bucket === filterBucket) : rows;

  const exportCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Load #', 'Invoice Date', 'Days Outstanding', 'Bucket', 'Amount'];
    const lines = [
      headers.join(','),
      ...rows.map((r: any) => [
        r.invoice_number,
        `"${r.customer_name || ''}"`,
        r.load_number,
        new Date(r.created_at).toLocaleDateString(),
        r.days_outstanding,
        r.bucket,
        r.amount,
      ].join(',')),
      `,,,,,,${grand_total.toFixed(2)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-aging-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Accounts Receivable Aging</h2>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} unpaid invoice{rows.length !== 1 ? 's' : ''} · Total outstanding: <span className="font-semibold text-red-600">{formatCurrency(grand_total)}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-lg transition font-medium"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
        </div>

        {/* Bucket summary cards */}
        <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b flex-shrink-0">
          {(['0-30', '31-60', '61-90', '90+'] as const).map(bucket => {
            const c = BUCKET_COLORS[bucket];
            const b = buckets[bucket];
            const pct = grand_total > 0 ? (b.total / grand_total) * 100 : 0;
            return (
              <button
                key={bucket}
                onClick={() => setFilterBucket(filterBucket === bucket ? null : bucket)}
                className={cn(
                  'rounded-xl p-4 text-left border-2 transition',
                  c.bg,
                  filterBucket === bucket ? 'border-current ring-2 ring-offset-1' : 'border-transparent hover:border-gray-200',
                  c.text
                )}
              >
                <div className="text-xs font-medium opacity-75 mb-1">{c.label}</div>
                <div className="text-xl font-bold">{formatCurrency(b.total)}</div>
                <div className="text-xs opacity-60 mt-0.5">{b.count} invoice{b.count !== 1 ? 's' : ''}</div>
                {/* Mini bar */}
                <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', c.bar)} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 px-6 pb-4">
          {visibleRows.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No invoices in this bucket.</p>
          ) : (
            <table className="w-full text-sm mt-4">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Invoice #</th>
                  <th className="text-left pb-2 font-medium">Customer</th>
                  <th className="text-left pb-2 font-medium">Load #</th>
                  <th className="text-left pb-2 font-medium">Invoice Date</th>
                  <th className="text-right pb-2 font-medium">Days Out</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((row: any) => {
                  const c = BUCKET_COLORS[row.bucket];
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{row.invoice_number}</td>
                      <td className="py-2.5 text-gray-700">{row.customer_name || '—'}</td>
                      <td className="py-2.5 text-gray-500">#{row.load_number}</td>
                      <td className="py-2.5 text-gray-500">{new Date(row.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', c.bg, c.text)}>
                          {row.days_outstanding}d
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300">
                  <td colSpan={5} className="pt-3 text-sm font-semibold text-gray-700">
                    {filterBucket ? `${BUCKET_COLORS[filterBucket].label} Total` : 'Grand Total'}
                  </td>
                  <td className="pt-3 text-right font-bold text-gray-900">
                    {formatCurrency(visibleRows.reduce((s: number, r: any) => s + parseFloat(r.amount), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
