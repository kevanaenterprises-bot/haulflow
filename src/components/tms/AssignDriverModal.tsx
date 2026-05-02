import { useState } from 'react';
import { X, User } from 'lucide-react';
import { api } from '../../lib/api';
import type { Load, Driver } from '../../types';

interface Props {
  load: Load;
  drivers: Driver[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignDriverModal({ load, drivers, onClose, onAssigned }: Props) {
  const available = drivers.filter(d => d.status === 'available' || d.id === load.driver_id);
  const [selected, setSelected] = useState<string>(load.driver_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAssign = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/api/loads/${load.id}/assign`, { driver_id: selected });
      onAssigned();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assign Driver</h2>
            <p className="text-sm text-gray-500">Load #{load.load_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-3">
          {available.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No available drivers</p>
          )}
          {available.map(driver => (
            <button
              key={driver.id}
              onClick={() => setSelected(driver.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${selected === driver.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="bg-gray-100 p-2 rounded-full">
                <User className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{driver.name}</div>
                {driver.phone && <div className="text-sm text-gray-500">{driver.phone}</div>}
              </div>
            </button>
          ))}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleAssign} disabled={!selected || loading} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50">
              {loading ? 'Assigning...' : 'Assign & Dispatch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
