import React, { useEffect, useState } from 'react';
import { Plus, User, Phone, Mail, Edit2, Trash2, Upload, FileText } from 'lucide-react';
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

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 60;
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
            <div className="mt-2 space-y-1">
              {d.license_expiry && (
                <div className={cn('text-xs', isExpiringSoon(d.license_expiry) ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  CDL expires: {d.license_expiry}{isExpiringSoon(d.license_expiry) ? ' ⚠️' : ''}
                </div>
              )}
              {d.medical_card_expiry && (
                <div className={cn('text-xs', isExpiringSoon(d.medical_card_expiry) ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  Medical expires: {d.medical_card_expiry}{isExpiringSoon(d.medical_card_expiry) ? ' ⚠️' : ''}
                </div>
              )}
              {d.hire_date && <div className="text-xs text-gray-400">Hired: {d.hire_date}</div>}
              {d.termination_date && <div className="text-xs text-red-400">Terminated: {d.termination_date}</div>}
            </div>
            <div className="flex gap-2 mt-3">
              {d.cdl_file_url && (
                <a href={d.cdl_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <FileText className="w-3 h-3" /> CDL
                </a>
              )}
              {d.medical_card_file_url && (
                <a href={d.medical_card_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <FileText className="w-3 h-3" /> Medical Card
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && <DriverForm driver={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function uploadFile(file: File, path: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/driver-docs/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, 'x-upsert': 'true' },
    body: file,
  });
  if (!res.ok) throw new Error('File upload failed');
  return `${SUPABASE_URL}/storage/v1/object/public/driver-docs/${path}`;
}

function DriverForm({ driver, onClose, onSaved }: { driver: Driver | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    email: driver?.email || '',
    license_number: driver?.license_number || '',
    license_expiry: driver?.license_expiry || '',
    medical_card_expiry: driver?.medical_card_expiry || '',
    hire_date: driver?.hire_date || '',
    termination_date: driver?.termination_date || '',
    cdl_file_url: driver?.cdl_file_url || '',
    medical_card_file_url: driver?.medical_card_file_url || '',
    portal_password: '',
  });
  const [cdlFile, setCdlFile] = useState<File | null>(null);
  const [medFile, setMedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = { ...form };
      if (!data.portal_password) delete data.portal_password;
      if (cdlFile && SUPABASE_URL) {
        data.cdl_file_url = await uploadFile(cdlFile, `${Date.now()}-${cdlFile.name}`);
      }
      if (medFile && SUPABASE_URL) {
        data.medical_card_file_url = await uploadFile(medFile, `${Date.now()}-${medFile.name}`);
      }
      if (driver) await api.patch(`/api/drivers/${driver.id}`, data);
      else await api.post('/api/drivers', data);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const dateFields: [string, string][] = [
    ['license_expiry', 'CDL Expiry'],
    ['medical_card_expiry', 'Medical Card Expiry'],
    ['hire_date', 'Hire Date'],
    ['termination_date', 'Termination Date'],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{driver ? 'Edit Driver' : 'Add Driver'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[['name','Name *'],['phone','Phone (used to log into driver portal)'],['email','Email'],['license_number','CDL Number']].map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type="text" value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {dateFields.map(([f, l]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="date" value={(form as any)[f]} onChange={e => set(f, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            ))}
          </div>

          {/* Driver portal password */}
          <div className="border-t pt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Portal Password {driver ? '(leave blank to keep current)' : ''}
            </label>
            <input
              type="password"
              value={form.portal_password}
              onChange={e => set('portal_password', e.target.value)}
              placeholder={driver ? '••••••••' : 'Set a password for driver app login'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">Driver logs in at haulflow.vercel.app/driver using their phone number + this password.</p>
          </div>

          {/* File uploads */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Document Uploads</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CDL File (PDF/Image)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm text-gray-500">
                <Upload className="w-4 h-4" />
                {cdlFile ? cdlFile.name : (form.cdl_file_url ? 'Replace CDL file' : 'Upload CDL file')}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setCdlFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Card (PDF/Image)</label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm text-gray-500">
                <Upload className="w-4 h-4" />
                {medFile ? medFile.name : (form.medical_card_file_url ? 'Replace medical card' : 'Upload medical card')}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setMedFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

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
