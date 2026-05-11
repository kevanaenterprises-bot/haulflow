import { useState } from "react";
import Layout from "../components/Layout";

export default function Demo() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    fleetSize: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/demoSignup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        window.location.href = "/demo/app";
      }
    } catch {
      alert("Something went wrong — try again.");
    } finally {
      setSending(false);
    }
  };

  if (submitted)
    return (
      <Layout>
        <div className="text-center py-32">
          <h2 className="text-2xl text-blue-400 font-bold">
            Submission successful.
          </h2>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <section className="max-w-lg mx-auto text-center py-12">
        <h1 className="text-3xl font-semibold mb-6 text-blue-400">
          Request Your Demo
        </h1>
        <p className="text-gray-400 mb-10">
          Fill this quick form — you'll instantly preview the HaulFlow Dispatch
          Demo.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 text-left bg-[#1a1d21] p-8 rounded-lg border border-gray-800"
        >
          {["name", "email", "company", "fleetSize"].map((field) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1 capitalize">
                {field}
              </label>
              <input
                type={field === "email" ? "email" : "text"}
                name={field}
                value={form[field]}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-[#111418] border border-gray-700 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 bg-[#111418] border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Submit & View Demo"}
          </button>
        </form>
      </section>
    </Layout>
  );
}
