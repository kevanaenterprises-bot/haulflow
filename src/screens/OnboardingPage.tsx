import { useState } from 'react';
import { Truck, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';

export default function OnboardingPage() {
  const [form, setForm] = useState({
    company_name: '', company_email: '', company_phone: '',
    admin_name: '', admin_email: '', password: '', confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/onboard', {
        company_name: form.company_name,
        company_email: form.company_email,
        company_phone: form.company_phone,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
        password: form.password,
      });
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
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
          <p className="text-gray-500 mb-6">Your HaulFlow account has been created. You can now log in with your email and password.</p>
          <a href="/" className="block w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">HaulFlow</span>
          </div>
          <h1 className="text-2xl font-bold">Start your free trial</h1>
          <p className="text-brand-100 text-sm mt-1">Set up your trucking dispatch portal in 60 seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Info</h3>
            <div className="space-y-3">
              <Field label="Company Name *" value={form.company_name} onChange={v => set('company_name', v)} placeholder="ABC Trucking LLC" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company Email" value={form.company_email} onChange={v => set('company_email', v)} type="email" placeholder="billing@company.com" />
                <Field label="Company Phone" value={form.company_phone} onChange={v => set('company_phone', v)} placeholder="555-000-0000" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Account</h3>
            <div className="space-y-3">
              <Field label="Your Name *" value={form.admin_name} onChange={v => set('admin_name', v)} placeholder="John Smith" />
              <Field label="Email Address *" value={form.admin_email} onChange={v => set('admin_email', v)} type="email" placeholder="you@company.com" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Password *" value={form.password} onChange={v => set('password', v)} type="password" placeholder="Min. 6 characters" />
                <Field label="Confirm Password *" value={form.confirm_password} onChange={v => set('confirm_password', v)} type="password" placeholder="Repeat password" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create My Account →'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/" className="text-brand-500 font-medium hover:underline">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}
