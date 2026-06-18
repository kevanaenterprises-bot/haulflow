import { useState } from 'react';
import { Truck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

interface Props {
    onLogin: (token: string, driver: any) => void;
}

export default function DriverLoginPage({ onLogin }: Props) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
                const res = await fetch(`${API_URL}/api/auth/driver-login`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');
                localStorage.setItem('hf_driver_token', data.token);
                localStorage.setItem('hf_driver', JSON.stringify(data.driver));
                onLogin(data.token, data.driver);
        } catch (err: any) {
                setError(err.message);
        }
        setLoading(false);
  };

  return (
        <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                      <div className="bg-brand-500 px-6 py-6 text-white text-center">
                                <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <Truck className="w-8 h-8" />
                                </div>
                                <h1 className="text-xl font-bold">HaulFlow Driver</h1>
                                <p className="text-brand-100 text-sm mt-1">Sign in to see your loads</p>
                      </div>
              
                      <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                            <input
                                                            type="text"
                                                            inputMode="text"
                                                            value={phone}
                                                            onChange={e => setPhone(e.target.value)}
                                                            placeholder="9038037500"
                                                            autoComplete="username"
                                                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                                          />
                                </div>
                                <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                            <input
                                                            type="password"
                                                            value={password}
                                                            onChange={e => setPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            autoComplete="current-password"
                                                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                                          />
                                </div>
                        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                                <button
                                              type="submit"
                                              disabled={loading}
                                              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
                                            >
                                  {loading ? 'Signing in...' : 'Sign In'}
                                </button>
                      </form>
              </div>
        </div>
      );
}
