import InteractiveAvatar from '../components/avatar/InteractiveAvatar';
import React, { useState } from 'react';
import { Truck, CheckCircle, MapPin, FileText, CreditCard, MessageSquare, Gauge, Users, ChevronDown, ArrowRight, Volume2, BookOpen, Heart } from 'lucide-react';

const FEATURES = [
  { icon: FileText,      label: 'Load Management',   desc: 'Create, assign, and close loads end-to-end. Every status, every note, one screen.' },
  { icon: MapPin,        label: 'Live GPS Tracking',  desc: 'See every truck on an interactive map in real time. No extra hardware.' },
  { icon: CreditCard,    label: 'Invoicing & Pay',    desc: 'Auto-generate invoices on delivery. Track aging. Get paid faster.' },
  { icon: MessageSquare, label: 'SMS Dispatch',       desc: 'Push loads to drivers by text. No app download. No training needed.' },
  { icon: Users,         label: 'Driver Portal',      desc: 'Drivers upload BOLs and update load status themselves — less phone tag for you.' },
  { icon: Gauge,         label: 'IFTA Reporting',     desc: 'Mileage by state tracked automatically. Quarter-end prep in minutes.' },
];

interface FormState {
  name: string; email: string; company: string;
  phone: string; fleetSize: string; notes: string;
}

export default function DemoRequestPage() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', company: '', phone: '', fleetSize: '', notes: '' });
  const [sending, setSending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch('/api/demo-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } catch { /* non-blocking */ }
    window.location.href = '/onboard';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col justify-between"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/wingman/6bc070fc-a70c-40b9-ab7e-ce8bf7ccc7ff/attachments/7e9ca85c59c6448bb9d1c05e0ad669f5_Screenshot%202026-05-16%20at%203.50.02_PM.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      >
        {/* dark gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(3,7,18,0.92) 100%)' }}
        />

        {/* ── NAV ── */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-400" />
            <span className="font-bold text-lg tracking-tight">HaulFlow</span>
          </div>
          <div className="flex gap-4">
            {/* --- desktop nav --- */}
            <a
              href="/subscribe"
              className="hidden md:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-full px-5 py-2 text-sm transition-colors"
            >
              Carrier Setup
            </a>
            <a
              href="#demo-form"
              className="hidden md:flex items-center gap-1.5 border border-white/20 text-white hover:bg-white/10 font-semibold rounded-full px-5 py-2 text-sm transition-colors"
            >
              Book a Demo
            </a>
          </div>
        </nav>

        {/* ── HERO COPY ── */}
        <div className="relative z-10 px-6 pb-24">
          <div className="max-w-3xl">
            <p className="text-orange-400 font-semibold uppercase tracking-widest text-xs mb-4">Built by Carriers, for Carriers</p>
            <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
              The TMS That{' '}
              <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Actually Gets</span>{' '}
              Trucking
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-xl">
              Turtle Logistics LLC has been running trucks across America for years. And for years, we paid for TMS platforms that were built by people who had never dispatched a single load.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/subscribe"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors"
              >
                Carrier Setup <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#demo-form"
                className="flex items-center gap-2 border border-white/20 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-lg transition-colors"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </div>

        {/* ── AVATAR BOTTOM-RIGHT ── */}
        <div className="absolute bottom-6 right-6 z-20">
          {/* InteractiveAvatar (Anam) - floating chat widget */}
          <InteractiveAvatar />
        </div>

        {/* ── SCROLL HINT ── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="bg-gray-900 border-y border-gray-800 py-4 overflow-hidden">
        <div className="flex gap-12 animate-marquee whitespace-nowrap">
          {['Owner-Ops', 'Small Fleets', 'Mid-Size Carriers', 'Freight Brokers', 'Lease Operators'].map(label => (
            <span key={label} className="text-gray-400 font-semibold text-sm">{label}</span>
          ))}
          {['Owner-Ops', 'Small Fleets', 'Mid-Size Carriers', 'Freight Brokers', 'Lease Operators'].map(label => (
            <span key={label} className="text-gray-400 font-semibold text-sm">{label}</span>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative px-6 py-24 overflow-hidden" style={{ background: '#0a0a0f' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(251,146,60,0.08) 0%, transparent 70%)'
          }}
        />
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">What's Inside</p>
          <h2 className="text-4xl font-black text-center mb-16">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Everything</span>{' '}
            Built for the Road
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl p-6 border border-orange-900/30 hover:border-orange-500/50 transition-colors" style={{ background: '#111' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: '#1a0a00' }}>
                  <Icon className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">{label}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STORY SECTION ── */}
      <section className="px-6 py-24" style={{ background: '#030712' }}>
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl p-8 border border-blue-900/50" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
            <div className="flex gap-4 mb-8">
              <Truck className="w-10 h-10 text-blue-400 flex-shrink-0" />
              <div>
                <h2 className="font-black text-2xl mb-1">Why HaulFlow Exists</h2>
                <p className="text-blue-300 text-sm">A message from Turtle Logistics</p>
              </div>
            </div>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                Turtle Logistics LLC has been running trucks across America for years. And for years, we paid for TMS platforms that were built by people who had never dispatched a single load.
              </p>
              <p>
                We needed something better. So we built it — for ourselves first, then for every carrier, owner-op, and fleet manager who was tired of software that didn't speak trucker.
              </p>
              <p>
                HaulFlow isn't a Silicon Valley product dreamed up in a coworking space. It's a tool built in the trenches, tested on real loads, by real people who know what 3am breakdown calls feel like.
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-blue-900/30">
              <div className="flex flex-wrap gap-6">
                {[
                  { num: '500+', label: 'Loads Managed' },
                  { num: 'Nationwide', label: 'Coverage' },
                  { num: '24/7', label: 'Support' },
                ].map(({ num, label }) => (
                  <div key={label} className="text-center">
                    <div className="font-black text-2xl text-blue-400">{num}</div>
                    <div className="text-gray-400 text-sm">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="px-6 py-24" style={{ background: '#0a0a0f' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">Simple Pricing</p>
          <h2 className="text-4xl font-black text-center mb-16">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>No Hidden Fees.</span>{' '}
            No Contracts.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* ── Starter ── */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Starter</div>
              <div className="text-4xl font-black mb-1">$0<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <div className="text-gray-400 text-sm mb-8">Up to 5 loads/month</div>
              <ul className="space-y-3 mb-8 text-sm">
                {[
                  'Load Management',
                  'Basic GPS',
                  'Invoice Generator',
                  'Email Support',
                ].map(f => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full py-3 transition-colors">
                Get Started Free
              </a>
            </div>

            {/* ── Pro (highlighted) ── */}
            <div className="rounded-2xl p-8 border-2 border-orange-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>
              <div className="font-black text-xl mb-2">Pro</div>
              <div className="text-4xl font-black mb-1">$149<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <div className="text-gray-400 text-sm mb-8">Up to 300 loads/month</div>
              <ul className="space-y-3 mb-8 text-sm">
                {[
                  'Everything in Starter',
                  'Live GPS Tracking',
                  'SMS Dispatch',
                  'Driver Portal',
                  'IFTA Reports',
                  'Priority Support',
                ].map(f => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-3 transition-colors">
                Start Free Trial
              </a>
            </div>

            {/* ── Enterprise ── */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Enterprise</div>
              <div className="text-4xl font-black mb-2">Custom</div>
              <div className="text-gray-400 text-sm mb-8">Unlimited loads + white-label</div>
              <ul className="space-y-3 mb-8 text-sm">
                {[
                  'Everything in Pro',
                  'Custom Integrations',
                  'Dedicated Account Manager',
                  'SLA Guarantee',
                  'On-site Training',
                ].map(f => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full py-3 transition-colors">
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO FORM ── */}
      <section className="px-6 py-24" style={{ background: '#030712' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-gray-800 p-8" style={{ background: '#0f172a' }}>
            <p className="text-orange-400 uppercase tracking-widest text-xs mb-3">Book a Demo</p>
            <h2 className="text-3xl font-black mb-8">See HaulFlow in Action</h2>

            <form id="demo-form" onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                  <input name="name" onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="Jane Smith" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input name="email" type="email" onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="jane@smithtrucking.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Company</label>
                  <input name="company" onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="Smith Trucking Co." required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input name="phone" type="tel" onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="(555) 867-5309" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Fleet Size</label>
                <select name="fleetSize" onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500">
                  <option value="">Select fleet size…</option>
                  <option value="1-3">1–3 trucks</option>
                  <option value="4-10">4–10 trucks</option>
                  <option value="11-25">11–25 trucks</option>
                  <option value="26-50">26–50 trucks</option>
                  <option value="50+">50+ trucks</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Anything else?</label>
                <textarea name="notes" rows={3} onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="Tell us about your operation…" />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-4 text-lg transition-colors disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Request My Demo'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span className="font-bold">HaulFlow</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="/subscribe">Carrier Setup</a>
            <a href="#demo-form">Book Demo</a>
            <a href="/onboard">Onboard</a>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Turtle Logistics LLC. Built by carriers, for carriers.
          </p>
        </div>
      </footer>
      {/* Interactive Avatar (Anam) - floating chat widget */}
      <InteractiveAvatar />
    </div>
  );
}