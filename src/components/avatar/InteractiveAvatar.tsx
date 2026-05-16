import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
// @ts-ignore
import { LiveAvatarSession } from '@heygen/liveavatar-web-sdk';

// ─── Working Hours Logic ───────────────────────────────────────────────────────
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

// ─── Kristy's profile picture URL ─────────────────────────────────────────────
const KRISTY_AVATAR_URL =
  'https://customer-assets.emergentAgent.com/wingman/6bc070fc-a70c-40b9-ab7e-ce8bf7ccc7ff/attachments/c0ce6e9e6ba64ff88b6e093e3969342b_kristy-avatar.png';

const GREETING =
  "Hi! I'm Kristy from HaulFlow. I can help you learn about our TMS platform, or if you're curious, ask me about today's news! What would you like to know?";

// ─── Sub-components ────────────────────────────────────────────────────────────

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

// ─── AvatarPanel: SDK-based LiveAvatar ────────────────────────────────────────

type SessionStatus = 'idle' | 'connecting' | 'ready' | 'error';

const AvatarPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<InstanceType<typeof LiveAvatarSession> | null>(null);
  const greetingSentRef = useRef(false);
  const handshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  // ── Boot: fetch token then start SDK session ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      setStatus('connecting');
      setErrorMsg('');

      try {
        // 1. Fetch session token from our serverless function
        const tokenRes = await fetch('/api/liveavatar-token', { method: 'POST' });
        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          throw new Error(errData.error || `Token fetch failed: ${tokenRes.status}`);
        }
        const tokenData = await tokenRes.json();
        // Support both field names
        const sessionToken = tokenData.sessionToken || tokenData.session_token;
        if (!sessionToken) throw new Error('No session token returned');

        if (cancelled) return;

        // 2. Create SDK session
        const session = new LiveAvatarSession({ sessionToken });
        sessionRef.current = session;

        // 3. Wire up events
        session.on('session_stream_ready', (stream: MediaStream) => {
          if (cancelled) return;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = false;
            videoRef.current.volume = 1.0;

            // Poll until video is ready
            const pollReady = () => {
              if (!videoRef.current) return;
              if (videoRef.current.readyState >= 2) {
                videoRef.current.play().catch(() => {/* autoplay blocked */});
                setStatus('ready');
                if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
                // Send greeting once
                if (!greetingSentRef.current) {
                  greetingSentRef.current = true;
                  setMessages([{ role: 'assistant', text: GREETING }]);
                  speakText(session, GREETING);
                }
              } else {
                setTimeout(pollReady, 1000);
              }
            };
            pollReady();
          }
        });

        session.on('speaking_start', () => setIsSpeaking(true));
        session.on('speaking_end', () => setIsSpeaking(false));
        session.on('session_error', (err: Error) => {
          if (!cancelled) {
            console.error('[LiveAvatar] Session error:', err);
            setStatus('error');
            setErrorMsg(err?.message || 'Session error');
          }
        });
        session.on('session_closed', () => {
          if (!cancelled) setStatus('idle');
        });

        // 4. Start session
        await session.start();

        // 5. 30-second handshake timeout
        handshakeTimerRef.current = setTimeout(() => {
          if (!cancelled && status !== 'ready') {
            setStatus('error');
            setErrorMsg('Connection timed out. Please try again.');
          }
        }, 30_000);

      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to start session';
          console.error('[LiveAvatar] Boot error:', message);
          setStatus('error');
          setErrorMsg(message);
        }
      }
    }

    startSession();

    return () => {
      cancelled = true;
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
      if (sessionRef.current) {
        try { sessionRef.current.stop(); } catch { /* ignore */ }
        sessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── speak helper: try talk() first, fallback to speak() ───────────────────
  function speakText(session: InstanceType<typeof LiveAvatarSession>, text: string) {
    try {
      if (typeof session.talk === 'function') {
        session.talk(text);
      } else if (typeof session.speak === 'function') {
        session.speak(text);
      }
    } catch (e) {
      try {
        session.speak(text);
      } catch { /* ignore */ }
    }
  }

  // ── Send user message ──────────────────────────────────────────────────────
  const handleSend = () => {
    const text = inputText.trim();
    if (!text || status !== 'ready' || !sessionRef.current) return;
    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    speakText(sessionRef.current, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Status overlay label ───────────────────────────────────────────────────
  const statusLabel =
    status === 'connecting'
      ? 'Connecting to Kristy…'
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
                  status === 'ready'
                    ? 'bg-emerald-400 animate-pulse'
                    : status === 'connecting'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-blue-200 text-xs">
                {status === 'ready'
                  ? isSpeaking
                    ? 'Speaking…'
                    : 'Live'
                  : status === 'connecting'
                  ? 'Connecting…'
                  : 'Error'}
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
        className="relative w-full bg-slate-800 flex-shrink-0"
        style={{ aspectRatio: '9/16', maxHeight: '500px' }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Status overlay */}
        {statusLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 gap-3">
            {status === 'connecting' && (
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {status === 'error' && (
              <div className="text-red-400 text-2xl">⚠️</div>
            )}
            <p className="text-white text-sm font-medium text-center px-4">{statusLabel}</p>
            {status === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto max-h-32 px-3 py-2 space-y-1.5 bg-slate-800">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat input */}
      <div className="flex-shrink-0 px-3 py-3 bg-slate-800 border-t border-slate-700 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={status === 'ready' ? 'Ask Kristy anything…' : 'Connecting…'}
          disabled={status !== 'ready'}
          className="flex-1 bg-slate-700 text-white placeholder-slate-400 text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={status !== 'ready' || !inputText.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

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
