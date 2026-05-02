import { useEffect, useState } from 'react';
import { FileText, DollarSign, Send, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import type { Invoice } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

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
      </div>

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
