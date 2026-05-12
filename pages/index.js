import Link from "next/link";
import Layout from "../components/Layout";

export default function Home() {
  return (
    <Layout>

      {/* ── HERO ── */}
      <section className="relative text-center py-28 px-4 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span
            className="inline-block mb-5 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "#60a5fa",
            }}
          >
            🚛 Built by a carrier owner
          </span>
          <h1
            className="text-5xl md:text-6xl font-black mb-6 leading-tight"
            style={{ letterSpacing: "-0.03em" }}
          >
            Dispatch smarter.{" "}
            <span className="text-blue-400">Get paid faster.</span>
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            HaulFlow keeps your loads, drivers, and cash flow in motion — from
            first dispatch to final payment. Everything included. No per-seat
            fees. No locked features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-9 py-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5 shadow-lg text-base"
              style={{ boxShadow: "0 8px 24px rgba(59,130,246,0.25)" }}
            >
              Request a Demo
            </Link>
            <a
              href="#features"
              className="text-gray-300 hover:text-white font-semibold px-9 py-4 rounded-xl border border-gray-700 hover:border-blue-500 transition-all duration-150 text-base"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-10 text-xs text-gray-600 uppercase tracking-widest">
            All features included &nbsp;·&nbsp; Unlimited users &nbsp;·&nbsp; $350/mo flat
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
            What&apos;s inside
          </p>
          <h2
            className="text-center text-3xl md:text-4xl font-extrabold mb-4"
            style={{ letterSpacing: "-0.025em" }}
          >
            Every tool your operation needs
          </h2>
          <p className="text-center text-gray-400 mb-14 max-w-lg mx-auto">
            One flat rate. No tiers. No add-ons. Everything below ships on day one.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "📋",
                title: "Load Management",
                desc: "Create, assign, and track every load from pickup to proof of delivery with full status history.",
              },
              {
                icon: "📍",
                title: "Live GPS Tracking",
                desc: "Real-time driver locations on a live map. Know exactly where every truck is at any moment.",
              },
              {
                icon: "💵",
                title: "Invoicing & Payments",
                desc: "Generate invoices the moment a load is delivered. Track aging, send reminders, and log payments.",
              },
              {
                icon: "📱",
                title: "SMS Dispatch",
                desc: "Push load details directly to your driver's phone via SMS — no app download required.",
              },
              {
                icon: "🧑‍✈️",
                title: "Driver Portal",
                desc: "Drivers accept loads, upload BOL photos, and update statuses from any device.",
              },
              {
                icon: "⛽",
                title: "IFTA Reporting",
                desc: "Automatic mileage tracking by state so your quarterly IFTA filing takes minutes, not days.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-7 border border-gray-800 hover:border-blue-500 transition-colors duration-200"
                style={{ background: "#1a1d21" }}
              >
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="text-white font-bold mb-2 text-base">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY HAULFLOW ── */}
      <section className="py-24 px-4" style={{ background: "#111418" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
              Why switch?
            </p>
            <h2
              className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Stop paying $700+/mo for{" "}
              <span className="text-blue-400">half a product</span>
            </h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Most TMS platforms lock their best features behind expensive add-ons
              and per-seat fees. HaulFlow was built by someone who lived that
              frustration — so we flipped the model entirely.
            </p>
            <div className="space-y-3">
              {[
                "All features included — no add-on fees",
                "Unlimited users at no extra cost",
                "No long-term contracts",
                "Built by a real carrier owner",
                "Runs on any device, no installs",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-blue-400 font-bold">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl p-8 border relative overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #1a1d21, #111820)",
              borderColor: "rgba(59,130,246,0.3)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 70% 0%, rgba(59,130,246,0.1) 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
                Simple Pricing
              </p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-black text-white">$350</span>
                <span className="text-gray-400 text-lg">/mo</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Flat rate · Unlimited users · Everything included
              </p>
              <div className="space-y-2 mb-8">
                {[
                  "Load management",
                  "Live GPS tracking",
                  "Invoicing & payments",
                  "SMS dispatch",
                  "Driver portal",
                  "IFTA reporting",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-blue-400">✓</span> {item}
                  </div>
                ))}
              </div>
              <Link
                href="/demo"
                className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all duration-150 hover:-translate-y-0.5"
              >
                Request a Demo →
              </Link>
              <p className="text-center text-xs text-gray-600 mt-3">
                No credit card required to demo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
            How it works
          </p>
          <h2
            className="text-3xl md:text-4xl font-extrabold mb-14"
            style={{ letterSpacing: "-0.025em" }}
          >
            Up and running in minutes
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {
                step: "01",
                title: "Request a Demo",
                desc: "Fill in a quick form and we'll set up your HaulFlow account with a personalized walkthrough.",
              },
              {
                step: "02",
                title: "Add Your Drivers & Loads",
                desc: "Import your driver list and create your first loads. Most carriers are live within the hour.",
              },
              {
                step: "03",
                title: "Dispatch & Get Paid",
                desc: "Send loads via SMS, track in real time, generate invoices on delivery, and watch cash flow in.",
              },
            ].map((s) => (
              <div key={s.step}>
                <div
                  className="text-6xl font-black mb-4"
                  style={{ color: "rgba(59,130,246,0.15)", letterSpacing: "-0.05em" }}
                >
                  {s.step}
                </div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section
        className="py-24 px-4 text-center rounded-3xl mx-4 mb-12"
        style={{
          background: "linear-gradient(135deg, #1a1d21, #111820)",
          border: "1px solid rgba(59,130,246,0.2)",
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4">
          Ready to roll?
        </p>
        <h2
          className="text-3xl md:text-4xl font-extrabold mb-4"
          style={{ letterSpacing: "-0.025em" }}
        >
          Get a personalized demo today
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          See HaulFlow in action with your own loads and drivers. Takes less than 10 minutes.
        </p>
        <Link
          href="/demo"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5 text-base"
          style={{ boxShadow: "0 8px 24px rgba(59,130,246,0.25)" }}
        >
          Request a Demo →
        </Link>
      </section>

    </Layout>
  );
}
