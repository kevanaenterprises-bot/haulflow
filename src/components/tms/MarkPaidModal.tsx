import { useEffect, useState } from 'react';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import type { Load, PaymentMethod } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface Props {
  load: Load;
  onClose: () => void;
  onPaid: () => void;
}

const METHODS: { id: PaymentMethod; label: string; sub: string }[] = [
  { id: 'ach',   label: 'ACH',   sub: 'Bank transfer' },
  { id: 'cash',  label: 'Cash',  sub: 'Paid in cash' },
  { id: 'check', label: 'Check', sub: 'Check number required' },
  { id: 'wire',  label: 'Wire',  sub: 'Wire transfer' },
];

const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function MarkPaidModal({ load, onClose, onPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('ach');
  const [amount, setAmount] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkDate, setCheckDate] = useState(todayStr());
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<number | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch the invoice for this load so we have the invoice ID and the expected amount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inv = await api.get(`/api/invoices/by-load/${load.id}`);
        if (cancelled) return;
        setInvoiceId(inv.id);
        const amt = parseFloat(String(inv.amount));
        if (!isNaN(amt)) {
          setInvoiceAmount(amt);
          setAmount(amt.toFixed(2));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load invoice');
      } finally {
        if (!cancelled) setLoadingInv(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load.id]);

  const isCheck = method === 'check';

  const canSubmit = (() => {
    if (!invoiceId || submitting) return false;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) return false;
    if (isCheck && !checkNumber.trim()) return false;
    if (isCheck && !checkDate) return false;
    return true;
  })();

  const handleSubmit = async () => {
    if (!canSubmit || !invoiceId) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/api/invoices/${invoiceId}/pay`, {
        payment_method: method,
        amount_paid: parseFloat(amount),
        check_number: isCheck ? checkNumber.trim() : undefined,
        check_date:   isCheck ? checkDate          : undefined,
      });
      onPaid();
    } catch (err: any) {
      setError(err.message || 'Failed to mark paid');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Mark Invoice Paid</h2>
              <p className="text-sm text-gray-500">Load #{load.load_number}{load.invoice_number ? ` · Invoice ${load.invoice_number}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {loadingInv ? (
            <p className="text-center text-sm text-gray-400 py-4">Loading invoice…</p>
          ) : (
            <>
              {/* Payment method */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 transition text-left ${
                        method === m.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-semibold text-sm text-gray-900">{m.label}</span>
                      <span className="text-xs text-gray-500">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Amount Paid <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  />
                </div>
                {invoiceAmount !== null && parseFloat(amount || '0') !== invoiceAmount && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Differs from invoice total of {formatCurrency(invoiceAmount)}
                  </p>
                )}
              </div>

              {/* Check-only fields */}
              {isCheck && (
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                      Check Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={checkNumber}
                      onChange={e => setCheckNumber(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                      Date Paid <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={checkDate}
                      onChange={e => setCheckDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : 'Mark Paid'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
