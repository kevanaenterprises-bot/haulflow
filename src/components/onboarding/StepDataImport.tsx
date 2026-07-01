import { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, User, Truck, Plus, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManualDriver {
  name: string;
  phone: string;
  email: string;
  cdl_number: string;
  cdl_state: string;
  cdl_expiry: string;
}

export interface ManualTruck {
  unit_number: string;
  type: 'truck' | 'trailer';
  year: string;
  make: string;
  model: string;
  vin: string;
  license_plate: string;
  plate_state: string;
}

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  manualDrivers?: ManualDriver[];
  onManualDriversChange?: (d: ManualDriver[]) => void;
  manualTrucks?: ManualTruck[];
  onManualTrucksChange?: (t: ManualTruck[]) => void;
}

type Mode = 'choose' | 'manual' | 'csv';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDriver(): ManualDriver {
  return { name: '', phone: '', email: '', cdl_number: '', cdl_state: '', cdl_expiry: '' };
}

function emptyTruck(type: 'truck' | 'trailer' = 'truck'): ManualTruck {
  return { unit_number: '', type, year: '', make: '', model: '', vin: '', license_plate: '', plate_state: '' };
}

function Field({ label, value, onChange, placeholder = '', type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
      />
    </div>
  );
}

// ─── Manual Entry Forms ───────────────────────────────────────────────────────

function DriverForm({ driver, onChange, onRemove, index }: {
  driver: ManualDriver; onChange: (d: ManualDriver) => void; onRemove: () => void; index: number;
}) {
  const set = (k: keyof ManualDriver, v: string) => onChange({ ...driver, [k]: v });
  return (
    <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-brand-400" /> Driver {index + 1}
        </span>
        {index > 0 && (
          <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-400 transition">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full Name" value={driver.name} onChange={v => set('name', v)} placeholder="John Smith" required />
        <Field label="Phone" value={driver.phone} onChange={v => set('phone', v)} placeholder="555-000-0000" type="tel" />
      </div>
      <Field label="Email" value={driver.email} onChange={v => set('email', v)} placeholder="driver@email.com" type="email" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="CDL Number" value={driver.cdl_number} onChange={v => set('cdl_number', v)} placeholder="D1234567" />
        <Field label="CDL State" value={driver.cdl_state} onChange={v => set('cdl_state', v)} placeholder="TX" />
        <Field label="CDL Expiry" value={driver.cdl_expiry} onChange={v => set('cdl_expiry', v)} type="date" />
      </div>
    </div>
  );
}

function TruckForm({ truck, onChange, onRemove, index }: {
  truck: ManualTruck; onChange: (t: ManualTruck) => void; onRemove: () => void; index: number;
}) {
  const set = (k: keyof ManualTruck, v: string) => onChange({ ...truck, [k]: v as any });
  return (
    <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <Truck className="w-4 h-4 text-brand-400" />
          {truck.type === 'trailer' ? `Trailer ${index + 1}` : `Truck ${index + 1}`}
        </span>
        <div className="flex items-center gap-2">
          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
            <button type="button" onClick={() => set('type', 'truck')}
              className={`px-3 py-1 transition ${truck.type === 'truck' ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              Truck
            </button>
            <button type="button" onClick={() => set('type', 'trailer')}
              className={`px-3 py-1 transition ${truck.type === 'trailer' ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              Trailer
            </button>
          </div>
          {index > 0 && (
            <button type="button" onClick={onRemove} className="text-slate-500 hover:text-red-400 transition">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Unit #" value={truck.unit_number} onChange={v => set('unit_number', v)} placeholder="T-101" required />
        <Field label="Year" value={truck.year} onChange={v => set('year', v)} placeholder="2021" />
        <Field label="Make" value={truck.make} onChange={v => set('make', v)} placeholder="Peterbilt" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Model" value={truck.model} onChange={v => set('model', v)} placeholder="389" />
        <Field label="VIN" value={truck.vin} onChange={v => set('vin', v)} placeholder="1XPWD40X1ED215307" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="License Plate" value={truck.license_plate} onChange={v => set('license_plate', v)} placeholder="ABC1234" />
        <Field label="Plate State" value={truck.plate_state} onChange={v => set('plate_state', v)} placeholder="TX" />
      </div>
    </div>
  );
}

// ─── CSV Section ──────────────────────────────────────────────────────────────

const CSV_TEMPLATES = [
  { name: 'Drivers',        filename: 'haulflow_drivers_template.csv',   description: 'Name, CDL, Phone, Email' },
  { name: 'Trucks',         filename: 'haulflow_trucks_template.csv',    description: 'Unit #, VIN, Year, Make, Model' },
  { name: 'Customers',      filename: 'haulflow_customers_template.csv', description: 'Company, Contact, Email, Phone' },
  { name: 'Load History',   filename: 'haulflow_loads_template.csv',     description: 'Load #, Origin, Dest, Rate, Date' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StepDataImport({
  files, onFilesChange,
  manualDrivers = [], onManualDriversChange = () => {},
  manualTrucks  = [], onManualTrucksChange  = () => {},
}: Props) {
  const [mode, setMode] = useState<Mode>(
    manualDrivers.length > 0 || manualTrucks.length > 0 ? 'manual' :
    files.length > 0 ? 'csv' : 'choose'
  );

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialise with one empty entry when entering manual mode
  const enterManual = () => {
    if (manualDrivers.length === 0) onManualDriversChange([emptyDriver()]);
    if (manualTrucks.length === 0)  onManualTrucksChange([emptyTruck('truck')]);
    setMode('manual');
  };

  const updateDriver = (i: number, d: ManualDriver) => {
    const next = [...manualDrivers]; next[i] = d; onManualDriversChange(next);
  };
  const removeDriver = (i: number) => onManualDriversChange(manualDrivers.filter((_, idx) => idx !== i));
  const addDriver    = ()           => onManualDriversChange([...manualDrivers, emptyDriver()]);

  const updateTruck  = (i: number, t: ManualTruck) => {
    const next = [...manualTrucks]; next[i] = t; onManualTrucksChange(next);
  };
  const removeTruck  = (i: number) => onManualTrucksChange(manualTrucks.filter((_, idx) => idx !== i));
  const addTruck     = (type: 'truck' | 'trailer') => onManualTrucksChange([...manualTrucks, emptyTruck(type)]);

  // CSV handlers
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.xlsx'));
    onFilesChange([...files, ...dropped]);
  }, [files, onFilesChange]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFilesChange([...files, ...Array.from(e.target.files)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Choose screen ──────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Add Your Drivers & Equipment</h2>
          <p className="text-sm text-slate-400">
            How would you like to get your data into HaulFlow? You can always add more later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Manual entry */}
          <button
            type="button"
            onClick={enterManual}
            className="flex flex-col items-center gap-3 p-6 bg-brand-500/10 border-2 border-brand-500/40 hover:border-brand-400 hover:bg-brand-500/20 rounded-xl transition group text-center"
          >
            <div className="w-12 h-12 bg-brand-500/20 rounded-full flex items-center justify-center group-hover:bg-brand-500/30 transition">
              <Pencil className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Enter Manually</p>
              <p className="text-slate-400 text-xs mt-1">
                Type in your driver and equipment info directly. Best for owner-ops or small fleets.
              </p>
            </div>
          </button>

          {/* CSV import */}
          <button
            type="button"
            onClick={() => setMode('csv')}
            className="flex flex-col items-center gap-3 p-6 bg-slate-700/30 border-2 border-slate-600/50 hover:border-slate-500 hover:bg-slate-700/50 rounded-xl transition group text-center"
          >
            <div className="w-12 h-12 bg-slate-600/50 rounded-full flex items-center justify-center group-hover:bg-slate-600 transition">
              <FileSpreadsheet className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Import from CSV / Excel</p>
              <p className="text-slate-400 text-xs mt-1">
                Upload a spreadsheet from your existing system. Good for fleets with lots of records.
              </p>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 pt-2">
          Not ready yet?{' '}
          <button type="button" className="text-brand-400 hover:underline" onClick={() => setMode('csv')}>
            Skip this step →
          </button>
        </p>
      </div>
    );
  }

  // ── Manual entry screen ────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Add Your Drivers & Equipment</h2>
            <p className="text-sm text-slate-400">Fill in what you have. Everything here is optional and editable later.</p>
          </div>
          <button type="button" onClick={() => setMode('choose')} className="text-xs text-slate-500 hover:text-slate-300 transition underline">
            ← Change method
          </button>
        </div>

        {/* Drivers */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Drivers</h3>
          {manualDrivers.map((d, i) => (
            <DriverForm key={i} driver={d} index={i} onChange={v => updateDriver(i, v)} onRemove={() => removeDriver(i)} />
          ))}
          <button
            type="button"
            onClick={addDriver}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-600 hover:border-brand-500 rounded-xl text-sm text-slate-400 hover:text-brand-400 transition"
          >
            <Plus className="w-4 h-4" /> Add Another Driver
          </button>
        </div>

        {/* Trucks & Trailers */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trucks & Trailers</h3>
          {manualTrucks.map((t, i) => (
            <TruckForm key={i} truck={t} index={i} onChange={v => updateTruck(i, v)} onRemove={() => removeTruck(i)} />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addTruck('truck')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-600 hover:border-brand-500 rounded-xl text-sm text-slate-400 hover:text-brand-400 transition"
            >
              <Plus className="w-4 h-4" /> Add Truck
            </button>
            <button
              type="button"
              onClick={() => addTruck('trailer')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-600 hover:border-brand-500 rounded-xl text-sm text-slate-400 hover:text-brand-400 transition"
            >
              <Plus className="w-4 h-4" /> Add Trailer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CSV import screen ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Import from CSV / Excel</h2>
          <p className="text-sm text-slate-400">Download a template, fill it in, then upload it here.</p>
        </div>
        <button type="button" onClick={() => setMode('choose')} className="text-xs text-slate-500 hover:text-slate-300 transition underline">
          ← Change method
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CSV_TEMPLATES.map(t => (
          <button key={t.filename} type="button"
            onClick={() => { const a = document.createElement('a'); a.href = `/templates/${t.filename}`; a.download = t.filename; a.click(); }}
            className="flex items-start gap-3 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:bg-slate-700/60 hover:border-brand-500/50 transition group text-left"
          >
            <div className="bg-brand-500/20 p-2 rounded-lg flex-shrink-0 group-hover:bg-brand-500/30 transition">
              <Download className="w-4 h-4 text-brand-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition">{t.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging ? 'border-brand-400 bg-brand-500/10' : 'border-slate-600 hover:border-slate-500 bg-slate-700/20 hover:bg-slate-700/40'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-brand-400' : 'text-slate-500'}`} />
        <p className="text-sm font-medium text-slate-300">{isDragging ? 'Drop files here...' : 'Drag & drop CSV/XLSX files here'}</p>
        <p className="text-xs text-slate-500 mt-1">or click to browse</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uploaded Files ({files.length})</h3>
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="flex items-center justify-between bg-slate-700/30 border border-slate-600/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <button type="button" onClick={e => { e.stopPropagation(); onFilesChange(files.filter((_, i) => i !== idx)); }}
                  className="p-1 rounded hover:bg-slate-600 transition text-slate-400 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 bg-brand-500/10 border border-brand-500/20 rounded-lg px-4 py-3">
        <AlertCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-300/80">Your data will be validated before import. You can review and fix any issues before finalizing.</p>
      </div>
    </div>
  );
}
