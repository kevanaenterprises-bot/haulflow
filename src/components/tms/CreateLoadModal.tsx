import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Customer } from '../../types';

interface Props {
  customers: Customer[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateLoadModal({ customers, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    load_number: '', customer_id: '', origin_address: '', origin_city: '', origin_state: '',
    dest_address: '', dest_city: '', dest_state: '', pickup_date: '', delivery_date: '',
    rate: '', cargo_description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/loads', { ...form, rate: form.rate ? parseFloat(form.rate) : null });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">New Load</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Load Number *" value={form.load_number} onChange={v => set('load_number', v)} placeholder="e.g. 375-90001" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)} className="input">
                <option value="">— Select customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Pickup</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3"><Field label="Address" value={form.origin_address} onChange={v => set('origin_address', v)} /></div>
              <Field label="City *" value={form.origin_city} onChange={v => set('origin_city', v)} />
              <Field label="State *" value={form.origin_state} onChange={v => set('origin_state', v)} placeholder="TX" />
              <Field label="Pickup Date" type="date" value={form.pickup_date} onChange={v => set('pickup_date', v)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Delivery</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3"><Field label="Address" value={form.dest_address} onChange={v => set('dest_address', v)} /></div>
              <Field label="City *" value={form.dest_city} onChange={v => set('dest_city', v)} />
              <Field label="State *" value={form.dest_state} onChange={v => set('dest_state', v)} placeholder="TX" />
              <Field label="Delivery Date" type="date" value={form.delivery_date} onChange={v => set('delivery_date', v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <Field label="Rate ($)" type="number" value={form.rate} onChange={v => set('rate', v)} placeholder="0.00" />
            <Field label="Cargo Description" value={form.cargo_description} onChange={v => set('cargo_description', v)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Load'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}
