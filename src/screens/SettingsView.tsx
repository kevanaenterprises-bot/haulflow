import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function SettingsView() {
  const [autoInvoicing, setAutoInvoicing] = useState(true);
  const [dvirPhotoGated, setDvirPhotoGated] = useState(false);
  const [maintenanceAlertEmail, setMaintenanceAlertEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dvirSaving, setDvirSaving] = useState(false);
  const [dvirSaved, setDvirSaved] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then(s => {
      setAutoInvoicing(s.auto_invoicing !== false);
      setDvirPhotoGated(s.dvir_photo_gated === true);
      setMaintenanceAlertEmail(s.maintenance_alert_email || '');
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

  const toggleDvir = async () => {
    const newVal = !dvirPhotoGated;
    setDvirPhotoGated(newVal);
    setDvirSaving(true);
    setDvirSaved(false);
    try {
      await api.patch('/api/settings', { dvir_photo_gated: newVal });
      setDvirSaved(true);
      setTimeout(() => setDvirSaved(false), 2000);
    } catch (e: any) {
      alert(e.message);
      setDvirPhotoGated(!newVal);
    }
    setDvirSaving(false);
  };

  const saveAlertEmail = async () => {
    setDvirSaving(true);
    setDvirSaved(false);
    try {
      await api.patch('/api/settings', { maintenance_alert_email: maintenanceAlertEmail });
      setDvirSaved(true);
      setTimeout(() => setDvirSaved(false), 2000);
    } catch (e: any) {
      alert(e.message);
    }
    setDvirSaving(false);
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
                  ? 'When a driver submits proof of delivery, an invoice is created automatically and emailed. The load moves to Waiting on Payment.'
                  : 'When a driver submits proof of delivery, the load moves to Waiting on Invoice. You create the invoice manually from the Load Board.'}
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
                Driver delivers → Invoice created + emailed → Load moves to <strong>Waiting on Payment</strong>
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

        {/* Photo-Gated Inspections */}
        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Photo-Gated Inspections</h2>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900">Mandatory Photo-Gated DVIR</p>
              <p className="text-sm text-gray-500 mt-1">
                Force drivers to capture live, timestamped photos of tires, brakes, and fluids before starting a load. Prevents pencil-whipping.
              </p>
            </div>
            <button
              onClick={toggleDvir}
              disabled={dvirSaving}
              className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                dvirPhotoGated ? 'bg-brand-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  dvirPhotoGated ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shop/Maintenance Alert Email
            </label>
            <p className="text-xs text-gray-500 mb-2">DVIR defect alerts will be sent to this address.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={maintenanceAlertEmail}
                onChange={e => setMaintenanceAlertEmail(e.target.value)}
                placeholder="shop@yourcompany.com"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                onClick={saveAlertEmail}
                disabled={dvirSaving}
                className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
          </div>

          {dvirSaved && <p className="text-xs text-green-600 mt-3">✓ Saved</p>}
        </div>
      </div>
    </div>
  );
}
