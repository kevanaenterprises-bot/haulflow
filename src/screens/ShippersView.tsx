import { useEffect, useState } from 'react';
import { Plus, MapPin, Phone, Mail, Edit2, Trash2, Truck, PackageOpen } from 'lucide-react';
import { api } from '../lib/api';
import type { Shipper } from '../types';
import { cn } from '../lib/utils';

const TYPE_LABELS = { shipper: 'Shipper', receiver: 'Receiver', both: 'Shipper & Receiver' };
const TYPE_COLORS = {
  shipper: 'bg-blue-100 text-blue-700',
  receiver: 'bg-purple-100 text-purple-700',
  both: 'bg-emerald-100 text-emerald-700',
};

export default function ShippersView() {
  const [items, setItems] = useState<Shipper[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Shipper | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'shipper' | 'receiver'>('all');

  const fetch = async () => {
    const d = await api.get('/api/shippers').catch(() => []);
    setItems(d);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    await api.delete(`/api/shippers/${id}`).catch(e => alert(e.message));
    fetch();
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter || i.type === 'both');

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Shippers & Receivers</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'shipper', 'receiver'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition', filter === f ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f === 'all' ? 'All' : f === 'shipper' ? 'Shippers' : 'Receivers'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No records yet. Add your first shipper or receiver.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-full">
                    {s.type === 'receiver' ? <PackageOpen className="w-5 h-5 text-gray-500" /> : <Truck className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[s.type] || TYPE_COLORS.shipper)}>
                      {TYPE_LABELS[s.type] || s.type}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
              {s.contact_name && <div className="text-xs text-gray-500 mb-1">Contact: {s.contact_name}</div>}
              {s.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" />{s.phone}</div>}
              {s.email && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><Mail className="w-3.5 h-3.5" />{s.email}</div>}
              {(s.city || s.state) && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><MapPin className="w-3.5 h-3.5" />{[s.address, s.city, s.state].filter(Boolean).join(', ')}</div>}
              {s.notes && <div className="text-xs text-gray-400 mt-2 italic">{s.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {showForm && <ShipperForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
    </div>
  );
}

function ShipperForm({ item, onClose, onSaved }: { item: Shipper | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: item?.type || 'shipper',
    name: item?.name || '',
    contact_name: item?.contact_name || '',
    phone: item?.phone || '',
    email: item?.email || '',
    address: item?.address || '',
    city: item?.city || '',
    state: item?.state || '',
    zip: item?.zip || '',
    notes: item?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await api.patch(`/api/shippers/${item.id}`, form);
      else await api.post('/api/shippers', form);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{item ? 'Edit' : 'Add'} Shipper / Receiver</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="shipper">Shipper</option>
              <option value="receiver">Receiver</option>
              <option value="both">Both</option>
            </select>
          </div>
          {[['name','Name *'],['contact_name','Contact Name'],['phone','Phone'],['email','Email'],['address','Address'],['city','City'],['state','State'],['zip','ZIP'],['notes','Notes']].map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              {f === 'notes'
                ? <textarea value={(form as any)[f]} onChange={e => set(f, e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                : <input type="text" value={(form as any)[f]} onChange={e => set(f, e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              }
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
