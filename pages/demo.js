import { useState } from "react";
import Layout from "../components/Layout";

const fields = [
  { name: "name",      label: "Full Name",       type: "text",  placeholder: "Jane Smith",          required: true },
  { name: "email",     label: "Work Email",      type: "email", placeholder: "jane@yourcompany.com", required: true },
  { name: "company",   label: "Company Name",    type: "text",  placeholder: "Smith Trucking LLC",   required: true },
  { name: "phone",     label: "Phone Number",    type: "tel",   placeholder: "(555) 000-0000",       required: false },
  { name: "fleetSize", label: "Fleet Size",      type: "text",  placeholder: "e.g. 5 trucks",        required: true },
  { name: "notes",     label: "Anything else we should know?", type: "textarea", placeholder: "Current software, biggest pain points, timeline…", required: false },
];

export default function Demo() {
  const [form, setForm] = useState(
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await fetch("/api/demoSignup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Always redirect — even if email has a hiccup, let the prospect in
      window.location.href = "/demo/app";
    } catch {
      setError("Something went wrong. Please try again.");
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-16 px-4 grid md:grid-cols-2 gap-16 items-start">

        {/* LEFT: pitch */}
        <div className="pt-2">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
            Free Demo
          </p>
          <h1
            className="text-4xl font-black mb-5 leading-tight"
            style={{ letterSpacing: "-0.03em" }}
          >
            See HaulFlow in{" "}
            <span className="text-blue-400">action</span>
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Fill in the quick form and you&apos;ll immediately get access to a live
            HaulFlow demo — real dispatch board, GPS map, invoicing, and more.
            No credit card. No sales call required.
          </p>

          <div className="space-y-4">
            {[
              { icon: "✓", text: "Live dispatch board with sample loads" },
              { icon: "✓", text: "GPS tracking map" },
              { icon: "✓", text: "Invoice & payment flow demo" },
              { icon: "✓", text: "Driver portal preview" },
              { icon: "✓", text: "IFTA mileage reports" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-gray-300">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
                >
                  {item.icon}
                </span>
                {item.text}
              </div>
            ))}
          </div>

          <div
            className="mt-10 p-4 rounded-xl border text-sm text-gray-400"
            style={{ background: "#1a1d21", borderColor: "#2a2d35" }}
          >
            <span className="font-semibold text-white">$350/mo flat.</span>{" "}
            Unlimited users. All features. No per-seat fees, ever.
          </div>
        </div>

        {/* RIGHT: form */}
        <div
          className="rounded-2xl border p-8"
          style={{ background: "#1a1d21", borderColor: "#2a2d35" }}
        >
          <h2 className="text-xl font-bold mb-1">Request your demo</h2>
          <p className="text-gray-500 text-sm mb-6">
            Takes 30 seconds — you&apos;ll see the live app right away.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {f.label}{" "}
                  {!f.required && (
                    <span className="text-gray-600 normal-case font-normal tracking-normal">
                      (optional)
                    </span>
                  )}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg text-sm bg-[#111418] border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 resize-none transition-colors"
                  />
                ) : (
                  <input
                    type={f.type}
                    name={f.name}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    required={f.required}
                    className="w-full px-4 py-3 rounded-lg text-sm bg-[#111418] border border-gray-700 focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-colors"
                  />
                )}
              </div>
            ))}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5 text-base"
              style={{ boxShadow: "0 4px 16px rgba(59,130,246,0.25)" }}
            >
              {sending ? "Loading your demo…" : "View Live Demo →"}
            </button>

            <p className="text-center text-xs text-gray-600">
              No credit card · No commitment · Instant access
            </p>
          </form>
        </div>

      </div>
    </Layout>
  );
}
