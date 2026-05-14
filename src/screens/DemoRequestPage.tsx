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
          backgroundImage: 'url(/haulflow-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      >
        {/* gradient overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(3,7,18,0.92) 100%)'
        }} />

        {/* NAV */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/50">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight">HaulFlow</span>
              <span className="block text-xs text-blue-300 leading-none -mt-0.5">by Turtle Logistics LLC</span>
            </div>
          </div>
          <a
            href="#demo-form"
            className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.4)' }}
          >
            Get Demo Access <ArrowRight className="w-4 h-4" />
          </a>
        </nav>

        {/* HERO COPY */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-4">
            Your Co-pilot on Every Mile
          </p>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-none" style={{ letterSpacing: '-0.04em' }}>
            HaulFlow
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 font-light max-w-xl leading-relaxed">
            The TMS built from the driver seat — not a boardroom.
          </p>
          <a
            href="#demo-form"
            className="mt-10 inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl text-lg font-bold transition-all hover:-translate-y-1"
            style={{ boxShadow: '0 8px 30px rgba(37,99,235,0.5)' }}
          >
            See It In Action <ArrowRight className="w-5 h-5" />
          </a>
        </div>

        {/* scroll hint */}
        <div className="relative z-10 flex justify-center pb-8 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ── ORIGIN STORY ─────────────────────────────────────── */}
      <section className="bg-gray-950 px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-4">Our Story</p>
          <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight" style={{ letterSpacing: '-0.03em' }}>
            We built this because<br />
            <span className="text-blue-400">we lived the problem.</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5 text-gray-300 text-lg leading-relaxed">
              <p>
                Turtle Logistics LLC has been running trucks across America for years. And for years, we paid for TMS platforms that were built by people who had never dispatched a single load.
              </p>
              <p>
                Features locked behind expensive tiers. Interfaces that took weeks to train. Support that disappeared after the contract was signed. We kept asking ourselves — <em className="text-white not-italic font-semibold">why doesn't software like this exist?</em>
              </p>
              <p>
                So we stopped waiting. We built HaulFlow — from the road up, by people who know exactly what it feels like to have a driver stranded at a shipper at 2am with no way to reach dispatch.
              </p>
            </div>

            <div className="rounded-2xl p-8 border border-blue-900/50" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-600 p-2.5 rounded-xl">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-white">Turtle Logistics LLC</p>
                  <p className="text-xs text-blue-300">Parent Company</p>
                </div>
              </div>
              <blockquote className="text-gray-300 italic text-lg leading-relaxed border-l-2 border-blue-500 pl-5">
                "Every feature in HaulFlow exists because we needed it ourselves. If it's in there, it's because it saved us time, money, or a headache on a real load."
              </blockquote>
              <p className="mt-4 text-sm text-gray-500">— Kevin Owen, Founder · Turtle Logistics LLC</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ─────────────────────────────────────── */}
      <section className="bg-gray-900 px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Everything Included</p>
            <h2 className="text-4xl font-black mb-4" style={{ letterSpacing: '-0.03em' }}>
              One price. No add-ons. No surprises.
            </h2>
            <div className="inline-flex items-baseline gap-2 mt-6 bg-blue-950 border border-blue-800 px-6 py-3 rounded-2xl">
              <span className="text-4xl font-black text-white">$350</span>
              <span className="text-gray-400 text-lg">/mo</span>
              <span className="text-sm text-blue-300 ml-3">· All features · Unlimited users · No contracts</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl p-6 border border-gray-800 hover:border-blue-800 transition-all hover:-translate-y-1"
                style={{ background: '#111827' }}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-900 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <p className="font-bold text-white mb-2">{label}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {['No credit card required', 'No long-term contracts', 'Live in under 30 minutes', 'Built-in onboarding walkthrough'].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROAD TOUR ────────────────────────────────────────── */}
      <section className="relative px-6 py-24 overflow-hidden" style={{ background: '#0a0a0f' }}>
        {/* ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(251,146,60,0.08) 0%, transparent 70%)'
        }} />

        <div className="relative max-w-5xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-amber-950 border border-amber-800 text-amber-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
              <Heart className="w-3.5 h-3.5" /> Exclusive to HaulFlow · No other TMS has this
            </span>
          </div>

          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-6xl font-black mb-5 leading-tight" style={{ letterSpacing: '-0.04em' }}>
              Introducing{' '}
              <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Road Tour
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              A way to say <em className="not-italic font-bold text-white">thank you</em> to the people who keep America moving — at zero cost to you or them.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            {/* Story */}
            <div className="space-y-6 text-gray-300 text-lg leading-relaxed">
              <p>
                There are over <span className="text-white font-bold">226,000 historical markers</span> scattered across America — from Revolutionary War battlefields to forgotten railroad towns to civil rights landmarks. Most drivers pass them every day without ever knowing what's there.
              </p>
              <p>
                Road Tour changes that. As a driver rolls down the highway and approaches a historical marker, <span className="text-white font-bold">a voice automatically comes on</span> and tells the story of that exact location — what happened there, who lived there, why it matters.
              </p>
              <p>
                Drivers spend weeks away from their families, sleeping in their cab, grinding through weather and traffic and long nights. Road Tour is our way of making those miles feel less lonely — and honoring the sacrifice they make every single day to supply this country.
              </p>
            </div>

            {/* Feature cards */}
            <div className="space-y-4">
              {[
                {
                  icon: MapPin,
                  title: '226,000+ markers',
                  desc: 'Every state. Every highway. From the Alaskan wilderness to the Florida Keys.',
                  color: 'text-amber-400',
                  bg: 'bg-amber-950',
                  border: 'border-amber-900',
                },
                {
                  icon: Volume2,
                  title: 'Automatic voice narration',
                  desc: 'No buttons to press. As the driver approaches, the story plays — just like a real tour guide in the cab.',
                  color: 'text-orange-400',
                  bg: 'bg-orange-950',
                  border: 'border-orange-900',
                },
                {
                  icon: BookOpen,
                  title: 'Real history, not trivia',
                  desc: 'Sourced from official historical registries. The real stories of the people and places that shaped America.',
                  color: 'text-yellow-400',
                  bg: 'bg-yellow-950',
                  border: 'border-yellow-900',
                },
                {
                  icon: Heart,
                  title: 'Completely free. Always.',
                  desc: 'No add-on. No subscription tier. Built into every HaulFlow driver portal because drivers deserve more than a blank windshield.',
                  color: 'text-red-400',
                  bg: 'bg-red-950',
                  border: 'border-red-900',
                },
              ].map(({ icon: Icon, title, desc, color, bg, border }) => (
                <div key={title} className={`flex gap-4 rounded-2xl p-5 border ${border}`} style={{ background: '#111' }}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className="font-bold text-white mb-1">{title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom callout */}
          <div className="rounded-2xl p-8 text-center border border-amber-900/40" style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #0f0800 100%)' }}>
            <p className="text-amber-400 text-sm font-bold uppercase tracking-widest mb-3">The Bottom Line</p>
            <p className="text-2xl md:text-3xl font-black text-white leading-snug" style={{ letterSpacing: '-0.02em' }}>
              No other TMS in the world does this.<br />
              <span className="text-amber-400">And we built it for free — because it was the right thing to do.</span>
            </p>
          </div>
        </div>
      </section>


      {/* ── DEMO FORM ────────────────────────────────────────── */}
      <section id="demo-form" className="bg-gray-950 px-6 py-24">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-16 items-start">

          {/* Left: CTA copy */}
          <div className="lg:sticky lg:top-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-4">Free Demo</p>
            <h2 className="text-4xl font-black mb-5 leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Talk to someone<br />
              <span className="text-blue-400">who's been in your seat.</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              Fill in your info and you'll go straight into HaulFlow — no waiting, no sales call required. We'll follow up personally because we actually care if it works for you.
            </p>

            <div className="space-y-4">
              {[
                { title: 'Instant access', body: 'You go straight into the live platform after submitting.' },
                { title: 'Personal follow-up', body: 'Kevin or someone from the Turtle Logistics team will reach out directly.' },
                { title: 'No pressure', body: 'We only win if HaulFlow actually makes your operation better.' },
              ].map(({ title, body }) => (
                <div key={title} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white text-sm">{title}</p>
                    <p className="text-gray-500 text-sm">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="rounded-2xl border border-gray-800 p-8" style={{ background: '#0f172a' }}>
            <h3 className="text-xl font-bold mb-1">Request demo access</h3>
            <p className="text-gray-500 text-sm mb-7">You'll go straight into HaulFlow — no waiting.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="name" value={form.name} onChange={handleChange} required
                    placeholder="Jane Smith"
                    className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" name="company" value={form.company} onChange={handleChange} required
                    placeholder="Smith Trucking LLC"
                    className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email" name="email" value={form.email} onChange={handleChange} required
                  placeholder="jane@smithtrucking.com"
                  className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="tel" name="phone" value={form.phone} onChange={handleChange}
                    placeholder="(555) 000-0000"
                    className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Fleet Size <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="fleetSize" value={form.fleetSize} onChange={handleChange} required
                    className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white transition-colors"
                  >
                    <option value="">Select…</option>
                    <option value="1-3">1–3 trucks</option>
                    <option value="4-10">4–10 trucks</option>
                    <option value="11-25">11–25 trucks</option>
                    <option value="26-50">26–50 trucks</option>
                    <option value="50+">50+ trucks</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Current software / biggest pain point
                  <span className="text-gray-600 normal-case font-normal tracking-normal ml-1">(optional)</span>
                </label>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange}
                  placeholder="What TMS are you using now? What's driving you crazy about it?"
                  rows={3}
                  className="w-full px-3.5 py-3 rounded-xl text-sm bg-gray-900 border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all duration-150 hover:-translate-y-0.5 text-base tracking-tight"
                style={{ boxShadow: '0 6px 25px rgba(37,99,235,0.45)' }}
              >
                {sending ? 'Getting your demo ready…' : 'Get Instant Demo Access →'}
              </button>

              <p className="text-center text-xs text-gray-600">
                No credit card · No commitment · You'll be inside HaulFlow in seconds
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-10">
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
      {/* Interactive Avatar (HeyGen) - floating chat widget */}
      <InteractiveAvatar />
    </div>
  );
}
