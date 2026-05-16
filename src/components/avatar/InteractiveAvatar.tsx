import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Loader2, Send } from 'lucide-react';

// ─── Working Hours Logic ──────────────────────────────────────────────────────
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

// ─── Kristy's profile picture URL ────────────────────────────────────────────
const KRISTY_AVATAR_URL =
  'https://customer-assets.emergentAgent.com/wingman/6bc070fc-a70c-40b9-ab7e-ce8bf7ccc7ff/attachments/c0ce6e9e6ba64ff88b6e093e3969342b_kristy-avatar.png';

// ─── LiveAvatar API config ──────────────────────────────────────────────────
const LIVEAVATAR_API_URL = 'https://api.liveavatar.com';

const GREETING_TEXT =
  "Hi! I'm Kristy from HaulFlow. I can help you learn about our TMS platform, or if you're curious, ask me about today's news! What would you like to know?";

// ─── Sub-components ───────────────────────────────────────────────────────────

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

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface ChatMessage {
  role: 'user' | 'kristy';
  text: string;
  ts: number;
}

const AvatarPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<any>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnectedRef = useRef(false);
  const greetingFiredRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearAllTimers = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (connectionPollRef.current) {
      clearInterval(connectionPollRef.current);
      connectionPollRef.current = null;
    }
    if (failsafeTimeoutRef.current) {
      clearTimeout(failsafeTimeoutRef.current);
      failsafeTimeoutRef.current = null;
    }
  }, []);

  const sendTalk = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session) return;

    // Try session.talk() first; if unavailable or fails, fall back to session.speak()
    if (typeof session.talk === 'function') {
      try {
        await session.talk(text);
        return;
      } catch (e) {
        console.warn('[HaulFlow] session.talk() failed, trying session.speak():', e);
      }
    }

    // Try session.speak() as second option
    if (typeof session.speak === 'function') {
      try {
        await session.speak(text);
        return;
      } catch (e) {
        console.warn('[HaulFlow] session.speak() failed, falling back to fetch:', e);
      }
    }

    // Fallback: direct fetch to the streaming-task API
    const sessionId: string | undefined = session.sessionId ?? session.session_id ?? session.id;
    const sdkToken: string | undefined = session.token ?? session.sessionToken ?? session.accessToken;
    if (!sessionId || !sdkToken) {
      console.warn('[HaulFlow] Cannot send talk — missing sessionId or token on session object.');
      return;
    }
    try {
      await fetch(`${LIVEAVATAR_API_URL}/v1/streaming.task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sdkToken}`,
        },
        body: JSON.stringify({ session_id: sessionId, text, task_type: 'talk' }),
      });
    } catch (e) {
      console.warn('[HaulFlow] Streaming task fetch failed:', e);
    }
  }, []);

  // markConnected now accepts the session object so it can attach the stream
  // before transitioning the UI to the connected state.
  const markConnected = useCallback((session?: any) => {
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;
    clearAllTimers();
    console.warn('[HaulFlow] ✅ Marking status as connected — clearing all timers.');
    if (session && videoRef.current) {
      console.warn('[HaulFlow] markConnected: attaching stream to video element.');
      session.attach(videoRef.current);
      // Explicitly unmute and set full volume so audio plays
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
    }
    setStatus('connected');
  }, [clearAllTimers]);

  // Trigger greeting once when status first becomes 'connected'
  useEffect(() => {
    if (status === 'connected' && !greetingFiredRef.current) {
      greetingFiredRef.current = true;
      // Add greeting message to chat display immediately
      setMessages([{ role: 'kristy', text: GREETING_TEXT, ts: Date.now() }]);
      // Delay 1.5 seconds before sending greeting audio so the audio channel is ready
      setTimeout(() => {
        sendTalk(GREETING_TEXT).catch(() => {});
      }, 1_500);
    }
  }, [status, sendTalk]);

  const startSession = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    hasConnectedRef.current = false;
    greetingFiredRef.current = false;
    setMessages([]);
    clearAllTimers();

    // 30-second hard timeout: if nothing works, surface an error
    console.warn('[HaulFlow] Starting 30-second connection timeout for WebRTC negotiation...');
    connectionTimeoutRef.current = setTimeout(() => {
      console.warn('[HaulFlow] Connection timeout fired after 30 seconds — checking video element...');
      if (videoRef.current) {
        const vid = videoRef.current;
        const hasStream = (vid.srcObject instanceof MediaStream && (vid.srcObject as MediaStream).active) ||
          (vid.readyState >= 2);
        if (hasStream) {
          console.warn('[HaulFlow] Video element has active stream — marking as connected.');
          markConnected(sessionRef.current);
          return;
        }
      }
      console.warn('[HaulFlow] No stream detected after 30 seconds. Surfacing timeout error.');
      setStatus('error');
      setError('Connection timed out. Please try again.');
    }, 30_000);

    try {
      // Step 1: Create Session Token via our backend API
      const tokenRes = await fetch('/api/liveavatar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || `Token request failed (${tokenRes.status})`);
      }

      const { session_token } = await tokenRes.json();

      if (!session_token) {
        throw new Error('No session token received');
      }

      // Step 2: Initialize LiveAvatarSession with the SDK
      const { LiveAvatarSession } = await import('@heygen/liveavatar-web-sdk');

      const session = new LiveAvatarSession(session_token, {
        voiceChat: true,
        apiUrl: LIVEAVATAR_API_URL,
      });

      sessionRef.current = session;

      // Listen for stream_ready and session_stream_ready events (HeyGen SDK may emit either)
      const onStreamReady = () => {
        console.warn('[HaulFlow] stream_ready / session_stream_ready event received — stream is active.');
        if (videoRef.current) {
          console.warn('[HaulFlow] Attaching stream to video element.');
          session.attach(videoRef.current);
          // Ensure audio is unmuted when stream attaches
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
        }
        markConnected(session);
      };
      session.on('session_stream_ready', onStreamReady);
      session.on('stream_ready', onStreamReady);

      // Also watch the video element directly: if it starts playing, clear the loading overlay
      if (videoRef.current) {
        const onPlay = () => {
          console.warn('[HaulFlow] Video element "playing" event fired — stream is active, marking connected.');
          markConnected(sessionRef.current);
        };
        videoRef.current.addEventListener('playing', onPlay, { once: true });
      }

      session.on('session_state_changed', (state: string) => {
        console.warn(`[HaulFlow] session_state_changed: ${state}`);
        if (state === 'CONNECTED') {
          console.warn('[HaulFlow] Session state is CONNECTED — marking connected.');
          markConnected(sessionRef.current);
        } else if (state === 'DISCONNECTED') {
          console.warn('[HaulFlow] Session state is DISCONNECTED — resetting to idle.');
          setStatus('idle');
          sessionRef.current = null;
        } else {
          console.warn(`[HaulFlow] Session state changed to: ${state}`);
        }
      });

      // Step 3: Start the session — SDK handles the POST /v1/sessions/start internally
      console.warn('[HaulFlow] Calling session.start() — beginning WebRTC negotiation...');
      await session.start();
      console.warn('[HaulFlow] session.start() resolved — starting 1s polling interval and 3s fail-safe.');

      // Polling: every 1s, check if video has srcObject and readyState >= 2 (HAVE_CURRENT_DATA).
      // If the video element exists but has no srcObject yet, proactively try to attach
      // the stream in case the automatic events were missed.
      connectionPollRef.current = setInterval(() => {
        if (hasConnectedRef.current) {
          clearInterval(connectionPollRef.current!);
          connectionPollRef.current = null;
          return;
        }
        const vid = videoRef.current;
        if (vid && !vid.srcObject) {
          console.warn('[HaulFlow] Polling: video has no srcObject — proactively attaching stream.');
          sessionRef.current?.attach(vid);
        }
        if (vid && vid.srcObject && vid.readyState >= 2) {
          console.warn('[HaulFlow] Polling detected video srcObject + readyState >= 2 — marking connected.');
          markConnected(sessionRef.current);
        }
      }, 1_000);

      // Fail-safe: 3s after session.start() resolves, force connected if no error occurred.
      // Also ensure the stream is attached before marking connected.
      failsafeTimeoutRef.current = setTimeout(() => {
        if (hasConnectedRef.current) return;
        console.warn('[HaulFlow] Fail-safe fired 3s after session.start() resolved — forcing connected status.');
        if (videoRef.current) {
          sessionRef.current?.attach(videoRef.current);
          // Ensure audio is unmuted
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
        }
        markConnected(sessionRef.current);
      }, 3_000);

    } catch (err: any) {
      console.warn('[HaulFlow] LiveAvatar session error:', err);
      setError(err.message || 'Failed to start avatar session');
      setStatus('error');
      clearAllTimers();
    }
  }, [clearAllTimers, markConnected]);

  const stopSession = useCallback(async () => {
    clearAllTimers();
    try {
      if (sessionRef.current) {
        await sessionRef.current.stop();
      }
    } catch (err) {
      console.warn('[HaulFlow] Error stopping session:', err);
    }
    sessionRef.current = null;
    setStatus('idle');
  }, [clearAllTimers]);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    const vc = sessionRef.current.voiceChat;
    if (!vc) return;
    if (isMuted) {
      vc.unmute();
      setIsMuted(false);
    } else {
      vc.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || status !== 'connected') return;

    setInputText('');
    setIsSending(true);
    setMessages((prev) => [...prev, { role: 'user', text, ts: Date.now() }]);

    try {
      await sendTalk(text);
    } catch (e) {
      console.warn('[HaulFlow] Failed to send message:', e);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, status, sendTalk]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Auto-start session when panel opens
  useEffect(() => {
    startSession();
    return () => {
      clearAllTimers();
      if (sessionRef.current) {
        sessionRef.current.stop().catch(() => {});
        sessionRef.current = null;
      }
    };
  }, [startSession, clearAllTimers]);

  const handleClose = useCallback(() => {
    stopSession();
    onClose();
  }, [stopSession, onClose]);

  return (
    <div className="absolute bottom-20 right-0 w-80 sm:w-[360px] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Kristy — HaulFlow</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-blue-200 text-xs">
                {status === 'connecting' ? 'Connecting...' : status === 'connected' ? 'Live' : status === 'error' ? 'Error' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'connected' && (
            <button
              onClick={toggleMute}
              className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-600"
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button onClick={handleClose} className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video area — portrait 9/16 aspect ratio */}
      <div className="w-full bg-slate-950 relative flex-shrink-0" style={{ aspectRatio: '9/16', maxHeight: '480px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Connecting overlay */}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
            <p className="text-sm text-slate-300 font-medium">Starting Kristy&apos;s session...</p>
            <p className="text-xs text-slate-500 mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4">
            <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center mb-3">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-red-400 mb-4 text-center leading-relaxed">{error}</p>
            <button
              onClick={startSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Idle overlay */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90">
            <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-blue-500 shadow-lg shadow-blue-500/30">
              <img
                src={KRISTY_AVATAR_URL}
                alt="Kristy"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-slate-300 text-sm font-medium mb-3">Chat with Kristy</p>
            <button
              onClick={startSession}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors font-medium shadow-lg shadow-blue-600/30"
            >
              Start conversation
            </button>
          </div>
        )}
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-900 min-h-[80px] max-h-[160px]">
        {messages.length === 0 && status === 'connected' && (
          <p className="text-slate-500 text-xs text-center py-2">Kristy is ready to chat…</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.ts}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'kristy' && (
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 mr-1.5 mt-0.5">
                <img src={KRISTY_AVATAR_URL} alt="Kristy" className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-slate-700 text-slate-100 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Chat input */}
      <div className="px-3 py-3 bg-slate-800 border-t border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={status === 'connected' ? 'Ask Kristy anything…' : 'Connecting…'}
            disabled={status !== 'connected' || isSending}
            className="flex-1 bg-slate-700 text-slate-100 placeholder-slate-400 text-xs px-3 py-2 rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || status !== 'connected' || isSending}
            className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-slate-500 text-[10px] text-center mt-1.5">
          Powered by HaulFlow AI · Voice &amp; text
        </p>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
