import { useState } from 'react';
import { X, User, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { Load, Driver } from '../../types';

interface Props {
  load: Load;
  drivers: Driver[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignDriverModal({ load, drivers, onClose, onAssigned }: Props) {
  const available = [...drivers].sort((a, b) => {
    // Put available drivers first, then on_route, then off_duty
    const order: Record<string, number> = { available: 0, on_route: 1, off_duty: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });
  const [selected, setSelected] = useState<string>(load.driver_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ driver_id: string; name: string; reason: string } | null>(null);

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

  const suggestDriver = async () => {
    setSuggesting(true);
    setSuggestion(null);
    setError('');
    try {
      const result = await api.post('/api/suggest-driver', { load_id: load.id });
      if (result?.suggestion) {
        setSuggestion({ driver_id: result.suggestion.id, name: result.suggestion.name, reason: result.reason });
        setSelected(result.suggestion.id);
      } else {
        setError(result?.reason || 'No suggestion available.');
      }
    } catch (err: any) {
      setError('Could not get AI suggestion. ' + (err.message || ''));
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assign Driver</h2>
            <p className="text-sm text-gray-500">Load #{load.load_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-3">
          <button
            onClick={suggestDriver}
            disabled={suggesting}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {suggesting ? 'Analyzing drivers...' : '✨ AI Suggest Best Driver'}
          </button>
          {suggestion && (
            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
              <span className="font-semibold">Suggested: {suggestion.name}</span>
              <p className="text-purple-600 mt-0.5">{suggestion.reason}</p>
            </div>
          )}
        </div>

        {/* Scrollable driver list - THIS IS THE FIX */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          {available.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No drivers found — add a driver first</p>
          )}
          <div className="space-y-3">
            {available.map(driver => (
              <button
                key={driver.id}
                onClick={() => setSelected(driver.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${selected === driver.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="bg-gray-100 p-2 rounded-full flex-shrink-0">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{driver.name}</div>
                  {driver.phone && <div className="text-sm text-gray-500">{driver.phone}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  driver.status === 'available' ? 'bg-green-100 text-green-700' :
                  driver.status === 'on_route' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {driver.status?.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        </div>

        {/* Fixed footer buttons */}
        <div className="border-t p-6 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleAssign} disabled={!selected || loading} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50">
            {loading ? 'Assigning...' : 'Assign & Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
