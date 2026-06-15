import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import {
  ClipboardList, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Filter, RefreshCw, Truck, User, Calendar, Camera,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InspectionItem {
  name: string;
  status: 'pass' | 'fail';
  notes?: string;
  photo_url?: string;
}

interface Inspection {
  id: string;
  driver_name: string;
  driver_full_name?: string;
  truck_unit?: string;
  submitted_at: string;
  overall_status: 'pass' | 'fail';
  has_defects: boolean;
  items: InspectionItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ─── ItemCard — shows a single failed item ────────────────────────────────────

function ItemCard({ item }: { item: InspectionItem }) {
  const [showPhoto, setShowPhoto] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-red-100 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">{item.name}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Fail</span>
      </div>
      {item.notes && (
        <p className="text-xs text-gray-500 mt-1 ml-5">{item.notes}</p>
      )}
      {item.photo_url && (
        <div className="mt-2 ml-5">
          <button
            onClick={() => setShowPhoto(v => !v)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 transition"
          >
            <Camera className="w-3 h-3" />
            {showPhoto ? 'Hide photo' : 'View photo'}
          </button>
          {showPhoto && (
            <div className="mt-2">
              <img
                src={item.photo_url}
                alt={'Defect photo for ' + item.name}
                className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── InspectionRow ────────────────────────────────────────────────────────────

function InspectionRow({ inspection }: { inspection: Inspection }) {
  const [expanded, setExpanded] = useState(false);
  const failedItems = inspection.items.filter(i => i.status === 'fail');
  const passedItems = inspection.items.filter(i => i.status === 'pass');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900 text-sm">
                  {inspection.driver_full_name || inspection.driver_name}
                </span>
              </div>
              {inspection.truck_unit && (
                <div className="flex items-center gap-2 mt-0.5">
                  <Truck className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-xs text-gray-500">Unit {inspection.truck_unit}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatDateTime(inspection.submitted_at)}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="text-green-600 font-medium">{passedItems.length} pass</span>
                {failedItems.length > 0 && (
                  <span className="text-red-600 font-semibold">{failedItems.length} fail</span>
                )}
              </div>
            </div>
            <span className={cn(
              'text-xs px-2.5 py-1 rounded-full font-semibold',
              inspection.has_defects
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            )}>
              {inspection.has_defects ? 'DEFECTS' : 'PASS'}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          {failedItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Items Requiring Attention
              </p>
              <div className="space-y-2">
                {failedItems.map((item, idx) => (
                  <ItemCard key={idx} item={item} />
                ))}
              </div>
            </div>
          )}
          {passedItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Passed Items ({passedItems.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {passedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InspectionsView() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [defectsOnly, setDefectsOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 25;

  const fetchInspections = async (defOnly: boolean, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        defects_only: String(defOnly),
        limit: String(LIMIT),
        offset: String(off),
      });
      const data = await api.get('/api/dvir/inspections?' + params);
      setInspections(data.inspections || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      console.error('Failed to fetch inspections:', e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInspections(defectsOnly, offset);
  }, [defectsOnly, offset]);

  const toggleFilter = () => {
    setDefectsOnly(v => !v);
    setOffset(0);
    setExpandedId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pre-Trip Inspections</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} inspection{total !== 1 ? 's' : ''} on record
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFilter}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition',
              defectsOnly
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <Filter className="w-4 h-4" />
            {defectsOnly ? 'Defects Only' : 'All Inspections'}
          </button>
          <button
            onClick={() => fetchInspections(defectsOnly, offset)}
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Loading inspections...
        </div>
      ) : inspections.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <ClipboardList className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 text-sm">No inspections found.</p>
          {defectsOnly && (
            <button onClick={toggleFilter} className="mt-2 text-brand-500 text-sm underline">
              Show all inspections
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map(inspection => (
            <InspectionRow key={inspection.id} inspection={inspection} />
          ))}
          {total > LIMIT && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}
              </span>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(o => o + LIMIT)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
