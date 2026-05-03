import { useState, useEffect } from 'react';
import { Truck, Plus, Wrench, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Trash2, Edit2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface TruckRecord {
  id: string;
  type: 'truck' | 'trailer';
  unit_number: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  license_plate: string;
  plate_state: string;
  status: 'active' | 'inactive' | 'in_shop';
  notes: string;
  last_service: MaintenanceLog | null;
  service_count: number;
}

interface MaintenanceLog {
  id: string;
  service_type: string;
  service_date: string;
  odometer: number;
  cost: number;
  vendor: string;
  notes: string;
  next_service_date: string;
  next_service_miles: number;
}

const SERVICE_TYPES = [
  'Oil Change', 'DOT Annual Inspection', 'Tire Rotation', 'Tire Replacement',
  'Brake Service', 'Engine Repair', 'Transmission Service', 'Fuel Filter',
  'Air Filter', 'Coolant Flush', 'PM Service', 'Trailer Inspection',
  'License Plate Renewal', 'Registration', 'Other',
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  in_shop: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', inactive: 'Inactive', in_shop: 'In Shop',
};

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TrucksView() {
  const { } = useAuth();
  const [trucks, setTrucks] = useState<TruckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [editTruck, setEditTruck] = useState<TruckRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'truck' | 'trailer'>('all');

  const [truckForm, setTruckForm] = useState({
    type: 'truck', unit_number: '', year: '', make: '', model: '',
    vin: '', license_plate: '', plate_state: '', status: 'active', notes: '',
  });
  const [logForm, setLogForm] = useState({
    service_type: 'Oil Change', service_date: new Date().toISOString().slice(0, 10),
    odometer: '', cost: '', vendor: '', notes: '', next_service_date: '', next_service_miles: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTrucks(); }, []);

  const fetchTrucks = async () => {
    setLoading(true);
    try { setTrucks(await api.get('/api/trucks')); } catch {}
    setLoading(false);
  };

  const fetchLogs = async (truckId: string) => {
    setLogsLoading(true);
    try { setLogs(await api.get(`/api/trucks/${truckId}/maintenance`)); } catch {}
    setLogsLoading(false);
  };

  const selectTruck = (t: TruckRecord) => {
    setSelectedTruck(t);
    fetchLogs(t.id);
    setShowAddLog(false);
  };

  const handleSaveTruck = async () => {
    setSaving(true);
    try {
      if (editTruck) {
        await api.patch(`/api/trucks/${editTruck.id}`, truckForm);
      } else {
        await api.post('/api/trucks', truckForm);
      }
      await fetchTrucks();
      setShowAddTruck(false);
      setEditTruck(null);
      setTruckForm({ type: 'truck', unit_number: '', year: '', make: '', model: '', vin: '', license_plate: '', plate_state: '', status: 'active', notes: '' });
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const handleSaveLog = async () => {
    if (!selectedTruck) return;
    setSaving(true);
    try {
      await api.post(`/api/trucks/${selectedTruck.id}/maintenance`, logForm);
      await fetchLogs(selectedTruck.id);
      await fetchTrucks();
      setShowAddLog(false);
      setLogForm({ service_type: 'Oil Change', service_date: new Date().toISOString().slice(0, 10), odometer: '', cost: '', vendor: '', notes: '', next_service_date: '', next_service_miles: '' });
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const handleDeleteTruck = async (id: string) => {
    if (!confirm('Delete this unit and all its maintenance records?')) return;
    await api.delete(`/api/trucks/${id}`);
    if (selectedTruck?.id === id) setSelectedTruck(null);
    fetchTrucks();
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this maintenance record?')) return;
    await api.delete(`/api/trucks/${selectedTruck!.id}/maintenance/${logId}`);
    fetchLogs(selectedTruck!.id);
    fetchTrucks();
  };

  const openEditTruck = (t: TruckRecord) => {
    setEditTruck(t);
    setTruckForm({
      type: t.type, unit_number: t.unit_number || '', year: String(t.year || ''),
      make: t.make || '', model: t.model || '', vin: t.vin || '',
      license_plate: t.license_plate || '', plate_state: t.plate_state || '',
      status: t.status, notes: t.notes || '',
    });
    setShowAddTruck(true);
  };

  const filtered = trucks.filter(t => filter === 'all' || t.type === filter);
  const trucks_count = trucks.filter(t => t.type === 'truck').length;
  const trailers_count = trucks.filter(t => t.type === 'trailer').length;
  const in_shop = trucks.filter(t => t.status === 'in_shop').length;

  return (
    <div className="flex h-full">
      {/* Left panel — unit list */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        {/* Stats bar */}
        <div className="grid grid-cols-3 divide-x border-b bg-white">
          {[
            { label: 'Trucks', value: trucks_count },
            { label: 'Trailers', value: trailers_count },
            { label: 'In Shop', value: in_shop, warn: in_shop > 0 },
          ].map(s => (
            <div key={s.label} className="py-3 text-center">
              <div className={`text-xl font-bold ${s.warn ? 'text-yellow-600' : 'text-gray-900'}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs + Add button */}
        <div className="flex items-center gap-2 p-3 border-b bg-white">
          <div className="flex rounded-lg overflow-hidden border text-xs font-semibold flex-1">
            {(['all', 'truck', 'trailer'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 capitalize transition ${filter === f ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {f === 'all' ? 'All' : f === 'truck' ? 'Trucks' : 'Trailers'}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditTruck(null); setTruckForm({ type: 'truck', unit_number: '', year: '', make: '', model: '', vin: '', license_plate: '', plate_state: '', status: 'active', notes: '' }); setShowAddTruck(true); }}
            className="bg-brand-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-brand-600">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No units yet</p>
            </div>
          ) : filtered.map(t => {
            const nextDate = t.last_service?.next_service_date;
            const days = nextDate ? daysUntil(nextDate) : null;
            const overdue = days !== null && days < 0;
            const dueSoon = days !== null && days >= 0 && days <= 30;
            return (
              <button key={t.id} onClick={() => selectTruck(t)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-white transition ${selectedTruck?.id === t.id ? 'bg-white border-l-4 border-l-brand-500' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">
                        {t.unit_number || `${t.year} ${t.make}`}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[t.year, t.make, t.model].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-xs text-gray-400">{t.type === 'trailer' ? '🚛 Trailer' : '🚚 Truck'} · {t.service_count} service{t.service_count !== 1 ? 's' : ''}</div>
                  </div>
                  {(overdue || dueSoon) && (
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${overdue ? 'text-red-500' : 'text-yellow-500'}`} />
                  )}
                </div>
                {nextDate && (
                  <div className={`text-xs mt-1 font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {overdue ? `⚠ Service overdue by ${Math.abs(days!)} days` : dueSoon ? `⏰ Service due in ${days} days` : `Next: ${new Date(nextDate).toLocaleDateString()}`}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — detail */}
      {!selectedTruck ? (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <Wrench className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">Select a unit to view maintenance history</p>
            <p className="text-gray-300 text-sm mt-1">Or add a new truck or trailer</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Truck header */}
          <div className="border-b px-6 py-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {selectedTruck.unit_number ? `Unit #${selectedTruck.unit_number}` : `${selectedTruck.year} ${selectedTruck.make} ${selectedTruck.model}`}
              </h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[selectedTruck.status]}`}>
                  {STATUS_LABELS[selectedTruck.status]}
                </span>
                <span className="text-xs text-gray-500">{selectedTruck.type === 'trailer' ? 'Trailer' : 'Truck'}</span>
                {selectedTruck.vin && <span className="text-xs text-gray-400">VIN: {selectedTruck.vin}</span>}
                {selectedTruck.license_plate && <span className="text-xs text-gray-400">Plate: {selectedTruck.license_plate} {selectedTruck.plate_state}</span>}
              </div>
              {selectedTruck.notes && <p className="text-sm text-gray-500 mt-1">{selectedTruck.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEditTruck(selectedTruck)}
                className="p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDeleteTruck(selectedTruck.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setShowAddLog(true)}
                className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-brand-600">
                <Plus className="w-4 h-4" /> Log Service
              </button>
            </div>
          </div>

          {/* Log service form */}
          {showAddLog && (
            <div className="border-b bg-blue-50 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Log New Service</h3>
                <button onClick={() => setShowAddLog(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Service Type *</label>
                    <select value={logForm.service_type} onChange={e => setLogForm(p => ({ ...p, service_type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Service Date *</label>
                    <input type="date" value={logForm.service_date} onChange={e => setLogForm(p => ({ ...p, service_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Odometer (miles)</label>
                    <input type="number" value={logForm.odometer} onChange={e => setLogForm(p => ({ ...p, odometer: e.target.value }))}
                      placeholder="125000" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Vendor / Shop</label>
                  <input value={logForm.vendor} onChange={e => setLogForm(p => ({ ...p, vendor: e.target.value }))}
                    placeholder="TA Truck Service" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Cost ($)</label>
                  <input type="number" value={logForm.cost} onChange={e => setLogForm(p => ({ ...p, cost: e.target.value }))}
                    placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Next Service Date</label>
                  <input type="date" value={logForm.next_service_date} onChange={e => setLogForm(p => ({ ...p, next_service_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Next Service Miles</label>
                  <input type="number" value={logForm.next_service_miles} onChange={e => setLogForm(p => ({ ...p, next_service_miles: e.target.value }))}
                    placeholder="130000" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                  <input value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Replaced front tires, rotated rears..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleSaveLog} disabled={saving}
                  className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-brand-600">
                  {saving ? 'Saving...' : 'Save Service Record'}
                </button>
                <button onClick={() => setShowAddLog(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}

          {/* Maintenance history */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {logsLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">Loading records...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No maintenance records yet</p>
                <p className="text-gray-300 text-sm">Click "Log Service" to add the first entry</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Service History ({logs.length} records)</h3>
                {logs.map(log => {
                  const days = log.next_service_date ? daysUntil(log.next_service_date) : null;
                  const overdue = days !== null && days < 0;
                  const dueSoon = days !== null && days >= 0 && days <= 30;
                  return (
                    <div key={log.id} className="border rounded-xl p-4 bg-white hover:shadow-sm transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{log.service_type}</span>
                            {log.cost && <span className="text-sm text-green-700 font-medium">${parseFloat(String(log.cost)).toFixed(2)}</span>}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {new Date(log.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            {log.odometer && ` · ${Number(log.odometer).toLocaleString()} mi`}
                            {log.vendor && ` · ${log.vendor}`}
                          </div>
                          {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                          {log.next_service_date && (
                            <div className={`text-xs mt-1.5 font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {overdue ? `⚠ Next service was due ${Math.abs(days!)} days ago` : dueSoon ? `⏰ Next service in ${days} days` : `Next: ${new Date(log.next_service_date).toLocaleDateString()}`}
                              {log.next_service_miles ? ` or at ${Number(log.next_service_miles).toLocaleString()} mi` : ''}
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleDeleteLog(log.id)} className="text-gray-300 hover:text-red-400 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Truck Modal */}
      {showAddTruck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">{editTruck ? 'Edit Unit' : 'Add New Unit'}</h2>
              <button onClick={() => { setShowAddTruck(false); setEditTruck(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Type *</label>
                  <select value={truckForm.type} onChange={e => setTruckForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="truck">Truck</option>
                    <option value="trailer">Trailer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Unit Number</label>
                  <input value={truckForm.unit_number} onChange={e => setTruckForm(p => ({ ...p, unit_number: e.target.value }))}
                    placeholder="101" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Year</label>
                  <input type="number" value={truckForm.year} onChange={e => setTruckForm(p => ({ ...p, year: e.target.value }))}
                    placeholder="2020" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Make</label>
                  <input value={truckForm.make} onChange={e => setTruckForm(p => ({ ...p, make: e.target.value }))}
                    placeholder="Kenworth" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Model</label>
                  <input value={truckForm.model} onChange={e => setTruckForm(p => ({ ...p, model: e.target.value }))}
                    placeholder="T680" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
                  <select value={truckForm.status} onChange={e => setTruckForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="active">Active</option>
                    <option value="in_shop">In Shop</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">VIN</label>
                  <input value={truckForm.vin} onChange={e => setTruckForm(p => ({ ...p, vin: e.target.value }))}
                    placeholder="1XKDDB9X8NJ123456" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">License Plate</label>
                  <input value={truckForm.license_plate} onChange={e => setTruckForm(p => ({ ...p, license_plate: e.target.value }))}
                    placeholder="ABC1234" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Plate State</label>
                  <input value={truckForm.plate_state} onChange={e => setTruckForm(p => ({ ...p, plate_state: e.target.value }))}
                    placeholder="TX" maxLength={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                  <input value={truckForm.notes} onChange={e => setTruckForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any notes about this unit..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={handleSaveTruck} disabled={saving}
                className="flex-1 bg-brand-500 text-white py-2.5 rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Saving...' : editTruck ? 'Save Changes' : 'Add Unit'}
              </button>
              <button onClick={() => { setShowAddTruck(false); setEditTruck(null); }}
                className="px-6 py-2.5 text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
