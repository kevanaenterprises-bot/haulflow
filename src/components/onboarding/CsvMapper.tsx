/**
 * CsvMapper.tsx
 *
 * Smart column-mapping UI for CSV/XLSX uploads during onboarding.
 *
 * Flow:
 *   1. User uploads a file → papaparse reads headers + first 3 rows
 *   2. Fuzzy-match their columns to our known fields
 *   3. Show a mapping table — auto-matched columns pre-selected, rest as dropdowns
 *   4. User confirms / adjusts → we emit the mapped, clean rows to the parent
 */

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  CheckCircle, AlertCircle, ChevronDown, X, Upload,
  ArrowRight, Eye, EyeOff,
} from 'lucide-react';

// ─── Field Definitions ────────────────────────────────────────────────────────

export type SheetType = 'drivers' | 'trucks' | 'customers' | 'loads';

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  /** All column header synonyms we recognise — lowercase, trimmed */
  synonyms: string[];
}

const DRIVER_FIELDS: FieldDef[] = [
  { key: 'name',             label: 'Full Name',      required: true,
    synonyms: ['name','full name','driver name','driver full name','driver','employee name','first last'] },
  { key: 'phone',            label: 'Phone',
    synonyms: ['phone','phone number','cell','cell phone','mobile','telephone','contact number','ph'] },
  { key: 'email',            label: 'Email',
    synonyms: ['email','e-mail','email address','mail'] },
  { key: 'license_number',   label: 'CDL Number',
    synonyms: ['cdl','cdl number','cdl #','cdl#','license number','license #','licence number','dl number','drivers license'] },
  { key: 'cdl_state',        label: 'CDL State',
    synonyms: ['cdl state','license state','state','dl state','issued state'] },
  { key: 'license_expiry',   label: 'CDL Expiry',
    synonyms: ['cdl expiry','expiry','expiration','exp date','license expiration','cdl expiration','expiration date','expires'] },
  { key: 'hire_date',        label: 'Hire Date',
    synonyms: ['hire date','hired','start date','date hired','employment date'] },
  { key: 'status',           label: 'Status',
    synonyms: ['status','driver status','availability'] },
];

const TRUCK_FIELDS: FieldDef[] = [
  { key: 'unit_number',   label: 'Unit #',      required: true,
    synonyms: ['unit','unit #','unit number','truck number','truck #','asset number','asset #','unit id','equipment number','number'] },
  { key: 'type',          label: 'Type (truck/trailer)',
    synonyms: ['type','vehicle type','equipment type','asset type','truck or trailer'] },
  { key: 'year',          label: 'Year',
    synonyms: ['year','yr','model year','vehicle year'] },
  { key: 'make',          label: 'Make',
    synonyms: ['make','manufacturer','brand','vehicle make','mfg'] },
  { key: 'model',         label: 'Model',
    synonyms: ['model','vehicle model','truck model'] },
  { key: 'vin',           label: 'VIN',
    synonyms: ['vin','vin number','vin #','vehicle id','vehicle identification','serial number'] },
  { key: 'license_plate', label: 'License Plate',
    synonyms: ['plate','license plate','plate number','tag','tag number','license plate number'] },
  { key: 'plate_state',   label: 'Plate State',
    synonyms: ['plate state','state','registration state','tag state'] },
];

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: 'company_name',  label: 'Company Name', required: true,
    synonyms: ['company','company name','customer','customer name','business','business name','account','account name','broker','shipper'] },
  { key: 'contact_name',  label: 'Contact Name',
    synonyms: ['contact','contact name','contact person','representative','rep','person','billing contact'] },
  { key: 'contact_phone', label: 'Phone',
    synonyms: ['phone','phone number','contact phone','telephone','cell','mobile','contact number'] },
  { key: 'email',         label: 'Email',
    synonyms: ['email','e-mail','contact email','email address'] },
  { key: 'address',       label: 'Address',
    synonyms: ['address','street','street address','billing address','mailing address','addr'] },
  { key: 'city',          label: 'City',
    synonyms: ['city','town'] },
  { key: 'state',         label: 'State',
    synonyms: ['state','province','st'] },
  { key: 'zip',           label: 'ZIP',
    synonyms: ['zip','zip code','postal code','postcode'] },
];

const LOAD_FIELDS: FieldDef[] = [
  { key: 'load_number',         label: 'Load #',       required: true,
    synonyms: ['load number','load #','load','load id','order number','order #','trip number','freight number','bill number'] },
  { key: 'origin_city',         label: 'Origin City',
    synonyms: ['origin city','pickup city','from city','origin','pickup','from'] },
  { key: 'origin_state',        label: 'Origin State',
    synonyms: ['origin state','pickup state','from state'] },
  { key: 'destination_city',    label: 'Destination City',
    synonyms: ['destination city','delivery city','to city','destination','delivery','to'] },
  { key: 'destination_state',   label: 'Destination State',
    synonyms: ['destination state','delivery state','to state'] },
  { key: 'pickup_date',         label: 'Pickup Date',
    synonyms: ['pickup date','pick date','ship date','dispatch date','pu date'] },
  { key: 'delivery_date',       label: 'Delivery Date',
    synonyms: ['delivery date','deliver date','due date','del date'] },
  { key: 'rate',                label: 'Rate ($)',
    synonyms: ['rate','pay','revenue','freight charge','amount','total','load pay','charge','price'] },
  { key: 'miles',               label: 'Miles',
    synonyms: ['miles','mileage','distance','total miles'] },
  { key: 'status',              label: 'Status',
    synonyms: ['status','load status','delivery status'] },
  { key: 'commodity',           label: 'Commodity',
    synonyms: ['commodity','cargo','freight type','product','item','description'] },
];

const FIELDS_BY_TYPE: Record<SheetType, FieldDef[]> = {
  drivers:   DRIVER_FIELDS,
  trucks:    TRUCK_FIELDS,
  customers: CUSTOMER_FIELDS,
  loads:     LOAD_FIELDS,
};

const IGNORE_VALUE = '__ignore__';

// ─── Fuzzy Matcher ────────────────────────────────────────────────────────────

/** Normalise a header string for matching */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/** Return the best-matching field key for a given column header, or null */
function autoMatch(header: string, fields: FieldDef[]): string | null {
  const h = normalise(header);
  for (const field of fields) {
    if (field.synonyms.includes(h)) return field.key;
  }
  // Partial match — column contains one of the synonyms as a word
  for (const field of fields) {
    if (field.synonyms.some(s => h.includes(s) || s.includes(h))) return field.key;
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MappedRow {
  [fieldKey: string]: string;
}

interface ParsedSheet {
  headers: string[];
  rows: string[][];   // raw rows (first 200 max)
  preview: string[][]; // first 3 rows for preview
}

interface ColumnMapping {
  csvHeader: string;
  mappedField: string; // field.key or IGNORE_VALUE
  autoMatched: boolean;
}

interface Props {
  sheetType: SheetType;
  onComplete: (rows: MappedRow[], sheetType: SheetType) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CsvMapper({ sheetType, onComplete, onCancel }: Props) {
  const [stage, setStage] = useState<'upload' | 'map' | 'preview'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const fields = FIELDS_BY_TYPE[sheetType];

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const raw = result.data as string[][];
        if (!raw || raw.length < 2) {
          setError('This file appears to be empty or has no data rows.');
          return;
        }

        const headers = raw[0].map(h => h?.toString().trim() ?? '');
        const dataRows = raw.slice(1).map(row =>
          headers.map((_, i) => row[i]?.toString().trim() ?? '')
        );

        const sheet: ParsedSheet = {
          headers,
          rows: dataRows.slice(0, 200),
          preview: dataRows.slice(0, 3),
        };
        setParsed(sheet);

        // Auto-map columns
        const seen = new Set<string>();
        const initialMappings: ColumnMapping[] = headers.map(h => {
          const matched = autoMatch(h, fields);
          // Avoid mapping two columns to the same field
          const fieldKey = matched && !seen.has(matched) ? matched : IGNORE_VALUE;
          if (fieldKey !== IGNORE_VALUE) seen.add(fieldKey);
          return {
            csvHeader: h,
            mappedField: fieldKey,
            autoMatched: fieldKey !== IGNORE_VALUE,
          };
        });
        setMappings(initialMappings);
        setStage('map');
      },
      error: (err) => {
        setError('Could not read this file: ' + err.message);
      },
    });
  }, [fields]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Mapping controls ────────────────────────────────────────────────────────

  const setMapping = (idx: number, fieldKey: string) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, mappedField: fieldKey, autoMatched: false } : m));
  };

  // Count how many required fields are mapped
  const requiredFields = fields.filter(f => f.required);
  const mappedRequiredCount = requiredFields.filter(rf =>
    mappings.some(m => m.mappedField === rf.key)
  ).length;
  const canConfirm = mappedRequiredCount === requiredFields.length;

  // Build mapped rows from confirmed mappings
  const buildMappedRows = (): MappedRow[] => {
    if (!parsed) return [];
    return parsed.rows.map(row => {
      const obj: MappedRow = {};
      mappings.forEach((m, i) => {
        if (m.mappedField !== IGNORE_VALUE) {
          obj[m.mappedField] = row[i] ?? '';
        }
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v.trim() !== ''));
  };

  const handleConfirm = () => {
    const rows = buildMappedRows();
    onComplete(rows, sheetType);
  };

  // ── Field label lookup ──────────────────────────────────────────────────────
  const fieldLabel = (key: string) => fields.find(f => f.key === key)?.label ?? key;

  // ── Render: Upload ──────────────────────────────────────────────────────────
  if (stage === 'upload') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Upload Your File</h3>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
          onDrop={handleDrop}
          onClick={() => document.getElementById('csv-file-input')?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-400 bg-brand-500/10'
              : 'border-slate-600 hover:border-slate-500 bg-slate-700/20 hover:bg-slate-700/40'
          }`}
        >
          <input id="csv-file-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="hidden" />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-brand-400' : 'text-slate-500'}`} />
          <p className="text-sm font-medium text-slate-300">
            {isDragging ? 'Drop it here...' : 'Drag & drop your CSV or Excel file'}
          </p>
          <p className="text-xs text-slate-500 mt-1">or click to browse — .csv, .xlsx, .xls</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center">
          Column names don't need to match exactly — we'll figure out the mapping.
        </p>
      </div>
    );
  }

  // ── Render: Map ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">Map Your Columns</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="text-emerald-400 font-medium">{fileName}</span>
            {' '}— {parsed!.rows.length} rows found.
            We've auto-matched what we could. Fix anything that's off.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition flex-shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Required fields status */}
      {requiredFields.length > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          canConfirm
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
        }`}>
          {canConfirm
            ? <><CheckCircle className="w-3.5 h-3.5" /> All required fields mapped — ready to import</>
            : <><AlertCircle className="w-3.5 h-3.5" /> Required: {requiredFields.filter(rf => !mappings.some(m => m.mappedField === rf.key)).map(f => f.label).join(', ')}</>
          }
        </div>
      )}

      {/* Mapping table */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_24px_1fr] gap-2 px-2 pb-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Column</span>
          <span />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">HaulFlow Field</span>
        </div>

        {mappings.map((m, idx) => {
          const isIgnored  = m.mappedField === IGNORE_VALUE;
          const isMatched  = !isIgnored && m.autoMatched;
          const isManual   = !isIgnored && !m.autoMatched;
          const isRequired = !isIgnored && fields.find(f => f.key === m.mappedField)?.required;

          return (
            <div key={idx} className={`grid grid-cols-[1fr_24px_1fr] gap-2 items-center px-2 py-1.5 rounded-lg transition ${
              isIgnored ? 'opacity-50' : isMatched ? 'bg-emerald-500/5' : 'bg-slate-700/20'
            }`}>
              {/* Their column name */}
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate font-medium">{m.csvHeader || '(blank)'}</p>
                {parsed!.preview[0]?.[idx] && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    e.g. "{parsed!.preview[0][idx]}"
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isIgnored ? 'text-slate-700' : 'text-slate-500'}`} />

              {/* Our field dropdown */}
              <div className="relative">
                <select
                  value={m.mappedField}
                  onChange={e => setMapping(idx, e.target.value)}
                  className={`w-full appearance-none text-sm rounded-lg px-3 py-1.5 pr-7 border transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isIgnored
                      ? 'bg-slate-800 border-slate-700 text-slate-500'
                      : isMatched
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-700 border-slate-600 text-white'
                  }`}
                >
                  <option value={IGNORE_VALUE}>— Ignore this column —</option>
                  {fields.map(f => (
                    <option key={f.key} value={f.key}>
                      {f.label}{f.required ? ' *' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                {/* Badges */}
                {isMatched && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1 rounded-full leading-4">
                    AUTO
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview toggle */}
      {parsed!.preview.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide' : 'Show'} data preview (first 3 rows)
          </button>

          {showPreview && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-slate-800">
                    {mappings.map((m, i) => (
                      <th key={i} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                        m.mappedField === IGNORE_VALUE ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        {m.mappedField === IGNORE_VALUE ? '—' : fieldLabel(m.mappedField)}
                        <span className="block text-slate-600 font-normal">{m.csvHeader}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed!.preview.map((row, ri) => (
                    <tr key={ri} className="border-t border-slate-700/50">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-3 py-2 whitespace-nowrap ${
                          mappings[ci]?.mappedField === IGNORE_VALUE ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                          {cell || <span className="text-slate-700 italic">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white text-sm rounded-xl transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="flex-2 flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Import {parsed!.rows.length} Rows
        </button>
      </div>
    </div>
  );
}
