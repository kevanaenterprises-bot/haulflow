import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

// ─── Working Hours Logic ────────────────────────────────────────────────────
const WORKING_HOURS_START = 8;  // 8 AM Central Time
const WORKING_HOURS_END = 18;   // 6 PM Central Time

function getCentralHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  );
}

function isWithinWorkingHours(): boolean {
  // TEST OVERRIDE: Always return true (bypass 8AM–6PM Central Time check)
  return true;
}

function getNextOpenTime(): string {
  const hour = getCentralHour();
  if (hour >= WORKING_HOURS_END) {
    return '8:00 AM tomorrow';
  }
  return '8:00 AM';
}

// ─── Kristy's profile picture URL ──────────────────────────────────────────
const KRISTY_AVATAR_URL =
  'https://customer-assets.emergentAgent.com/wingman/6bc070fc-a70c-40b9-ab7e-ce8bf7ccc7ff/attachments/c0ce6e9e6ba64ff88b6e093e3969342b_kristy-avatar.png';

// ─── LiveAvatar iframe URL ──────────────────────────────────────────────────
const LIVEAVATAR_IFRAME_URL =
  'https://app.liveavatar.com/a9118ca3-920d-4e04-b7f2-81821710d608';

// ─── Sub-components ─────────────────────────────────────────────────────────

const OfflinePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem('haulflow_avatar_emails') || '[]');
      existing.push({ email: email.trim(), timestamp: new Date().toISOString() });
      localStorage.setItem('haulflow_avatar_emails', JSON.stringify(existing));
    } catch { /* ignore */ }
    setSubmitted(true);
  };

  return (
    <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
            <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Kristy</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-400 text-xs">Offline</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-1">See you at 8 AM!</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            I&apos;m available from <strong>8 AM &ndash; 6 PM</strong> Central Time to answer questions about HaulFlow.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Next available: <strong>{getNextOpenTime()}</strong>
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-600 font-medium">Want me to reach out when I&apos;m back?</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Notify me
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-emerald-700 text-sm font-medium">Got it! We&apos;ll follow up at 8 AM. &#10003;</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AvatarPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="absolute bottom-20 right-0 w-80 sm:w-[400px] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Kristy &mdash; HaulFlow</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400 animate-pulse" />
              <span className="text-blue-200 text-xs">Live</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* iframe embed */}
      <iframe
        src={LIVEAVATAR_IFRAME_URL}
        allow="microphone; camera"
        style={{ width: '100%', height: '500px', border: 'none' }}
        title="Chat with Kristy"
      />
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const InteractiveAvatar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [withinHours, setWithinHours] = useState(isWithinWorkingHours());
  const [showPulse, setShowPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setWithinHours(isWithinWorkingHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) setShowPulse(false);
  }, [isOpen]);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <div className="fixed bottom-6 right-6 z-50" style={{ zIndex: 9999 }}>
      {isOpen && (
        withinHours ? (
          <AvatarPanel onClose={handleClose} />
        ) : (
          <OfflinePanel onClose={handleClose} />
        )
      )}

      <button
        onClick={isOpen ? handleClose : handleOpen}
        className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center group overflow-hidden ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800'
            : 'hover:scale-110'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Chat with Kristy'}
      >
        {!isOpen && showPulse && (
          <>
            <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-30" />
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-pulse opacity-20" />
          </>
        )}

        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative w-full h-full">
            <img
              src={KRISTY_AVATAR_URL}
              alt="Chat with Kristy"
              className="w-full h-full object-cover rounded-full"
            />
            <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
              withinHours ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
          </div>
        )}
      </button>

      {!isOpen && (
        <div className="absolute bottom-full right-0 mb-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
            {withinHours ? 'Chat with Kristy' : 'Kristy is offline'}
            <div className="absolute top-full right-5 -mt-1 w-2 h-2 bg-slate-900 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveAvatar;
