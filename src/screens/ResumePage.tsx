import { useState } from 'react';
import InteractiveAvatar from '../components/avatar/InteractiveAvatar';
import { Truck, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

export default function ResumePage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Step 1: log them in
      const loginData = await api.post('/api/auth/login', { email, password });

      // Store auth in localStorage
      localStorage.setItem('hf_token', loginData.token);
      localStorage.setItem('hf_user', JSON.stringify(loginData.user));

      // Step 2: check where they are in the flow
      const status = await api.get('/api/session/status');

      if (status.setup_complete) {
        // Fully set up — go to dashboard
        window.location.href = '/';
      } else if (status.stripe_paid) {
        // Paid but setup not done — resume the wizard
        window.location.href = '/setup';
      } else {
        // Account exists but haven't paid yet — go to subscribe
        window.location.href = '/subscribe';
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your email and password.');
      setLoading(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">HaulFlow</span>
          </div>
          <h1 className="text-2xl font-bold">Resume Setup</h1>
          <p className="text-brand-100 text-sm mt-1">
            Already signed up? Log in to pick up where you left off.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="The password you created during signup"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Finding your account...' : (
              <>Continue Where I Left Off <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-sm text-gray-500 pt-2">
            Don't have an account?{' '}
            <a href="/onboard" className="text-brand-500 font-medium hover:underline">
              Sign up here
            </a>
          </p>
        </form>
      </div>
    </div>
    <InteractiveAvatar context="onboard" />
    </>
  );
}
