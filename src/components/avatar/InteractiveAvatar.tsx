import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@anam-ai/js-sdk';

// ─── Working Hours Logic ───────────────────────────────────────────────
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

// ─── Kristy's profile picture URL ───────────────────────────────────────────────
const KRISTY_AVATAR_URL =
  'https://customer-assets.emergentagent.com/wingman/6bc070fc-a70c-40b9-ab7e-ce8bf7ccc7ff/attachments/7e9ca85c59c6448bb9d1c05e0ad669f5_Screenshot%202026-05-16%20at%203.50.02_PM.png';

// ─── Sub-components ─────────────────────────────────────────────────────────────

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

// ─── AvatarPanel: Anam SDK-based streaming ───────────────────────────────────────────────

type SessionStatus = 'idle' | 'connecting' | 'streaming' | 'error';

const AvatarPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const startStream = async () => {
    if (status === 'connecting' || status === 'streaming') return;
    setStatus('connecting');
    setErrorMsg('');

    try {
      // 1. Fetch session token from our serverless function
      const tokenRes = await fetch('/api/anam-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || `Token fetch failed: ${tokenRes.status}`);
      }
      const { sessionToken } = await tokenRes.json();
      if (!sessionToken) throw new Error('No session token returned');

      // 2. Initialise Anam client with the session token
      const client = createClient(sessionToken);
      clientRef.current = client;

      // 3. Stream to video and audio elements by ID (fixes "[object HTMLVideoElement] not found" error)
      await client.streamToVideoAndAudioElements('anam-video-element', 'anam-audio-element');

      setStatus('streaming');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start stream';
      console.error('[HaulFlow][Anam] Boot error:', message);
      setStatus('error');
      setErrorMsg(message);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        try {
          clientRef.current.stopStreaming();
        } catch { /* ignore */ }
        clientRef.current = null;
      }
    };
  }, []);

  const statusLabel =
    status === 'connecting'
      ? 'Connecting to Kristy...'
      : status === 'error'
      ? errorMsg || 'Connection failed'
      : null;

  return (
    <div
      className="absolute bottom-20 right-0 w-80 sm:w-[400px] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Kristy &mdash; HaulFlow</p>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  status === 'streaming'
                    ? 'bg-emerald-400 animate-pulse'
                    : status === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-blue-200 text-xs">
                {status === 'streaming'
                  ? 'Live'
                  : status === 'connecting'
                  ? 'Connecting...'
                  : status === 'error'
                  ? 'Error'
                  : 'Ready'}
              </span>
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

      {/* Video container — tall portrait */}
      <div
        className="relative w-full bg-slate-800 flex flex-shrink-0"
        style={{ aspectRatio: '9/16', maxHeight: '500px' }}
      >
        <video
          ref={videoRef}
          id="anam-video-element"
          autoPlay
          playsInline
          muted={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Hidden audio element for Anam SDK optimal performance */}
        <audio id="anam-audio-element" autoPlay />

        {/* Status overlay */}
        {statusLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 gap-3">
            {status === 'connecting' && (
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {status === 'error' && (
              <div className="text-red-400 text-2xl">&#9888;&#65039;</div>
            )}
            <p className="text-white text-sm font-medium text-center px-4">{statusLabel}</p>
            {status === 'error' && (
              <button
                onClick={startStream}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Idle: Start Conversation button */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-blue-400 shadow-lg">
              <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
            </div>
            <div className="text-center px-4">
              <p className="text-white font-semibold text-base">Kristy</p>
              <p className="text-blue-200 text-xs mt-1">HaulFlow AI Assistant</p>
            </div>
            <button
              onClick={startStream}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-2xl transition-all duration-200 shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95"
            >
              Start Conversation
            </button>
            <p className="text-slate-400 text-xs text-center px-6">
              Voice-to-voice &bull; Ask me anything about HaulFlow
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

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
            <div
              className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                withinHours ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
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