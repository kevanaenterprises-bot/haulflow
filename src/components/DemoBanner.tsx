import { useState, useEffect } from 'react';
import { Zap, X, ArrowRight } from 'lucide-react';

function getSecondsLeft(): number {
  const exp = localStorage.getItem('hf_demo_expires_at');
  if (!exp) return 0;
  return Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000));
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  onExpired: () => void;
}

export default function DemoBanner({ onExpired }: Props) {
  const demoExpiry = localStorage.getItem('hf_demo_expires_at');
  const [secs, setSecs] = useState(getSecondsLeft);
  const [dismissed, setDismissed] = useState(false);

  // Not a demo session
  if (!demoExpiry) return null;

  useEffect(() => {
    const id = setInterval(() => {
      const left = getSecondsLeft();
      setSecs(left);
      if (left === 0) {
        clearInterval(id);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [onExpired]);

  if (dismissed) return null;

  const urgent = secs < 300; // last 5 minutes

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 py-2.5 text-sm font-medium shadow-lg"
      style={{
        background: urgent
          ? 'linear-gradient(90deg, #7f1d1d, #991b1b)'
          : 'linear-gradient(90deg, #1e3a8a, #1d4ed8)',
        borderBottom: `1px solid ${urgent ? '#b91c1c' : '#2563eb'}`,
      }}
    >
      {/* Left: label + timer */}
      <div className="flex items-center gap-3 text-white">
        <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="font-semibold">Demo Sandbox</span>
        <span className="text-blue-200 hidden sm:inline">—</span>
        <span className={`hidden sm:inline ${urgent ? 'text-red-200' : 'text-blue-200'}`}>
          You're exploring a pre-loaded demo. Your changes don't save.
        </span>
      </div>

      {/* Center: countdown */}
      <div
        className={`flex items-center gap-2 px-4 py-1 rounded-full font-mono font-bold text-base tabular-nums ${
          urgent
            ? 'bg-red-900 text-red-200 border border-red-700'
            : 'bg-blue-900 text-white border border-blue-600'
        }`}
      >
        <span className="text-xs font-sans font-semibold opacity-70 mr-1">expires in</span>
        {fmt(secs)}
      </div>

      {/* Right: CTA + dismiss */}
      <div className="flex items-center gap-3">
        <a
          href="/onboard"
          className="hidden sm:flex items-center gap-1.5 bg-white text-blue-800 hover:bg-blue-50 font-bold px-4 py-1.5 rounded-full text-xs transition-colors"
        >
          Get Full Access <ArrowRight className="w-3.5 h-3.5" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
