import InteractiveAvatar from '../components/avatar/InteractiveAvatar';
import React, { useState } from 'react';
import { Truck, CheckCircle, MapPin, FileText, CreditCard, MessageSquare, Gauge, Users, ChevronDown, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

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
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    // 1) Capture the lead for sales (Vercel function — fire and forget, never blocks).
    fetch('/api/demo-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => {});

    // 2) Spin up the live demo on the backend and log the visitor in.
    try {
      const data = await api.post('/api/demo/start', form);
      localStorage.setItem('hf_token', data.token);
      localStorage.setItem('hf_demo_expires_at', data.demo_expires_at);
      localStorage.setItem('hf_user', JSON.stringify(data.user));
      localStorage.setItem('hf_company', JSON.stringify({ id: data.user.company_id, name: data.user.company_name }));
      // Hard redirect so AuthProvider re-reads localStorage and boots into the Command Center.
      window.location.href = '/';
    } catch (err: any) {
      setSending(false);
      setError('Sorry — we could not start the demo just now. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

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
              Turtle Logistics LLC has been running trucks across America for years. We got tired of TMS platforms built by people who never dispatched a load — so we built our own.
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

      <section className="px-6 py-24" style={{ background: '#030712' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-gray-800 p-8" style={{ background: '#0f172a' }}>
            <p className="text-orange-400 uppercase tracking-widest text-xs mb-3">Try It Live</p>
            <h2 className="text-3xl font-black mb-2">Walk Through HaulFlow Right Now</h2>
            <p className="text-gray-400 text-sm mb-8">Fill this out and we'll drop you straight into a live dispatch board with real loads moving. No download, no credit card.</p>

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

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button type="submit" disabled={sending} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full py-4 text-lg transition-colors disabled:opacity-60">
                {sending ? 'Starting your demo…' : 'Launch the Live Demo'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span className="font-bold">HaulFlow</span>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} Turtle Logistics LLC. Built by carriers, for carriers.</p>
        </div>
      </footer>

      <InteractiveAvatar />
    </div>
  );
}
