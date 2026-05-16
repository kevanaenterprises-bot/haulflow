import { useState } from 'react';
import { Truck, ArrowRight, Sparkles, CreditCard, Lock } from 'lucide-react';

const _stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export default function SubscribePage() {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState(false);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toUpperCase() === 'FOUNDING-CARRIER') {
      setCodeError('');
      setCodeSuccess(true);
      setTimeout(() => {
        window.location.href = '/setup';
      }, 1200);
    } else {
      setCodeError('Invalid code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">

      {/* NAV */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/50">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tight">HaulFlow</span>
            <span className="block text-xs text-blue-300 leading-none -mt-0.5">by Turtle Logistics LLC</span>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Card */}
          <div
            className="rounded-2xl border border-gray-800 p-8"
            style={{ background: '#0f172a' }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-blue-950 border border-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <CreditCard className="w-7 h-7 text-blue-400" />
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ letterSpacing: '-0.03em' }}>
                Activate HaulFlow
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                You've seen the demo. Ready to run your operation on HaulFlow?
                <br />
                Subscribe below to get started.
              </p>
            </div>

            {/* Pricing */}
            <div className="bg-blue-950 border border-blue-800 rounded-xl p-5 mb-6 text-center">
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-black text-white">$350</span>
                <span className="text-gray-400 text-lg">/mo</span>
              </div>
              <p className="text-blue-300 text-xs">
                All features · Unlimited users · No contracts · Cancel anytime
              </p>
            </div>

            {/* Stripe Button placeholder */}
            <div className="mb-6">
              {_stripeKey ? (
                <button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5 text-base tracking-tight flex items-center justify-center gap-2"
                  style={{ boxShadow: '0 6px 25px rgba(37,99,235,0.45)' }}
                >
                  <Lock className="w-4 h-4" /> Subscribe & Start Setup <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-full bg-gray-800 border border-gray-700 text-gray-500 font-semibold py-4 rounded-xl text-center text-sm cursor-not-allowed">
                  <Lock className="w-4 h-4 inline mr-2 -mt-0.5" />
                  Payment coming soon — use a Founding Carrier Code below
                </div>
              )}
            </div>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600 mb-6">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> Secure checkout
              </span>
              <span>·</span>
              <span>Cancel anytime</span>
              <span>·</span>
              <span>No setup fees</span>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800 my-6" />

            {/* Founding Carrier Code */}
            {!showCodeInput && !codeSuccess && (
              <div className="text-center">
                <button
                  onClick={() => setShowCodeInput(true)}
                  className="text-xs text-gray-600 hover:text-blue-400 transition-colors cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  Have a Founding Carrier Code?
                </button>
              </div>
            )}

            {showCodeInput && !codeSuccess && (
              <form onSubmit={handleCodeSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5 text-blue-400" />
                    Founding Carrier Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeError('');
                    }}
                    placeholder="Enter your code"
                    autoFocus
                    className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                  />
                  {codeError && (
                    <p className="text-xs text-red-400 mt-1">{codeError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Redeem Code
                </button>
              </form>
            )}

            {codeSuccess && (
              <div className="text-center space-y-2">
                <div className="w-10 h-10 bg-green-950 border border-green-900 rounded-xl flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-green-400 font-bold text-sm">Welcome, Founding Carrier!</p>
                <p className="text-gray-500 text-xs">Redirecting to setup…</p>
              </div>
            )}
          </div>

          {/* Back to demo */}
          <p className="text-center text-xs text-gray-600 mt-6">
            <a href="/demo" className="hover:text-gray-400 transition-colors">
              ← Back to demo
            </a>
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-white">HaulFlow</span>
              <span className="text-gray-500 text-xs ml-2">A product of Turtle Logistics LLC</span>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Turtle Logistics LLC. Built by carriers, for carriers.
          </p>
        </div>
      </footer>
    </div>
  );
}
