import InteractiveAvatar from '../components/avatar/InteractiveAvatar';
import React, { useState } from 'react';
import { Truck, CheckCircle, MapPin, FileText, CreditCard, Gauge, Radio, Clock, ClipboardCheck, ChevronDown, ArrowRight, Heart } from 'lucide-react';
import { api } from '../lib/api';

const FEATURES = [
  { icon: CreditCard,    label: 'Automated Invoicing',        desc: 'Invoices generate themselves the moment a load is delivered. Track aging, see what is owed, get paid faster — no spreadsheets.' },
  { icon: MapPin,        label: 'Real-Time GPS Tracking',      desc: 'Every truck on a live map, updating in real time. No extra hardware, no per-device fees — it just works.' },
  { icon: Clock,         label: 'Geo-Digital Timestamps',      desc: 'Automatic, location-stamped arrival and departure times at every shipper and receiver. Proof of detention, settled.' },
  { icon: Gauge,         label: 'IFTA Quarterly Reports',      desc: 'Mileage by state tracked automatically all quarter long. When filing time comes, your report is already done.' },
  { icon: ClipboardCheck,label: 'Driver Pre-Trip Inspections', desc: 'Drivers run their pre-trip right from the app — tires, brakes, lights, fluids — with photo capture and fleet-manager alerts on anything that fails.' },
];

interface FormState {
  name: string; email: string; company: string;
  phone: string; fleetSize: string; notes: string;
}

export default function DemoRequestPage() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', company: '', phone: '', fleetSize: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    // 1) Capture the lead for sales (fire and forget, never blocks).
    api.post('/api/demo-signup', form).catch(() => {});

    // 2) Spin up the live demo and log the visitor in.
    try {
      const data = await api.post('/api/demo/start', form);
      localStorage.setItem('hf_token', data.token);
      localStorage.setItem('hf_demo_expires_at', data.demo_expires_at);
      localStorage.setItem('hf_user', JSON.stringify(data.user));
      localStorage.setItem('hf_company', JSON.stringify({ id: data.user.company_id, name: data.user.company_name }));
      window.location.href = '/';
    } catch (err: any) {
      setSending(false);
      setError('Sorry — we could not start the demo just now. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex flex-col justify-between"
        style={{ backgroundImage: 'url(/haulflow-hero.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 30%' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(3,7,18,0.92) 100%)' }} />

        <nav className="relative z-10 flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-400" />
            <span className="font-bold text-lg tracking-tight">HaulFlow</span>
          </div>
          <a href="#demo-form" className="hidden md:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-full px-5 py-2 text-sm transition-colors">
            Try the Live Demo
          </a>
        </nav>

        <div className="relative z-10 px-6 pb-24">
          <div className="max-w-3xl">
            <p className="text-orange-400 font-semibold uppercase tracking-widest text-xs mb-4">Built by Carriers, for Carriers</p>
            <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
              The TMS That <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Actually Gets</span> Trucking
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-xl">
              Turtle Logistics LLC has run trucks across America for years. We got tired of paying for software built by people who never dispatched a single load — so we built our own. This is it.
            </p>
            <a href="#demo-form" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors">
              Try the Live Demo <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ── ROAD TOUR — TRIBUTE SECTION ── */}
      <section className="px-6 py-24" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-amber-400" />
            <p className="text-amber-400 uppercase tracking-widest text-xs font-semibold">Road Tour — Our Thank You to Drivers</p>
          </div>
          <h2 className="text-4xl font-black mb-6 leading-tight">
            The history of America, read to you<br />
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>from behind the wheel.</span>
          </h2>
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
            <p>
              A truck can't pull into most historical sites. The pull-offs are too small, the lots aren't built for 70 feet of steel. So for generations, drivers have rolled right past the markers that tell the story of the country they're holding together.
            </p>
            <p>
              HaulFlow's <span className="text-white font-semibold">Road Tour</span> changes that. As you drive, the app reads the historical markers along your route aloud — right over your speakers, hands on the wheel, eyes on the road. The battlefields, the boomtowns, the rivers and rail lines. The history you're driving through, told to you as you pass it.
            </p>
            <p className="text-white font-semibold flex items-start gap-2">
              <Heart className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
              It's our way of saying thank you — to the men and women who sacrifice time with their own families to keep every other family in this country fed.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative px-6 py-24 overflow-hidden" style={{ background: '#0a0a0f' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">What's Inside</p>
          <h2 className="text-4xl font-black text-center mb-16">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Everything</span> Built for the Road
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

      {/* ── PRICING ── */}
      <section className="px-6 py-24" style={{ background: '#0a0a0f' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">Simple Pricing</p>
          <h2 className="text-4xl font-black text-center mb-4">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>No Contracts.</span> No Surprises.
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">Built for one-truck owner-operators and growing fleets alike.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Founding 50 — highlighted */}
            <div className="rounded-2xl p-8 border-2 border-orange-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">First 50 Only</div>
              <div className="font-black text-xl mb-2">Founding Owner-Op</div>
              <div className="text-4xl font-black mb-1">Free<span className="text-lg font-normal text-gray-400"> / 1 year</span></div>
              <div className="text-gray-400 text-sm mb-8">Free for the first 50 sign-ups. Up to 25 trucks, one full year.</div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Full platform access', 'Live GPS & dispatch', 'Automated invoicing', 'IFTA reports', 'Road Tour for drivers'].map(f => (
                  <li key={f} className="flex gap-2"><CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <a href="/onboard" className="block text-center bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-3 transition-colors">Claim a Founding Spot</a>
            </div>

            {/* Owner-Op */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Owner-Operator</div>
              <div className="text-4xl font-black mb-1">$150<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <div className="text-gray-400 text-sm mb-8">1 truck. Everything you need to run lean.</div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Full platform access', 'Live GPS & dispatch', 'Automated invoicing', 'IFTA reports', 'Road Tour for drivers'].map(f => (
                  <li key={f} className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full py-3 transition-colors">Get Started</a>
            </div>

            {/* Fleet / Standard */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Small Fleet</div>
              <div className="text-4xl font-black mb-1">$350<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <div className="text-gray-400 text-sm mb-8">2–20 trucks. The full command center.</div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Everything in Owner-Op', 'Unlimited trucks & drivers', 'Driver portal & pre-trip', 'Geo-digital timestamps', 'Dedicated support — every customer matters'].map(f => (
                  <li key={f} className="flex gap-2"><CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full py-3 transition-colors">Get Started</a>
            </div>

            {/* Growing Fleet */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Growing Fleet</div>
              <div className="text-4xl font-black mb-1">$500<span className="text-lg font-normal text-gray-400">/mo</span></div>
              <div className="text-gray-400 text-sm mb-8">21–50 trucks. Built to scale with you.</div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Everything in Small Fleet', 'Unlimited trucks & drivers', 'Driver portal & pre-trip', 'Geo-digital timestamps', 'Dedicated support — every customer matters'].map(f => (
                  <li key={f} className="flex gap-2"><CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <a href="/subscribe" className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full py-3 transition-colors">Get Started</a>
            </div>

            {/* Large Fleet — Contact */}
            <div className="rounded-2xl p-8 border border-gray-800">
              <div className="font-black text-xl mb-2">Large Fleet</div>
              <div className="text-4xl font-black mb-1">Let's<span className="text-lg font-normal text-gray-400"> talk</span></div>
              <div className="text-gray-400 text-sm mb-8">51+ trucks. Not our primary market — but every carrier deserves the same seat at the table. Reach out and let's figure it out together.</div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Everything in Growing Fleet', 'Custom onboarding', 'Flexible pricing', 'Built around your operation', 'Dedicated support — every customer matters'].map(f => (
                  <li key={f} className="flex gap-2"><CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <a href="#demo-form" className="block text-center bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-3 transition-colors">Get in Touch</a>
            </div>

          </div>
        </div>
      </section>

      {/* ── DEMO FORM ── */}
      <section className="px-6 py-24" style={{ background: '#030712' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-gray-800 p-8" style={{ background: '#0f172a' }}>
            <p className="text-orange-400 uppercase tracking-widest text-xs mb-3">Try It Live</p>
            <h2 className="text-3xl font-black mb-2">Walk Through HaulFlow Right Now</h2>
            <p className="text-gray-400 text-sm mb-8">Fill this out and we'll drop you straight into a live dispatch board with real loads, drivers, and invoices. No download, no credit card.</p>

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
                  <option value="1">Just me — 1 truck</option>
                  <option value="2-5">2–5 trucks</option>
                  <option value="6-15">6–15 trucks</option>
                  <option value="16-50">16–50 trucks</option>
                  <option value="50+">50+ trucks</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Anything else?</label>
                <textarea name="notes" rows={3} onChange={handleChange} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500" placeholder="Tell us about your operation…" />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={sending} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-4 text-lg transition-colors disabled:opacity-60">
                {sending ? 'Starting your demo…' : 'Launch the Live Demo'}
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
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} Turtle Logistics LLC. Built by carriers, for carriers.</p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <a href="https://haulflow.turtlelogisticsllc.com/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Privacy Policy</a>
            <span className="text-gray-700">·</span>
            <a href="https://haulflow.turtlelogisticsllc.com/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Terms of Service</a>
          </div>
        </div>
      </footer>

      <InteractiveAvatar />
    </div>
  );
}
