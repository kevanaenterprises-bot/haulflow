import { useState } from 'react';
import { Truck, CheckCircle, Shield } from 'lucide-react';
import { api } from '../lib/api';

export default function OnboardingPage() {
  const [form, setForm] = useState({
    company_name: '', company_email: '', company_phone: '',
    mc_number: '', dot_number: '',
    admin_name: '', admin_email: '', password: '', confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ownerName, setOwnerName] = useState('');

  const [dotLookupLoading, setDotLookupLoading] = useState(false);
  const [dotLookupError, setDotLookupError] = useState('');
  const [dotFilled, setDotFilled] = useState(false);

  const handleDotLookup = async () => {
    setDotLookupLoading(true);
    setDotLookupError('');
    setDotFilled(false);
    try {
      const res = await fetch(`/api/fmcsa/lookup?dot=${form.dot_number.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setForm(p => ({
        ...p,
        company_name: p.company_name || data.legalName || data.dbaName,
        company_phone: p.company_phone || data.phone,
        mc_number: p.mc_number || data.mcNumber,
      }));
      setDotFilled(true);
    } catch (err: any) {
      setDotLookupError(err.message);
    }
    setDotLookupLoading(false);
  };

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/onboard', {
        company_name: form.company_name,
        company_email: form.company_email,
        company_phone: form.company_phone,
        mc_number: form.mc_number || undefined,
        dot_number: form.dot_number || undefined,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
        password: form.password,
      });

      // Auto-login: store token and user, then redirect into the app
      localStorage.setItem('hf_token', data.token);
      localStorage.setItem('hf_user', JSON.stringify(data.user));
      localStorage.setItem('hf_company', JSON.stringify(data.company));
      setOwnerName(data.user.name.split(' ')[0]);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're in, {ownerName}! 🎉</h2>
          <p className="text-gray-500 mb-2">Your HaulFlow account is ready.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">✅ Your account is ready</p>
            <p className="text-sm text-blue-700">We sent a welcome email with your next steps. To get started:</p>
            <ol className="text-sm text-blue-700 mt-2 ml-4 list-decimal space-y-1">
              <li>Add your first driver</li>
              <li>Add a customer or shipper</li>
              <li>Create and dispatch your first load</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="block w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition"
          >
            Go to My Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">HaulFlow</span>
          </div>
          <h1 className="text-2xl font-bold">Start your account</h1>
          <p className="text-brand-100 text-sm mt-1">Set up your dispatch portal in 60 seconds. Flat $350/mo — All features included.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Company Info */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Company Info</h3>
            <div className="space-y-3">
              <Field label="Company Name *" value={form.company_name} onChange={v => set('company_name', v)} placeholder="ABC Trucking LLC" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company Email" value={form.company_email} onChange={v => set('company_email', v)} type="email" placeholder="billing@company.com" />
                <Field label="Company Phone" value={form.company_phone} onChange={v => set('company_phone', v)} placeholder="555-000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="MC Number" value={form.mc_number} onChange={v => set('mc_number', v)} placeholder="MC-123456" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.dot_number}
                      onChange={e => set('dot_number', e.target.value)}
                      placeholder="1234567"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      disabled={dotLookupLoading || !form.dot_number}
                      onClick={handleDotLookup}
                      className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-40 whitespace-nowrap"
                    >
                      {dotLookupLoading ? '...' : 'Auto-Fill'}
                    </button>
                  </div>
                  {dotLookupError && <p className="text-xs text-red-500 mt-1">{dotLookupError}</p>}
                  {dotFilled && <p className="text-xs text-green-600 mt-1">✓ Carrier info loaded from FMCSA</p>}
                </div>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> MC and DOT numbers are optional but used for compliance reports.
              </p>
            </div>
          </div>

          {/* Admin Account */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Account</h3>
            <div className="space-y-3">
              <Field label="Your Name *" value={form.admin_name} onChange={v => set('admin_name', v)} placeholder="John Smith" required />
              <Field label="Email Address *" value={form.admin_email} onChange={v => set('admin_email', v)} type="email" placeholder="you@company.com" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Password *" value={form.password} onChange={v => set('password', v)} type="password" placeholder="Min. 6 characters" required />
                <Field label="Confirm Password *" value={form.confirm_password} onChange={v => set('confirm_password', v)} type="password" placeholder="Repeat password" required />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 text-base"
          >
            {loading ? 'Creating your account...' : 'Create Account →'}
          </button>

          <p className="text-center text-xs text-gray-400">
            By signing up you agree to our terms of service. Flat $350/mo — All features included.
          </p>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
                            <button type="button" onClick={() => { ['hf_token','hf_demo_expires_at','hf_user','hf_company'].forEach(k => localStorage.removeItem(k)); window.location.href = '/'; }} className="text-brand-500 font-medium hover:underline">Sign in</button>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder = '', required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
