import { useEffect } from 'react';
import { Truck, ArrowRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const META_DESC = 'HaulFlow vs TruckSmarter vs RigBooks vs TruckLogics — honest TMS comparison for owner-operators and small fleets. See pricing, features, and why HaulFlow is the best free dispatch software.';

export default function ComparePage() {
  useEffect(() => {
    document.title = 'HaulFlow vs TruckSmarter vs RigBooks vs TruckLogics — Best Free TMS Comparison';
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

  const comparisonRows = [
    { feature: 'Free Tier Available', haulflow: true, trucksmarter: false, rigbooks: false, trucklogics: false, labels: ['Yes — full free tier for first users', 'No (free trial only)', 'No (free trial only)', 'No (free trial only)'] },
    { feature: 'Starting Price', haulflow: true, trucksmarter: false, rigbooks: false, trucklogics: false, labels: ['Free', '~$15–$30/mo', '~$25–$40/mo', '~$35–$75/mo'], isPrice: true },
    { feature: 'Driver Mobile App', haulflow: true, trucksmarter: true, rigbooks: true, trucklogics: true, labels: ['Android app with voice AI', 'Mobile app', 'Mobile app', 'Mobile app'] },
    { feature: 'Voice-Assisted Dispatch', haulflow: true, trucksmarter: false, rigbooks: false, trucklogics: false, labels: ['ElevenLabs integration', 'Not available', 'Not available', 'Not available'] },
    { feature: 'Automated Invoicing', haulflow: true, trucksmarter: true, rigbooks: true, trucklogics: true, labels: ['Built-in', 'Available', 'Available', 'Available'] },
    { feature: 'DVIR Inspections', haulflow: true, trucksmarter: true, rigbooks: true, trucklogics: true, labels: ['Digital DVIR', 'Available', 'Available', 'Available'] },
    { feature: 'IFTA Reporting', haulflow: true, trucksmarter: true, rigbooks: true, trucklogics: true, labels: ['Automated', 'Available', 'Available', 'Available'] },
    { feature: 'Fleet Map / GPS Tracking', haulflow: true, trucksmarter: false, rigbooks: false, trucklogics: true, labels: ['Live fleet map', 'Limited', 'Limited', 'Available'] },
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
          <p className="text-orange-400 font-semibold uppercase tracking-widest text-xs mb-4">TMS Comparison Guide</p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-6">
            HaulFlow vs TruckSmarter vs RigBooks vs{' '}
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TruckLogics</span>
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-6 max-w-3xl">
            Choosing the right transportation management system (TMS) is one of the most important decisions an owner-operator or small trucking company can make. The wrong choice means wasted money, steep learning curves, and features you never use.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed max-w-3xl">
            This comparison breaks down four popular trucking management platforms — <strong className="text-white">HaulFlow</strong>, <strong className="text-white">TruckSmarter</strong>, <strong className="text-white">RigBooks</strong>, and <strong className="text-white">TruckLogics</strong> — with an honest look at strengths, weaknesses, and pricing.
          </p>
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="px-6 py-16" style={{ background: '#0a0a0f' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Quick Comparison</span> Overview
          </h2>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-800" style={{ background: '#111' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-4 font-semibold text-gray-400">Feature</th>
                  <th className="p-4 font-bold text-orange-400">HaulFlow</th>
                  <th className="p-4 font-semibold">TruckSmarter</th>
                  <th className="p-4 font-semibold">RigBooks</th>
                  <th className="p-4 font-semibold">TruckLogics</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i < comparisonRows.length - 1 ? 'border-b border-gray-800/50' : ''}>
                    <td className="p-4 font-semibold text-gray-300">{row.feature}</td>
                    {['haulflow', 'trucksmarter', 'rigbooks', 'trucklogics'].map((_, ci) => {
                      const val = row.haulflow && ci === 0 ? true : row.trucksmarter && ci === 1 ? true : row.rigbooks && ci === 2 ? true : row.trucklogics && ci === 3 ? true : false;
                      return (
                        <td key={ci} className={`p-4 text-center ${ci === 0 ? 'text-orange-300' : 'text-gray-400'}`}>
                          {row.isPrice ? (
                            <span className={ci === 0 ? 'text-orange-400 font-bold text-base' : ''}>{row.labels[ci]}</span>
                          ) : row.labels[ci] === 'Yes — full free tier for first users' || row.labels[ci] === 'ElevenLabs integration' || row.labels[ci] === 'Android app with voice AI' || row.labels[ci] === 'Live fleet map' || row.labels[ci] === 'Built-in' || row.labels[ci] === 'Digital DVIR' || row.labels[ci] === 'Automated' ? (
                            <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" />{row.labels[ci]}</span>
                          ) : row.labels[ci] === 'Limited' ? (
                            <span className="flex items-center justify-center gap-1.5"><AlertTriangle className="w-4 h-4 text-yellow-400" />{row.labels[ci]}</span>
                          ) : row.labels[ci] === 'Not available' || row.labels[ci] === 'No (free trial only)' ? (
                            <span className="flex items-center justify-center gap-1.5"><XCircle className="w-4 h-4 text-red-400/60" />{row.labels[ci]}</span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" />{row.labels[ci]}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="p-4 font-semibold text-gray-300">Best For</td>
                  <td className="p-4 text-center text-orange-300 text-xs">Owner-operators &amp; small fleets on a budget</td>
                  <td className="p-4 text-center text-gray-400 text-xs">Load finding &amp; fuel savings</td>
                  <td className="p-4 text-center text-gray-400 text-xs">QuickBooks-style bookkeeping</td>
                  <td className="p-4 text-center text-gray-400 text-xs">Mid-size fleets needing full ERP</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {comparisonRows.map((row) => (
              <div key={row.feature} className="rounded-xl border border-gray-800 p-4" style={{ background: '#111' }}>
                <h3 className="font-bold text-orange-400 mb-3">{row.feature}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'HaulFlow', val: row.labels[0], highlight: true },
                    { name: 'TruckSmarter', val: row.labels[1], highlight: false },
                    { name: 'RigBooks', val: row.labels[2], highlight: false },
                    { name: 'TruckLogics', val: row.labels[3], highlight: false },
                  ].map((col) => (
                    <div key={col.name} className={`rounded-lg p-2.5 ${col.highlight ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-gray-900'}`}>
                      <div className={`text-xs font-semibold mb-1 ${col.highlight ? 'text-orange-400' : 'text-gray-500'}`}>{col.name}</div>
                      <div className={`text-sm ${col.highlight ? 'text-white' : 'text-gray-300'}`}>{col.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HAULFLOW SECTION ── */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            HaulFlow — The Best <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Free TMS</span> for Owner-Operators
          </h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-8">
            HaulFlow (by Turtle Logistics LLC) is the standout choice in this comparison for one simple reason: <strong className="text-white">it offers a genuinely free tier</strong> that lets owner-operators and small trucking companies access a full-featured TMS without a subscription.
          </p>

          <h3 className="text-xl font-bold mb-4 text-orange-400">Strengths</h3>
          <ul className="space-y-3 mb-8">
            {[
              'Genuinely free for first users — not a time-limited trial. Use the platform without entering a credit card.',
              'Voice-powered driver experience using ElevenLabs AI voice technology. Drivers get spoken dispatch updates and load confirmations, improving safety and reducing screen time. No other competitor offers this.',
              'Automated invoicing that generates professional invoices from load data automatically — one of the strongest free invoicing tools for trucking.',
              'Complete compliance tools including digital DVIR inspections and automated IFTA fuel tax calculation.',
              'Android driver app with fleet map tracking, designed for simplicity and ease of use on the road.',
              'Low barrier to entry — perfect for owner-operators just getting their authority or small fleets scaling up from spreadsheets.',
            ].map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">{item}</span>
              </li>
            ))}
          </ul>

          <h3 className="text-xl font-bold mb-4 text-gray-400">Considerations</h3>
          <ul className="space-y-3 mb-8">
            {[
              'Newer platform with a smaller user community compared to more established competitors.',
              'Feature depth in areas like advanced analytics and full ERP integration is still growing.',
            ].map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-400">{item}</span>
              </li>
            ))}
          </ul>

          <p className="text-gray-300 text-lg leading-relaxed mb-6">
            <strong className="text-white">Bottom line:</strong> If you're an owner-operator or small fleet looking for the best free dispatch software and don't want to commit to a monthly subscription before you've proven the value, HaulFlow is the clear first choice.
          </p>
          <a href="/subscribe" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors">
            Try HaulFlow Free <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── TRUCKSMARTER ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-6">TruckSmarter — Strong for Load Finding, Not a Full TMS</h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            TruckSmarter is primarily known as a <strong className="text-white">load board and fuel savings tool</strong> rather than a comprehensive trucking management system. It helps owner-operators find loads, compare fuel prices, and plan routes.
          </p>

          <h3 className="text-xl font-bold mb-4 text-green-400">Strengths</h3>
          <ul className="space-y-3 mb-6">
            {['Good load board integration with competitive rate discovery.', 'Fuel price comparison tool helps drivers save at the pump.', 'Simple, easy-to-use mobile interface.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-gray-300">{item}</span></li>
            ))}
          </ul>

          <h3 className="text-xl font-bold mb-4 text-red-400">Weaknesses</h3>
          <ul className="space-y-3 mb-6">
            {['Not a full TMS — lacks comprehensive dispatch management, invoicing workflows, and fleet management features.', 'No free tier — requires a paid subscription after a short trial.', 'No voice-assisted features or advanced compliance tools like digital DVIR.', 'Limited IFTA and fleet tracking capabilities.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-400/60 flex-shrink-0 mt-0.5" /><span className="text-gray-400">{item}</span></li>
            ))}
          </ul>

          <p className="text-gray-300 text-lg leading-relaxed">
            <strong className="text-white">Bottom line:</strong> TruckSmarter is a solid companion tool for finding loads and saving on fuel, but it's not a replacement for a real truck management system. If you need full dispatch, invoicing, and compliance in one platform, look elsewhere.
          </p>
        </div>
      </section>

      {/* ── RIGBOOKS ── */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-6">RigBooks — Bookkeeping-Focused Trucking Software</h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            RigBooks positions itself as a <strong className="text-white">QuickBooks-style accounting and bookkeeping tool</strong> built specifically for truckers. It handles expense tracking, income logging, and basic financial reporting.
          </p>

          <h3 className="text-xl font-bold mb-4 text-green-400">Strengths</h3>
          <ul className="space-y-3 mb-6">
            {['Clean, intuitive bookkeeping interface familiar to users of accounting software.', 'Good expense categorization for trucking-specific costs (fuel, maintenance, insurance, etc.).', 'Simple reporting for understanding profit and loss per load or per truck.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-gray-300">{item}</span></li>
            ))}
          </ul>

          <h3 className="text-xl font-bold mb-4 text-red-400">Weaknesses</h3>
          <ul className="space-y-3 mb-6">
            {['No free tier — subscription required from day one after trial.', 'Limited dispatch management — not designed as a full dispatch software.', 'No voice features, no advanced fleet map, and limited DVIR/IFTA functionality.', 'Mobile app exists but is more focused on expense entry than driver operations.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-400/60 flex-shrink-0 mt-0.5" /><span className="text-gray-400">{item}</span></li>
            ))}
          </ul>

          <p className="text-gray-300 text-lg leading-relaxed">
            <strong className="text-white">Bottom line:</strong> RigBooks is a good fit if your primary pain point is bookkeeping and you already have a separate dispatch solution. If you want dispatch + invoicing + compliance + bookkeeping in one platform, it falls short.
          </p>
        </div>
      </section>

      {/* ── TRUCKLOGICS ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black mb-6">TruckLogics — Full-Featured but Expensive</h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            TruckLogics is a comprehensive TMS and trucking ERP system from the ITS (Infinity Transportation Solutions) family. It offers a wide range of features covering dispatch, invoicing, compliance, and fleet management.
          </p>

          <h3 className="text-xl font-bold mb-4 text-green-400">Strengths</h3>
          <ul className="space-y-3 mb-6">
            {['Broad feature set including dispatch, document management, fleet maintenance, and driver management.', 'Good compliance tools for DOT regulations, HOS tracking, and IFTA.', 'Integrations with ELD providers and other trucking technology platforms.', 'Well-established product with a sizable user base.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-gray-300">{item}</span></li>
            ))}
          </ul>

          <h3 className="text-xl font-bold mb-4 text-red-400">Weaknesses</h3>
          <ul className="space-y-3 mb-6">
            {['Expensive — pricing starts significantly higher than the other options, and costs scale quickly with users and features.', 'No free tier — only a limited-time free trial.', 'Complex interface — the breadth of features comes with a steeper learning curve, which can be overwhelming for a solo owner-operator.', 'No voice-assisted dispatch or AI-powered driver communication features.', 'Pricing structure may not be transparent without speaking to sales.'].map((item, i) => (
              <li key={i} className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-400/60 flex-shrink-0 mt-0.5" /><span className="text-gray-400">{item}</span></li>
            ))}
          </ul>

          <p className="text-gray-300 text-lg leading-relaxed">
            <strong className="text-white">Bottom line:</strong> TruckLogics is a solid choice for mid-size fleets (20+ trucks) that need an enterprise-style TMS and have the budget for it. For owner-operators and small fleets, it's overkill both in features and price.
          </p>
        </div>
      </section>

      {/* ── WHICH SHOULD YOU CHOOSE ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3 text-center">Summary</p>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">Which TMS Should You Choose?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: 'HaulFlow',
                color: 'orange',
                reasons: [
                  'You want a free TMS for your small trucking company or owner-operator business',
                  'You need free dispatch software without a subscription commitment',
                  'You value voice-assisted driver communication for safety and convenience',
                  'You want automated invoicing, DVIR, IFTA, and fleet tracking in one place',
                  "You're just starting out and need professional tools at zero cost",
                ],
              },
              {
                name: 'TruckSmarter',
                color: 'blue',
                reasons: [
                  'Your main need is load finding and fuel savings, not full fleet management',
                  "You're okay paying for a specialized tool and using something else for dispatch/invoicing",
                ],
              },
              {
                name: 'RigBooks',
                color: 'green',
                reasons: [
                  'Bookkeeping and expense tracking is your #1 priority',
                  'You already have a dispatch solution and just need accounting tools',
                ],
              },
              {
                name: 'TruckLogics',
                color: 'purple',
                reasons: [
                  'You run a mid-size to large fleet and need enterprise-level TMS features',
                  'You have the budget ($35–$75+/mo per user) and need advanced integrations',
                ],
              },
            ].map(({ name, color, reasons }) => (
              <div key={name} className={`rounded-2xl p-6 border ${color === 'orange' ? 'border-orange-500/50' : 'border-gray-800'}`} style={{ background: color === 'orange' ? '#1a0a00' : '#111' }}>
                <h3 className={`font-bold text-lg mb-4 ${color === 'orange' ? 'text-orange-400' : 'text-gray-300'}`}>
                  Choose <span className="text-white">{name}</span> if:
                </h3>
                <ul className="space-y-2.5">
                  {reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color === 'orange' ? 'text-orange-400' : 'text-gray-500'}`} />
                      <span className="text-gray-300">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE HAULFLOW ADVANTAGE ── */}
      <section className="px-6 py-20" style={{ background: '#0a0a0f' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-orange-400 uppercase tracking-widest text-xs mb-3">The HaulFlow Advantage</p>
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            Free Access <span style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Changes Everything</span>
          </h2>
          <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
            <p>
              For the vast majority of owner-operators and small trucking companies in the United States, <strong className="text-white">software cost is the #1 barrier to adopting a TMS</strong>. There are over 100,000 owner-operators and hundreds of thousands of small fleets running on paper, spreadsheets, and text messages — not because they don't want better tools, but because every TMS on the market charges monthly fees before they've earned their first dollar.
            </p>
            <p>
              <strong className="text-white">HaulFlow's free tier eliminates this barrier.</strong> An owner-operator can sign up today, dispatch their first load, complete a DVIR inspection, and send an automated invoice — all for free. As their business grows, they can upgrade to paid tiers with advanced features. But the entry point is genuinely free.
            </p>
            <p className="text-white font-semibold">
              No other platform in this comparison — and very few in the broader trucking software market — offers this. If you're comparing TMS platforms as an owner-operator or small fleet, HaulFlow deserves a hard look simply because it's the only one that lets you try (and actually use) the software for free.
            </p>
          </div>
          <div className="mt-10">
            <a href="/subscribe" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-full px-8 py-4 text-lg transition-colors">
              Get Started with HaulFlow — Free <ArrowRight className="w-5 h-5" />
            </a>
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
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/" className="hover:text-white transition-colors">Back to HaulFlow</a>
            <a href="/what-is-haulflow" className="hover:text-white transition-colors">What Is HaulFlow?</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} Turtle Logistics LLC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
