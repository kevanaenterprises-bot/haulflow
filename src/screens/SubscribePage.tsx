import { useState, useEffect } from 'react';
import { Truck, ArrowRight, Sparkles, CreditCard, Lock } from 'lucide-react';
import { api } from '../lib/api';

interface PricingTier {
  id: string;
  label: string;
  amount: number;
  trialDays: number;
  description: string;
  requiresAndroid: boolean;
  slotsRemaining: number | null;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString()}`;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

export default function SubscribePage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const onAndroid = isAndroid();

  useEffect(() => {
    api.get('/api/pricing')
      .then(data => {
        setTiers(data);
        // Auto-select the best available tier
        if (data.find(t => t.id === 'founding-1yr' && (t.slotsRemaining ?? 0) > 0)) {
          setSelectedPlan('founding-1yr');
        } else {
          setSelectedPlan(data.find(t => t.id === 'fleet-20')?.id || data[0]?.id || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toUpperCase() === 'FOUNDING-CARRIER') {
      setCodeError('');
      setCodeSuccess(true);
      setTimeout(() => { window.location.href = '/setup'; }, 1200);
    } else {
      setCodeError('Invalid code. Please try again.');
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    setPayLoading(true);
    setPayError('');
    try {
      const data = await api.post('/api/create-checkout-session', { plan: selectedPlan });
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPayError('Could not start checkout.');
        setPayLoading(false);
      }
    } catch (err: any) {
      setPayError(err.message || 'Network error. Please try again.');
      setPayLoading(false);
    }
  };

  const activeTier = tiers.find(t => t.id === selectedPlan);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500">Loading pricing…</p>
      </div>
    );
  }

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
      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black mb-3">
              <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pick Your Plan</span>
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              No contracts. Cancel anytime. Every plan includes the full HaulFlow platform — dispatch, invoicing, GPS tracking, IFTA, DVIR inspections, and driver portal.
            </p>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

            {tiers.map(tier => {
              const isFounding = tier.slotsRemaining !== null;
              const soldOut = isFounding && tier.slotsRemaining === 0;
              const isAvailable = !soldOut;

              return (
                <button
                  key={tier.id}
                  onClick={() => isAvailable && setSelectedPlan(tier.id)}
                  disabled={!isAvailable}
                  className={`relative rounded-2xl border-2 p-6 text-left transition-all ${
                    !isAvailable
                      ? 'border-gray-800 bg-gray-900/30 opacity-50 cursor-not-allowed'
                      : selectedPlan === tier.id
                        ? 'border-blue-500 bg-blue-950/40'
                        : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                  }`}
                >
                  {/* Badge */}
                  {isFounding && !soldOut && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {tier.slotsRemaining} slot{tier.slotsRemaining !== 1 ? 's' : ''} left
                    </div>
                  )}

                  {soldOut && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1 rounded-full">
                      Sold Out
                    </div>
                  )}

                  {/* Price */}
                  <div className="mb-3">
                    {tier.trialDays > 0 ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-green-400">Free</span>
                          <span className="text-gray-500 text-sm">for {tier.trialDays === 365 ? '1 year' : '6 months'}</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">Then {formatCents(tier.amount)}/mo · Card required, not charged during free period</p>
                      </>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">{formatCents(tier.amount)}</span>
                        <span className="text-gray-400">/mo</span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <p className="text-sm font-bold text-white mb-1">{tier.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{tier.description}</p>

                  {/* Selected indicator */}
                  {selectedPlan === tier.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Subscribe Button */}
          <button
            onClick={handleSubscribe}
            disabled={!selectedPlan || payLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:cursor-wait text-white font-black py-4 rounded-xl transition-all text-base tracking-tight flex items-center justify-center gap-2"
            style={{ boxShadow: selectedPlan ? '0 6px 25px rgba(37,99,235,0.45)' : 'none' }}
          >
            <Lock className="w-4 h-4" />
            {payLoading
              ? 'Redirecting to Stripe…'
              : activeTier && activeTier.trialDays > 0
                ? `Claim Free Tier & Start Setup`
                : activeTier
                  ? `Subscribe ${formatCents(activeTier.amount)}/mo & Start Setup`
                  : 'Select a plan'
            }
            {!payLoading && selectedPlan && <ArrowRight className="w-4 h-4" />}
          </button>
          {payError && <p className="text-xs text-red-400 mt-2 text-center">{payError}</p>}

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-600 mt-4 mb-8">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Secure checkout</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>No setup fees</span>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 mb-8" />

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
            <form onSubmit={handleCodeSubmit} className="max-w-sm mx-auto space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5 text-blue-400" />
                  Founding Carrier Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setCodeError(''); }}
                  placeholder="Enter your code"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
                />
                {codeError && <p className="text-xs text-red-400 mt-1">{codeError}</p>}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
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

          {/* Back */}
          <p className="text-center text-xs text-gray-600 mt-8">
            <a href="/demo" className="hover:text-gray-400 transition-colors">&larr; Back to demo</a>
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
