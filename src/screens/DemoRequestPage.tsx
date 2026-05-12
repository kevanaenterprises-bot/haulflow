import React, { useState } from 'react';
import { Truck, CheckCircle, MapPin, FileText, CreditCard, MessageSquare, Gauge, Users } from 'lucide-react';

const FEATURES = [
  { icon: FileText,    label: 'Load Management',    desc: 'Create, track, and close loads end-to-end.' },
  { icon: MapPin,      label: 'Live GPS Tracking',  desc: 'Real-time truck locations on an interactive map.' },
  { icon: CreditCard,  label: 'Invoicing & Pay',    desc: 'Auto-generate invoices on delivery. Track aging.' },
  { icon: MessageSquare, label: 'SMS Dispatch',     desc: 'Push loads to drivers via text — no app needed.' },
  { icon: Users,       label: 'Driver Portal',      desc: 'Drivers upload BOLs and update status themselves.' },
  { icon: Gauge,       label: 'IFTA Reporting',     desc: 'Mileage by state tracked automatically.' },
];

interface FormState {
  name: string;
  email: string;
  company: string;
  phone: string;
  fleetSize: string;
  notes: string;
}

export default function DemoRequestPage() {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', company: '', phone: '', fleetSize: '', notes: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await fetch('/api/demo-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // Always drop them into onboarding — even if the API hiccups
    } catch {
      // Non-blocking — proceed anyway
    }
    window.location.href = '/onboard';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* NAV */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="bg-blue-600 p-1.5 rounded-lg">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">HaulFlow</span>
        <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">
          TMS Platform
        </span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-16 items-start">

        {/* LEFT: Marketing */}
        <div>
          {/* Hero */}
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
            Free Demo — Instant Access
          </p>
          <h1 className="text-4xl lg:text-5xl font-black mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
            The TMS built by a{' '}
            <span className="text-blue-400">carrier owner</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Stop paying $700+/mo for software with half the features locked
            behind add-ons. HaulFlow ships everything — load management, live
            GPS, IFTA reporting, invoicing, SMS dispatch, and a full driver
            portal — for one flat rate.
          </p>

          {/* Price callout */}
          <div className="inline-flex items-baseline gap-2 mb-10 bg-blue-950 border border-blue-800 px-5 py-3 rounded-xl">
            <span className="text-3xl font-black text-white">$350</span>
            <span className="text-gray-400">/mo</span>
            <span className="text-sm text-blue-300 ml-2">· All features · Unlimited users</span>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex gap-3 items-start">
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap gap-4">
            {['No credit card required', 'No long-term contracts', 'Cancel anytime'].map(t => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Info Card Form */}
        <div
          className="rounded-2xl border p-8 sticky top-8"
          style={{ background: '#111827', borderColor: '#1f2937' }}
        >
          <h2 className="text-xl font-bold mb-1">Request your demo</h2>
          <p className="text-gray-500 text-sm mb-6">
            Fill this in and you'll go straight into HaulFlow — no waiting.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="name" value={form.name} onChange={handleChange} required
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="company" value={form.company} onChange={handleChange} required
                  placeholder="Smith Trucking LLC"
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange} required
                placeholder="jane@smithtrucking.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
              />
            </div>

            {/* Phone + Fleet Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Phone
                </label>
                <input
                  type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="(555) 000-0000"
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Fleet Size <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="fleetSize" value={form.fleetSize} onChange={handleChange} required
                  placeholder="e.g. 8 trucks"
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Current software / pain points
                <span className="text-gray-600 normal-case font-normal tracking-normal ml-1">(optional)</span>
              </label>
              <textarea
                name="notes" value={form.notes} onChange={handleChange}
                placeholder="What TMS are you using now? What's the biggest frustration?"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all duration-150 hover:-translate-y-0.5 text-base"
              style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}
            >
              {sending ? 'Setting up your demo…' : 'Get Instant Demo Access →'}
            </button>

            <p className="text-center text-xs text-gray-600">
              No credit card · No commitment · You'll go straight into HaulFlow
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
