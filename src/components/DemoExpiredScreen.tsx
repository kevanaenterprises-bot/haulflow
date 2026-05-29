import { Truck, Clock, ArrowRight, RotateCcw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

interface Props {
  onRestartDemo: () => void;
}

export default function DemoExpiredScreen({ onRestartDemo }: Props) {
  async function restart() {
    try {
      const res = await fetch(`${API_URL}/api/demo/start`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      localStorage.setItem('hf_token', data.token);
      localStorage.setItem('hf_user', JSON.stringify(data.user));
      localStorage.setItem('hf_company', JSON.stringify(data.company));
      localStorage.setItem('hf_demo_expires_at', data.demo_expires_at);
      onRestartDemo();
    } catch {
      alert('Could not restart demo. Please refresh and try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at top, #1e3a8a 0%, #030712 60%)' }}>

      {/* Animated clock icon */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-8 opacity-10">
        <Clock className="w-72 h-72 text-blue-400" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto text-center px-8">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/50">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-black text-2xl tracking-tight">HaulFlow</span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-gray-800 border border-gray-700 text-gray-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
          <Clock className="w-3.5 h-3.5" />
          Demo session expired
        </div>

        <h1 className="text-4xl font-black text-white mb-4 leading-tight">
          How'd that feel?
        </h1>

        <p className="text-gray-400 text-lg mb-3 leading-relaxed">
          You just ran a full trucking operation — loads dispatched, drivers tracked,
          invoices generated, IFTA data logged.
        </p>
        <p className="text-gray-300 text-lg font-semibold mb-10">
          Now imagine it's your actual data.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a
            href="/onboard"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-4 rounded-2xl transition-all hover:-translate-y-0.5 text-base"
            style={{ boxShadow: '0 6px 25px rgba(37,99,235,0.45)' }}
          >
            Get Full Access — $350/mo <ArrowRight className="w-5 h-5" />
          </a>

          <button
            onClick={restart}
            className="flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-semibold px-6 py-4 rounded-2xl transition-all text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Run the sandbox again
          </button>
        </div>

        {/* Social proof */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          {['No long-term contracts', 'Cancel anytime', 'Live in under 30 minutes'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t}
            </span>
          ))}
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-700 mt-10">
          A product of Turtle Logistics LLC · Built by carriers, for carriers.
        </p>
      </div>
    </div>
  );
}
