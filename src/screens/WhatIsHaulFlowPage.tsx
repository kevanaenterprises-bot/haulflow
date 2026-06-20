import { useEffect } from 'react';
import { Truck, ArrowRight, CheckCircle, Smartphone, Mic, FileText, Wrench, Fuel, Map, TruckIcon } from 'lucide-react';

const META_DESC = 'HaulFlow is a free truck management system (TMS) for owner-operators and small trucking companies. Dispatch, invoicing, DVIR, IFTA, GPS fleet tracking, and a voice-powered Android driver app — all free.';

export default function WhatIsHaulFlowPage() {
  useEffect(() => {
    document.title = 'What Is HaulFlow? Free TMS for Owner-Operators & Small Fleets';
    const existing = document.querySelector('meta[name="description"]');
    if (existing) {
      existing.setAttribute('content', META_DESC);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = META_DESC;
      document.head.appendChild(meta);
    }
  }, []);

  const features = [
    { icon: Smartphone, label: 'Truck Management System with Android Driver App', desc: 'HaulFlow includes a dedicated mobile driver app for Android that keeps drivers connected to dispatch, load details, and route information from the road. The app is designed for ease of use with a clean interface that doesn\'t distract drivers while they\'re behind the wheel.' },
    { icon: Mic, label: 'Voice-Powered Driver Experience', desc: 'Drivers can receive spoken dispatch updates, load confirmations, and navigation prompts through natural-sounding AI voice via ElevenLabs integration — reducing the need to look at a screen while driving. This voice-assisted dispatch system improves safety and keeps hands on the wheel.' },
    { icon: FileText, label: 'Automated Invoicing for Trucking Companies', desc: 'HaulFlow\'s automated invoicing system generates professional invoices automatically based on load data, rate confirmations, and delivery receipts. That means faster payments, fewer billing disputes, and less time spent on paperwork.' },
    { icon: Wrench, label: 'DVIR (Daily Vehicle Inspection Report) Management', desc: 'Stay DOT-compliant with digital DVIR inspections built right into the driver app. Drivers can complete pre-trip and post-trip inspections on their phone, flag defects, and submit reports to management instantly. No more paper forms to lose or file.' },
    { icon: Fuel, label: 'IFTA Fuel Tax Reporting and Calculation', desc: 'HaulFlow automates fuel purchase tracking, miles-by-state calculation, and quarterly IFTA reporting — saving hours of bookkeeping and reducing the risk of costly tax filing errors.' },
    { icon: Map, label: 'Live Fleet Map and Vehicle Tracking', desc: 'HaulFlow\'s fleet tracking map gives dispatchers and fleet managers real-time visibility into where every truck is, what load it\'s carrying, and its ETA. This GPS fleet tracking feature improves dispatch decisions, customer communication, and operational efficiency.' },
    { icon: TruckIcon, label: 'Full Dispatch Management', desc: 'From load sourcing to delivery confirmation, HaulFlow handles the complete dispatch workflow for trucking companies. Dispatchers can assign loads, track status, communicate with drivers, and manage documentation — all from one dashboard.' },
  ];

  const audiences = [
    'Owner-operators looking for free or low-cost trucking software to manage their business',
    'Small trucking companies (1–20 trucks) that need a professional TMS without enterprise pricing',
    'Independent dispatchers who manage loads for multiple owner-operators',
    'Startup trucking companies just getting their authority and needing their first management system',
    'Fleet managers who want modern tools with voice AI and mobile apps for their drivers',
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-gray-800/50">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Truck className="w-6 h-6 text-orange-400" />
            <span className="font-bold text-lg tracking-tight">HaulFlow</span>
          </a>
          <span className="hidden md:inline text-gray-600 text-sm">/</span>
          <a href="/" className="hidden md:inline text-sm text-gray-400 hover:text-white transition-colors">Back to HaulFlow</a>
        </div>
        <a href="/subscribe" className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-full px-5 py-2 text-sm transition-colors">
          Try HaulFlow Free <ArrowRight className="w-4 h-4" />
        </a>
      </nav>

      {/* ── HERO ── */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <p className="text-orange-400 font-semibold uppercase tracking-widest text-xs mb-4">Built by Turtle Logistics LLC</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            What Is <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HaulFlow</span>?
          </h1>
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-6 max-w-3xl">
            <strong className="text-white">HaulFlow</strong> is a modern, cloud-based <strong className="text-white">truck management system (TMS)</strong> designed specifically for <strong className="text-white">small trucking companies</strong>, <strong className="text-white">owner-operators</strong>, and <strong className="text-white">independent dispatchers</strong> who need professional-grade dispatch and fleet management tools — without paying enterprise-level software fees.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed max-w-3xl mb-10">
            HaulFlow offers a generous <strong className="text-white">free tier for first users</strong> — making it one of the only truly free TMS platforms available to owner-operators getting started in the trucking business.
          </p>
          <a href="/subscribe" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors">
            Try HaulFlow Free <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── WHY A TMS ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            Why Small Trucking Companies and Owner-Operators Need a TMS
          </h2>
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
            <p>
              Managing a trucking operation — even a single-truck business — involves dozens of moving parts: finding and booking loads, dispatching drivers, tracking vehicles in real time, completing <strong className="text-white">DVIR (Daily Vehicle Inspection Reports)</strong>, calculating <strong className="text-white">IFTA fuel taxes</strong>, generating invoices for brokers and shippers, and maintaining compliance records.
            </p>
            <p>
              Most transportation management systems on the market cost <strong className="text-white">$150–$500+ per month per user</strong>, pricing out the very people who need help most.
            </p>
            <p className="text-white font-semibold text-xl">
              HaulFlow changes that equation. It provides a full-featured trucking dispatch software with a free entry point, so owner-operators and small fleets can access the same technology that mid-size carriers use — without breaking the bank.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">Core Features</p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Everything</span> You Need to Run Your Fleet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl p-6 border border-gray-800 hover:border-orange-500/40 transition-colors" style={{ background: '#111' }}>
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

      {/* ── WHO IT'S FOR ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">Built For</p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">Who Is HaulFlow Built For?</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {audiences.map((a, i) => (
              <div key={i} className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300 text-lg">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY FREE MATTERS ── */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            Free TMS for Small Trucking Companies — Why It Matters
          </h2>
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
            <p>
              The trucking industry has thousands of owner-operators and small fleets running their businesses on spreadsheets, text messages, and paper logs. This isn't just inefficient — it's a compliance risk and a competitive disadvantage.
            </p>
            <p>
              Most TMS vendors offer "free trials" that expire in 14–30 days, forcing users onto paid plans before they've even gotten comfortable with the software. <strong className="text-white">HaulFlow's free tier for first users removes this barrier entirely</strong>, letting trucking professionals adopt the platform at their own pace and only upgrade when their operation grows.
            </p>
          </div>
        </div>
      </section>

      {/* ── VS PAID TMS ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            How HaulFlow Compares to Paid TMS Platforms
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-6">
            While established platforms like <strong className="text-white">TruckSmarter</strong>, <strong className="text-white">RigBooks</strong>, <strong className="text-white">TruckLogics</strong>, <strong className="text-white">Axon</strong>, and <strong className="text-white">Samsara</strong> offer capable tools, they typically require monthly subscriptions ranging from $30 to $300+ per user.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            HaulFlow delivers comparable core functionality — dispatch management, automated invoicing, DVIR, IFTA, fleet tracking, and a driver mobile app — with a free entry tier that makes it the most accessible option for owner-operators and small carriers.
          </p>
        </div>
      </section>

      {/* ── GETTING STARTED ── */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3">Get Started</p>
          <h2 className="text-3xl md:text-4xl font-black mb-8">
            Getting Started with <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HaulFlow</span>
          </h2>
          <div className="space-y-4 mb-10">
            {[
              'Visit haulflow.turtlelogisticsllc.com',
              'Create a free account on the free tier for first users',
              'Set up your company profile, add your truck(s) and driver(s)',
              'Start dispatching loads, completing DVIR inspections, and generating invoices',
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 font-bold text-sm">{i + 1}</div>
                <p className="text-gray-300 text-lg pt-1">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-400 mb-8 text-lg">
            No credit card required. No 14-day countdown timer. Just a free truck management system ready to work for your business.
          </p>
          <a href="/subscribe" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors">
            Try HaulFlow Free <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span className="font-bold">HaulFlow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/" className="hover:text-white transition-colors">Back to HaulFlow</a>
            <a href="/compare" className="hover:text-white transition-colors">Compare TMS Platforms</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} Turtle Logistics LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
