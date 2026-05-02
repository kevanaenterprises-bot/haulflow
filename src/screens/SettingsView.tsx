import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function SettingsView() {
  const [autoInvoicing, setAutoInvoicing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then(s => {
      setAutoInvoicing(s.auto_invoicing !== false);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = async () => {
    const newVal = !autoInvoicing;
    setAutoInvoicing(newVal);
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/api/settings', { auto_invoicing: newVal });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(e.message);
      setAutoInvoicing(!newVal);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Invoicing */}
        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Invoicing</h2>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900">Automatic Invoicing</p>
              <p className="text-sm text-gray-500 mt-1">
                {autoInvoicing
                  ? 'When a driver submits proof of delivery, an invoice is created automatically and the load moves to Invoiced.'
                  : 'When a driver submits proof of delivery, the load moves to Waiting on Invoicing. You create the invoice manually from the Load Board.'}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={saving}
              className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                autoInvoicing ? 'bg-brand-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoInvoicing ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className={`rounded-lg p-3 border ${autoInvoicing ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-semibold ${autoInvoicing ? 'text-brand-700' : 'text-gray-400'}`}>Auto ON</p>
              <p className={`text-xs mt-1 ${autoInvoicing ? 'text-brand-600' : 'text-gray-400'}`}>
                Driver delivers → Invoice created → Load moves to <strong>Invoiced</strong>
              </p>
            </div>
            <div className={`rounded-lg p-3 border ${!autoInvoicing ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`font-semibold ${!autoInvoicing ? 'text-orange-700' : 'text-gray-400'}`}>Auto OFF</p>
              <p className={`text-xs mt-1 ${!autoInvoicing ? 'text-orange-600' : 'text-gray-400'}`}>
                Driver delivers → Load moves to <strong>Waiting on Invoicing</strong> → You create invoice manually
              </p>
            </div>
          </div>

          {saved && <p className="text-xs text-green-600 mt-3">✓ Saved</p>}
        </div>
      </div>
    </div>
  );
}
