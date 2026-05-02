import React, { useEffect, useState } from 'react';
import { Plus, User, Phone, Mail, Edit2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Driver } from '../types';
import { cn } from '../lib/utils';

export default function DriversView() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    const d = await api.get('/api/drivers').catch(() => []);
    setDrivers(d);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver?')) return;
    await api.delete(`/api/drivers/${id}`).catch(e => alert(e.message));
    fetch();
  };

  const statusColor: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    on_route: 'bg-blue-100 text-blue-700',
    off_duty: 'bg-gray-100 text-gray-500',
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Drivers</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full"><User className="w-5 h-5 text-gray-500" /></div>
                <div>
                  <div className="font-semibold text-gray-900">{d.name}</div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor[d.status] || statusColor.off_duty)}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(d); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
            {d.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" />{d.phone}</div>}
            {d.email && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><Mail className="w-3.5 h-3.5" />{d.email}</div>}
            {d.license_expiry && <div className="text-xs text-gray-400 mt-2">CDL expires: {d.license_expiry}</div>}
          </div>
        ))}
      </div>

      {showForm && <DriverForm driver={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
    </div>
  );
}

function DriverForm({ driver, onClose, onSaved }: { driver: Driver | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: driver?.name || '', phone: driver?.phone || '', email: driver?.email || '', license_number: driver?.license_number || '', license_expiry: driver?.license_expiry || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (driver) await api.patch(`/api/drivers/${driver.id}`, form);
      else await api.post('/api/drivers', form);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{driver ? 'Edit Driver' : 'Add Driver'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[['name','Name *'],['phone','Phone'],['email','Email'],['license_number','CDL Number'],['license_expiry','CDL Expiry']].map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type={f === 'license_expiry' ? 'date' : 'text'} value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
