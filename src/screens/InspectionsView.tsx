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
                const data = await api.get(`/api/dvir/inspections?${params}`);
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

  const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
  };

  const defectCount = inspections.filter(i => i.has_defects).length;

  return (
        <div>
          {/* Header */}
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
        
          {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                            <ClipboardList className="w-4 h-4 text-brand-500" />
                                            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{total}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Passed</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">
                                  {inspections.filter(i => !i.has_defects).length}
                                </p>
                      </div>
                      <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Defects</span>
                                </div>
                                <p className="text-2xl font-bold text-red-600">{defectCount}</p>
                      </div>
              </div>
        
          {/* Inspections list */}
          {loading ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                            Loading inspections...
                  </div>
                ) : inspections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                            <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">
                              {defectsOnly ? 'No inspections with defects found' : 'No inspections on record yet'}
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                                        Inspections submitted by drivers will appear here
                            </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspections.map(inspection => (
                                <InspectionRow
                                                key={inspection.id}
                                                inspection={inspection}
                                                expanded={expandedId === inspection.id}
                                                onToggle={() => toggleExpand(inspection.id)}
                                              />
                              ))}
                  </div>
              )}
        
          {/* Pagination */}
          {total > LIMIT && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <button
                                          onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                                          disabled={offset === 0}
                                          className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                                        >
                                        Previous
                            </button>
                            <span className="text-sm text-gray-500">
                              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
                            </span>
                            <button
                                          onClick={() => setOffset(o => o + LIMIT)}
                                          disabled={offset + LIMIT >= total}
                                          className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                                        >
                                        Next
                            </button>
                  </div>
              )}
        </div>
      );
}

// ─── Inspection Row ───────────────────────────────────────────────────────────

function InspectionRow({
    inspection,
    expanded,
    onToggle,
}: {
    inspection: Inspection;
    expanded: boolean;
    onToggle: () => void;
}) {
    const failedItems = inspection.items.filter(i => i.status === 'fail');
    const passedItems = inspection.items.filter(i => i.status === 'pass');
  
    return (
          <div className={cn(
                  'bg-white rounded-xl border shadow-sm overflow-hidden transition',
                  inspection.has_defects ? 'border-red-200' : 'border-gray-200'
                )}>
            {/* Row header — always visible */}
                <button
                          onClick={onToggle}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-left"
                        >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Status badge */}
                                  <div className={cn(
                                      'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                                      inspection.has_defects ? 'bg-red-100' : 'bg-green-100'
                                    )}>
                                    {inspection.has_defects
                                                    ? <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    : <CheckCircle className="w-4 h-4 text-green-600" />
                                    }
                                  </div>
                        
                                  <div className="min-w-0">
                                    {/* Driver + truck */}
                                              <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                                                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                                              {inspection.driver_full_name || inspection.driver_name}
                                                            </span>
                                                {inspection.truck_unit && (
                                          <span className="flex items-center gap-1 text-sm text-gray-500">
                                                            <Truck className="w-3.5 h-3.5 text-gray-400" />
                                            {inspection.truck_unit}
                                          </span>
                                                            )}
                                              </div>
                                    {/* Date */}
                                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                            <Calendar className="w-3 h-3" />
                                                {formatDateTime(inspection.submitted_at)}
                                              </div>
                                  </div>
                        </div>
                
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          {/* Item counts */}
                                  <div className="hidden sm:flex items-center gap-2 text-xs">
                                              <span className="text-green-600 font-medium">{passedItems.length} pass</span>
                                    {failedItems.length > 0 && (
                                        <span className="text-red-600 font-semibold">{failedItems.length} fail</span>
                                              )}
                                  </div>
                          {/* Overall badge */}
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
                </button>
          
            {/* Expanded detail */}
            {expanded && (
                    <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                      {/* Defective items first */}
                      {failedItems.length > 0 && (
                                  <div className="mb-4">
                                                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> Items Requiring Attention
                                                </p>
                                                <div className="space-y-2">
                                                  {failedItems.map((item, idx) => (
                                                      <ItemCard key={idx} item={item} />
                                                    ))}
                                                </div>
                                  </div>
                              )}
                    
                      {/* Passed items */}
                              <div>
                                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                                        Passed Items ({passedItems.length})
                                          </p>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {passedItems.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100 text-sm">
                                                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                        <span className="text-gray-700 truncate">{item.name}
                                      </div>
                                    ))}
                                          </div>
                              </div>
                    </div>
                )}
          </div>
        );
}

// ─── Item Card (for failed items with photo + notes) ─────────────────────────

function ItemCard({ item }: { item: InspectionItem }) {
    const [showPhoto, setShowPhoto] = useState(false);
  
    return (
          <div className="bg-white rounded-xl border border-red-100 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                    {item.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.notes}</p>
                                              )}
                                  </div>
                        </div>
                  {item.photo_url && (
                      <button
                                    onClick={() => setShowPhoto(v => !v)}
                                    className="flex-shrink-0 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                                  >
                                  <Camera className="w-3.5 h-3.5" />
                                  Phot
                      </button>
                        )}
                </div>
            {item.photo_url && showPhoto && (
                    <div className="mt-3">
                              <img
                                            src={item.photo_url}
                                            alt={`${item.name} defect photo`}
                                            className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                                          />
                    </div>
                )}
          </div>
        );
}
