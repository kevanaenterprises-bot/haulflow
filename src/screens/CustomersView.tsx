import React, { useEffect, useState } from 'react';
import { Plus, Building2, Phone, Mail, MapPin, Edit2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Customer } from '../types';

export default function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    const c = await api.get('/api/customers').catch(() => []);
    setCustomers(c);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    await api.delete(`/api/customers/${id}`).catch(e => alert(e.message));
    fetch();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No customers yet. Add your first customer to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-full"><Building2 className="w-5 h-5 text-blue-500" /></div>
                  <div>
                    <div className="font-semibold text-gray-900">{c.company_name}</div>
                    {c.contact_name && <div className="text-xs text-gray-500">{c.contact_name}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
              {c.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
              {c.email && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><Mail className="w-3.5 h-3.5" />{c.email}</div>}
              {(c.city || c.state) && <div className="flex items-center gap-2 text-sm text-gray-500 mt-1"><MapPin className="w-3.5 h-3.5" />{[c.city, c.state].filter(Boolean).join(', ')}</div>}
            </div>
          ))}
        </div>
      )}

      {showForm && <CustomerForm customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    company_name: customer?.company_name || '',
    contact_name: customer?.contact_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (customer) await api.patch(`/api/customers/${customer.id}`, form);
      else await api.post('/api/customers', form);
      onSaved();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const fields: [string, string][] = [
    ['company_name', 'Company Name *'],
    ['contact_name', 'Contact Name'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['address', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(([f, l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type="text" value={(form as any)[f]} onChange={e => set(f, e.target.value)}
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
