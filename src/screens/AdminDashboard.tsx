import { useState, useEffect, useCallback } from 'react';
import { Truck, LogOut, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Clock, Server } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://haulflow-production-575a.up.railway.app';

async function adminFetch(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  stripe_customer_id: string;
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  driver_count: number;
  load_count: number;
  invoice_count: number;
  user_count: number;
}

interface Slots {
  founding_1yr_used: number;
  founding_1yr_total: number;
  founding_1yr_remaining: number;
  founding_6mo_used: number;
  founding_6mo_total: number;
  founding_6mo_remaining: number;
}

interface Stats {
  companies: { total: number; active: number; inTrial: number; cancelled: number };
  totalUsers: number;
  totalDrivers: number;
  totalLoads: number;
  totalInvoices: number;
}

interface HealthCheck {
  database: { status: string; latency_ms: number };
  stripe: { status: string; latency_ms?: number; mode?: string };
  environment: Record<string, boolean | string | number>;
  process: { uptime_seconds: number; memory_mb: number };
}

interface PlatformError {
  id: number;
  method: string;
  path: string;
  error_message: string;
  status_code: number;
  ip: string;
  created_at: string;
}

interface ActivityEvent {
  id: number;
  type: string;
  detail: string;
  company_id: string;
  created_at: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatStatus(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    trial: { label: 'Trial', color: 'bg-yellow-100 text-yellow-800' },
    founding_1yr: { label: 'Founding (1yr free)', color: 'bg-green-100 text-green-800' },
    founding_6mo: { label: 'Founding (6mo free)', color: 'bg-green-100 text-green-700' },
    active: { label: 'Active', color: 'bg-blue-100 text-blue-800' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  };
  const info = map[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${info.color}`}>
      {info.label}
    </span>
  );
}

function daysUntil(iso: string) {
  if (!iso) return null;
  return Math.ceil(new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function activityIcon(type: string) {
  if (type.includes('signup') || type.includes('onboard')) return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
  if (type.includes('payment') || type.includes('stripe')) return <span className="text-green-400 text-xs">💰</span>;
  if (type.includes('error') || type.includes('fail')) return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (type.includes('cancel')) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Activity className="w-3.5 h-3.5 text-blue-400" />;
}

type Tab = 'overview' | 'errors' | 'activity';

export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('hf_admin_token') || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [errors, setErrors] = useState<PlatformError[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const loadData = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const [customersRes, statsRes, healthRes, errorsRes, activityRes] = await Promise.all([
        adminFetch('/api/admin/customers', t),
        adminFetch('/api/admin/stats', t),
        adminFetch('/api/admin/health', t),
        adminFetch('/api/admin/errors', t),
        adminFetch('/api/admin/activity', t),
      ]);
      setCompanies(customersRes.companies || []);
      setSlots(customersRes.slots || null);
      setStats(statsRes);
      setHealth(healthRes);
      setErrors(errorsRes || []);
      setActivity(activityRes || []);
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('Unauthorized') || err.message.includes('Invalid')) {
        localStorage.removeItem('hf_admin_token');
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadData(token);
  }, [token, loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      const t = data.token;
      localStorage.setItem('hf_admin_token', t);
      setToken(t);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hf_admin_token');
    setToken('');
    setCompanies([]);
    setStats(null);
    setSlots(null);
    setHealth(null);
    setErrors([]);
    setActivity([]);
  };

  const clearErrors = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/errors`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setErrors([]);
    } catch {}
  };

  // --- LOGIN ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="bg-blue-600 p-3 rounded-xl w-fit mx-auto mb-4 shadow-lg shadow-blue-900/50">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black">HaulFlow Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Platform operations dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
            />
            {loginError && <p className="text-xs text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {loginLoading ? 'Logging in…' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  const statsCards = stats ? [
    { label: 'Total Companies', value: stats.companies.total, icon: <Truck className="w-4 h-4" />, color: 'text-blue-400' },
    { label: 'Active Subscriptions', value: stats.companies.active, icon: <span className="text-xs">💰</span>, color: 'text-green-400' },
    { label: 'In Free Trial', value: stats.companies.inTrial, icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
    { label: 'Cancelled', value: stats.companies.cancelled, icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
    { label: 'Total Users', value: stats.totalUsers, icon: <span className="text-xs">👥</span>, color: 'text-purple-400' },
    { label: 'Total Drivers', value: stats.totalDrivers, icon: <Truck className="w-4 h-4" />, color: 'text-cyan-400' },
    { label: 'Total Loads', value: stats.totalLoads, icon: <span className="text-xs">📦</span>, color: 'text-orange-400' },
    { label: 'Total Invoices', value: stats.totalInvoices, icon: <span className="text-xs">🧾</span>, color: 'text-emerald-400' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-lg">HaulFlow Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadData(token)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6 flex gap-1">
        {([
          ['overview', '📊 Overview'],
          ['errors', `🚨 Errors${errors.length > 0 ? ` (${errors.length})` : ''}`],
          ['activity', '📡 Activity'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-3 text-xs font-semibold transition-colors ${
              tab === id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-sm text-red-300">{error}</div>
        )}

        {loading && !companies.length && (
          <p className="text-gray-500 text-center py-12">Loading…</p>
        )}

        {/* ==================== OVERVIEW TAB ==================== */}
        {tab === 'overview' && (
          <>
            {/* Platform Health */}
            {health && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <HealthBadge label="Database" status={health.database.status} detail={`${health.database.latency_ms}ms`} />
                <HealthBadge
                  label="Stripe"
                  status={health.stripe.status === 'connected' ? 'healthy' : health.stripe.status === 'not configured' ? 'warning' : 'error'}
                  detail={health.stripe.mode ? `${health.stripe.mode} mode` : health.stripe.status}
                />
                <HealthBadge label="API Server" status="healthy" detail={`${(health.process.uptime_seconds / 3600).toFixed(0)}h up`} />
                <HealthBadge
                  label="Email"
                  status={health.environment.has_mail_config ? 'healthy' : 'warning'}
                  detail={health.environment.has_mail_config ? 'configured' : 'not configured'}
                />
              </div>
            )}

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {statsCards.map(card => (
                  <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className={`text-xs text-gray-500 mb-1 flex items-center gap-1.5 ${card.color}`}>{card.icon} {card.label}</div>
                    <p className="text-2xl font-black">{card.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Founding Slots */}
            {slots && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <SlotCard
                  title="🏷️ Founding Tier 1 — Free 1 Year (Android)"
                  used={slots.founding_1yr_used}
                  total={slots.founding_1yr_total}
                  color="green"
                />
                <SlotCard
                  title="🏷️ Founding Tier 2 — Free 6 Months"
                  used={slots.founding_6mo_used}
                  total={slots.founding_6mo_total}
                  color="green"
                />
              </div>
            )}

            {/* Customer Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-bold text-gray-300">Customers ({companies.length})</h2>
              </div>
              {companies.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-12">No customers yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                        <th className="text-left px-4 py-3">Company</th>
                        <th className="text-left px-4 py-3">Email</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Trial Ends</th>
                        <th className="text-left px-4 py-3">Signed Up</th>
                        <th className="text-center px-4 py-3">Users</th>
                        <th className="text-center px-4 py-3">Drivers</th>
                        <th className="text-center px-4 py-3">Loads</th>
                        <th className="text-center px-4 py-3">Invoices</th>
                        <th className="text-left px-4 py-3">Stripe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map(c => {
                        const days = daysUntil(c.trial_ends_at);
                        return (
                          <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-white">{c.name || '—'}</p>
                                <p className="text-xs text-gray-500">{c.city}{c.city && c.state ? ', ' : ''}{c.state}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-300">{c.email || '—'}</td>
                            <td className="px-4 py-3">{formatStatus(c.subscription_status)}</td>
                            <td className="px-4 py-3">
                              {c.subscription_status.startsWith('founding') ? (
                                <div>
                                  <p className="text-gray-300">{formatDate(c.trial_ends_at)}</p>
                                  {days !== null && (
                                    <p className={`text-xs ${days <= 30 ? 'text-red-400' : 'text-gray-500'}`}>
                                      {days > 0 ? `${Math.floor(days)}d left` : 'Expired'}
                                    </p>
                                  )}
                                </div>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-400">{formatDate(c.created_at)}</td>
                            <td className="px-4 py-3 text-center text-gray-400">{c.user_count}</td>
                            <td className="px-4 py-3 text-center text-gray-400">{c.driver_count}</td>
                            <td className="px-4 py-3 text-center text-gray-400">{c.load_count}</td>
                            <td className="px-4 py-3 text-center text-gray-400">{c.invoice_count}</td>
                            <td className="px-4 py-3">
                              {c.stripe_customer_id
                                ? <span className="text-xs text-green-400 font-mono">cus_…{c.stripe_customer_id.slice(-6)}</span>
                                : <span className="text-xs text-gray-600">None</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ==================== ERRORS TAB ==================== */}
        {tab === 'errors' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-300">
                🚨 Platform Errors ({errors.length})
              </h2>
              {errors.length > 0 && (
                <button onClick={clearErrors} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {errors.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <p className="text-gray-400">No errors recorded. Everything looks clean.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errors.map(e => (
                  <div key={e.id} className="bg-gray-900 border border-red-900/50 rounded-xl p-4 flex items-start gap-4">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-red-400">{e.method} {e.path}</span>
                        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{e.status_code}</span>
                      </div>
                      <p className="text-sm text-gray-300 break-all">{e.error_message}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatTime(e.created_at)} · {e.ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== ACTIVITY TAB ==================== */}
        {tab === 'activity' && (
          <div>
            <h2 className="text-sm font-bold text-gray-300 mb-4">📡 Platform Activity</h2>

            {activity.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No activity yet. Events will appear as users sign up, subscribe, and interact with the platform.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map(a => (
                  <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4">
                    {activityIcon(a.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300">{a.detail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{a.type}</span>
                        <span className="text-xs text-gray-600">{formatTime(a.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-700 mt-8">HaulFlow Admin Portal · Turtle Logistics LLC</p>
      </div>
    </div>
  );
}

// Sub-components
function HealthBadge({ label, status, detail }: { label: string; status: string; detail: string }) {
  const color = status === 'healthy' ? 'border-green-800 bg-green-950/30' : status === 'warning' ? 'border-yellow-800 bg-yellow-950/30' : 'border-red-800 bg-red-950/30';
  const dot = status === 'healthy' ? 'bg-green-400' : status === 'warning' ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-300">{detail}</p>
    </div>
  );
}

function SlotCard({ title, used, total, color }: { title: string; used: number; total: number; color: string }) {
  return (
    <div className="bg-green-950/30 border border-green-900 rounded-xl p-5">
      <h3 className="text-sm font-bold text-green-400 mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className={`bg-${color}-500 h-3 rounded-full transition-all`}
              style={{ width: `${(used / total) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-bold text-green-400">{used}/{total}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{Math.max(0, total - used)} slots remaining</p>
    </div>
  );
}
