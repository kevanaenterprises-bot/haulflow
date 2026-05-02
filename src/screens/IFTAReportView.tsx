import { useState, useEffect } from 'react';
import { BarChart2, Download, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

interface IFTARow {
  state: string;
  miles: number;
  gallons: number;
  fuel_amount: number;
}

interface IFTAData {
  quarter: string;
  quarters: string[];
  rows: IFTARow[];
  summary: {
    total_miles: number;
    total_gallons: number;
    mpg: string | null;
  };
}

const STATE_LABELS: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
  HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri',
  MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
  NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
};

function fmt(n: number, decimals = 1) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function IFTAReportView() {
  useAuth(); // ensure auth context is available
  const token = localStorage.getItem('hf_token') || '';
  const [data, setData] = useState<IFTAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState('');

  const fetchReport = async (quarter?: string) => {
    setLoading(true);
    try {
      const qs = quarter ? `?quarter=${encodeURIComponent(quarter)}` : '';
      const r = await fetch(`${API}/api/reports/ifta${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d: IFTAData = await r.json();
        setData(d);
        if (!selectedQ && d.quarter) setSelectedQ(d.quarter);
      }
    } catch (e) {
      console.error('[IFTA]', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['IFTA Report', data.quarter],
      [],
      ['State', 'State Name', 'Miles', 'Gallons Purchased', 'Fuel Amount'],
      ...data.rows.map(r => [r.state, STATE_LABELS[r.state] || r.state, fmt(r.miles), fmt(r.gallons), fmtMoney(r.fuel_amount)]),
      [],
      ['TOTAL', '', fmt(data.summary.total_miles), fmt(data.summary.total_gallons), ''],
      ['MPG', '', '', data.summary.mpg || '—', ''],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IFTA_${data.quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            IFTA Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Mileage by state for quarterly fuel tax filing</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quarter selector */}
          {data && data.quarters.length > 0 && (
            <div className="relative">
              <select
                value={selectedQ}
                onChange={e => { setSelectedQ(e.target.value); fetchReport(e.target.value); }}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {data.quarters.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          )}
          <button
            onClick={() => fetchReport(selectedQ || undefined)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            disabled={!data || data.rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* No data */}
      {!loading && (!data || data.rows.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-500 font-medium">No IFTA data yet</div>
          <div className="text-gray-400 text-sm mt-1">
            Mileage is recorded automatically as drivers use the mobile app with GPS tracking enabled.
          </div>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Miles</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(data.summary.total_miles, 0)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">States Driven</div>
              <div className="text-2xl font-bold text-gray-900">{data.rows.filter(r => r.miles > 0).length}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Gallons</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(data.summary.total_gallons, 1)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fleet MPG</div>
              <div className="text-2xl font-bold text-gray-900">{data.summary.mpg ?? '—'}</div>
            </div>
          </div>

          {/* Mileage table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="font-semibold text-gray-700">Mileage by State — {data.quarter}</div>
              <div className="text-xs text-gray-400">GPS-tracked miles + fuel log from driver app</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-600">State</th>
                    <th className="text-right p-4 font-semibold text-gray-600">Miles Driven</th>
                    <th className="text-right p-4 font-semibold text-gray-600">Gallons Purchased</th>
                    <th className="text-right p-4 font-semibold text-gray-600">Fuel Spend</th>
                    <th className="text-right p-4 font-semibold text-gray-600">MPG (state)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => {
                    const mpg = row.gallons > 0 ? (row.miles / row.gallons).toFixed(1) : '—';
                    return (
                      <tr key={row.state} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-8 h-6 bg-gray-100 rounded text-xs font-bold text-gray-700">{row.state}</span>
                            <span className="text-gray-600">{STATE_LABELS[row.state] || row.state}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-medium text-gray-900">{fmt(row.miles)}</td>
                        <td className="p-4 text-right text-gray-600">{row.gallons > 0 ? fmt(row.gallons) : '—'}</td>
                        <td className="p-4 text-right text-gray-600">{row.fuel_amount > 0 ? fmtMoney(row.fuel_amount) : '—'}</td>
                        <td className="p-4 text-right text-gray-500">{mpg}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="p-4 font-bold text-gray-900">TOTAL</td>
                    <td className="p-4 text-right font-bold text-gray-900">{fmt(data.summary.total_miles)}</td>
                    <td className="p-4 text-right font-bold text-gray-900">{fmt(data.summary.total_gallons)}</td>
                    <td className="p-4 text-right font-bold text-gray-900">
                      {fmtMoney(data.rows.reduce((s, r) => s + r.fuel_amount, 0))}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900">{data.summary.mpg ?? '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* IFTA help note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <strong>Filing tip:</strong> Export this CSV and use it to complete your IFTA quarterly return.
            Each state requires the total miles driven and gallons purchased in that state.
            If you purchased no fuel in a state you drove through, the tax credits/debits will be calculated by your base state.
          </div>
        </>
      )}
    </div>
  );
}
