import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, MessageCircle, Send, Loader2, WifiOff, Clock, Mail, Newspaper } from 'lucide-react';

// ─── Working Hours Logic ─────────────────────────────────────────────────────────────────
const WORKING_HOURS_START = 8;  // 8 AM local time
const WORKING_HOURS_END = 18;   // 6 PM local time

function isWithinWorkingHours(): boolean {
  // ⚠️ TESTING OVERRIDE: Kristy is always online 24/7
  return true;
}

function getNextOpenTime(): string {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= WORKING_HOURS_END) {
    // After 6 PM — next day 8 AM
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(WORKING_HOURS_START, 0, 0, 0);
    return tomorrow.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Before 8 AM — today 8 AM
  return `${WORKING_HOURS_START}:00 AM`;
}

// ─── Avatar Session Manager ─────────────────────────────────────────────────────────
interface AvatarSession {
  sessionId: string;
  sdp: RTCSessionDescriptionInit;
  iceServers: RTCIceServer[];
}

async function fetchAccessToken(): Promise<string> {
  const resp = await fetch('/api/heygen-token', { method: 'POST' });
  if (!resp.ok) {
    throw new Error(`Token fetch failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.token;
}

// ─── Outfit of the Day ──────────────────────────────────────────────────────────
// Selects Kristy's avatar_id based on the current day of the week.
// 0 = Sunday, 1 = Monday, …, 6 = Saturday
const kristyOutfits: Record<number, string> = {
  1: "ae066f5f7c624c048fc6b0e6cd39c50d", // Monday: Desk w/ laptop
  2: "e27cc23ff7e346e583df72a637cef72b", // Tuesday: Blazer
  3: "2a1bd9ef205c403682b7b79dbead912d", // Wednesday
  4: "7b30374ca8f9426db5f6dd82ef8f8e58", // Thursday
  5: "6021a377371b41bea387200310211656", // Friday
  6: "cae1d526d5da4d79a68e2690f0c81dfb", // Saturday
  0: "4afbe2d81cd54dc0a80d85ff988645e5", // Sunday
};

function getTodaysAvatarId(): string {
  const day = new Date().getDay(); // 0 (Sun) – 6 (Sat)
  return kristyOutfits[day];
}

async function createStreamingSession(token: string): Promise<AvatarSession> {
  const resp = await fetch('https://api.heygen.com/v1/streaming.new', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      quality: 'high',
      avatar_id: getTodaysAvatarId(), // Outfit of the Day — rotates by day of week
      voice: {
        voice_id: '8DzKSPdgEQPaK5vKG0Rs',
        provider: 'elevenlabs',
      },
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error('Session creation error:', errorText);
    throw new Error(`Session creation failed: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    sessionId: data.data.session_id,
    sdp: data.data.sdp,
    iceServers: data.data.ice_servers2 || [],
  };
}

async function startStreamingSession(token: string, sessionId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  const resp = await fetch('https://api.heygen.com/v1/streaming.start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      sdp,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Session start failed: ${resp.status}`);
  }
}

async function sendSpeakTask(token: string, sessionId: string, text: string): Promise<void> {
  const resp = await fetch('https://api.heygen.com/v1/streaming.task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      text,
      task_type: 'talk',
    }),
  });

  if (!resp.ok) {
    throw new Error(`Speak task failed: ${resp.status}`);
  }
}

async function stopStreamingSession(token: string, sessionId: string): Promise<void> {
  try {
    await fetch('https://api.heygen.com/v1/streaming.stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch (e) {
    console.warn('Error stopping session:', e);
  }
}

// ─── Chat enrichment via backend ─────────────────────────────────────────────────────────
// Routes every visitor message through /api/avatar-chat so the backend
// can detect news intent, fetch headlines, and return an enriched prompt.

interface ChatResponse {
  speech_text: string;
  is_news: boolean;
}

async function enrichMessage(message: string): Promise<ChatResponse> {
  const resp = await fetch('/api/avatar-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!resp.ok) {
    // Fallback — just return the raw message so the avatar still speaks
    console.warn('avatar-chat enrichment failed, using raw message');
    return { speech_text: message, is_news: false };
  }

  return resp.json();
}

// ─── Sub-components ──────────────────────────────────────────────────────────────────────

/** Offline mode: shown outside working hours */
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
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
            <img
              src="https://d64gsuwffb70l.cloudfront.net/6983b3d3af6b26bfb6c07812_1770449773066_9dfece9b.jpg"
              alt="Kristy"
              className="w-full h-full object-cover"
            />
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

      {/* Body */}
      <div className="p-5">
        <div className="text-center mb-4">
          <div className="inline-flex p-3 bg-amber-50 rounded-full mb-3">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">See you at 8 AM!</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            I'm available from <strong>8 AM – 6 PM</strong> (your local time) to answer questions about HaulFlow.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Next available: <strong>{getNextOpenTime()}</strong>
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-600 font-medium">Want me to reach out when I'm back?</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-emerald-700 text-sm font-medium">Got it! We'll follow up at 8 AM. ✓</p>
          </div>
        )}
      </div>
    </div>
  );
};

/** Active streaming panel */
const StreamingPanel: React.FC<{
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  status: 'connecting' | 'connected' | 'error';
  onSendMessage: (msg: string) => void;
  isSending: boolean;
  lastWasNews: boolean;
  errorMessage?: string;
}> = ({ onClose, videoRef, status, onSendMessage, isSending, lastWasNews, errorMessage }) => {
  const [message, setMessage] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status !== 'connected' || isSending) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  return (
    <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden">
            <img
              src="https://d64gsuwffb70l.cloudfront.net/6983b3d3af6b26bfb6c07812_1770449773066_9dfece9b.jpg"
              alt="Kristy"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Kristy — HaulFlow</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-blue-200 text-xs">
                {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Error'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video Area */}
      <div className="relative bg-slate-900 aspect-video">
        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-sm text-slate-400">Connecting to Kristy…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-4">
            <WifiOff className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-300 text-center">{errorMessage || 'Connection failed. Please try again.'}</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${status !== 'connected' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />
        {/* News badge — flashes when Kristy is speaking about headlines */}
        {lastWasNews && status === 'connected' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            <Newspaper className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Headlines</span>
          </div>
        )}
        {/* Sending indicator overlay */}
        {isSending && status === 'connected' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Kristy is thinking…</span>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              status !== 'connected'
                ? 'Waiting for connection…'
                : isSending
                ? 'Kristy is responding…'
                : 'Ask about HaulFlow or the news…'
            }
            disabled={status !== 'connected' || isSending}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={status !== 'connected' || !message.trim() || isSending}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────────────

const InteractiveAvatar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [withinHours, setWithinHours] = useState(isWithinWorkingHours());
  const [showPulse, setShowPulse] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastWasNews, setLastWasNews] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string>('');
  const tokenRef = useRef<string>('');

  // Re-check working hours every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setWithinHours(isWithinWorkingHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Hide pulse after first interaction
  useEffect(() => {
    if (isOpen) setShowPulse(false);
  }, [isOpen]);

  const connectToAvatar = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage('');

    try {
      // 1. Get access token from our backend
      const token = await fetchAccessToken();
      tokenRef.current = token;

      // 2. Create streaming session
      const session = await createStreamingSession(token);
      sessionIdRef.current = session.sessionId;

      // 3. Set up WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: session.iceServers.length > 0
          ? session.iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionRef.current = pc;

      // Handle incoming tracks (avatar video/audio)
      pc.ontrack = (event) => {
        if (event.streams?.[0] && videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setStatus('error');
          setErrorMessage('Connection lost. Please try again.');
        }
      };

      // Set remote SDP (offer from HeyGen)
      await pc.setRemoteDescription(new RTCSessionDescription(session.sdp));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 4. Send answer back to start the session
      await startStreamingSession(token, session.sessionId, answer);

      setStatus('connected');

      // 5. Send greeting
      setTimeout(() => {
        sendSpeakTask(
          token,
          session.sessionId,
          "Hi! I'm Kristy from HaulFlow. I can help you learn about our TMS platform, or if you're curious, ask me about today's news! What would you like to know?"
        ).catch(console.error);
      }, 2000);

    } catch (error) {
      console.error('Avatar connection error:', error);
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to connect. Please try again.'
      );
    }
  }, []);

  const disconnectAvatar = useCallback(async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (sessionIdRef.current && tokenRef.current) {
      await stopStreamingSession(tokenRef.current, sessionIdRef.current);
      sessionIdRef.current = '';
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus('idle');
    setLastWasNews(false);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (withinHours) {
      connectToAvatar();
    }
  }, [withinHours, connectToAvatar]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (status !== 'idle') {
      disconnectAvatar();
    }
  }, [status, disconnectAvatar]);

  /**
   * Sends the visitor message through the backend enrichment proxy
   * (/api/avatar-chat), then forwards the enriched prompt to HeyGen.
   */
  const handleSendMessage = useCallback(async (text: string) => {
    if (!sessionIdRef.current || !tokenRef.current) return;

    setIsSending(true);
    setLastWasNews(false);

    try {
      // 1. Send to our backend for enrichment (news detection, persona wrapping)
      const enriched = await enrichMessage(text);

      // 2. Update news badge state
      setLastWasNews(enriched.is_news);

      // 3. Forward enriched prompt to HeyGen streaming speak task
      await sendSpeakTask(tokenRef.current, sessionIdRef.current, enriched.speech_text);
    } catch (error) {
      console.error('Send message error:', error);
      // Fallback — send raw text directly so the avatar still responds
      try {
        await sendSpeakTask(tokenRef.current, sessionIdRef.current, text);
      } catch (fallbackErr) {
        console.error('Fallback send also failed:', fallbackErr);
      }
    } finally {
      setIsSending(false);
    }
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50" style={{ zIndex: 9999 }}>
      {/* Panel */}
      {isOpen && (
        withinHours ? (
          <StreamingPanel
            onClose={handleClose}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            status={status === 'idle' ? 'connecting' : status as 'connecting' | 'connected' | 'error'}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            lastWasNews={lastWasNews}
            errorMessage={errorMessage}
          />
        ) : (
          <OfflinePanel onClose={handleClose} />
        )
      )}

      {/* Floating Chat Bubble */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center group ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-0'
            : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Chat with Kristy'}
      >
        {/* Pulse ring — only shown before first open */}
        {!isOpen && showPulse && (
          <>
            <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-30" />
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-pulse opacity-20" />
          </>
        )}

        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-blue-600 ${
              withinHours ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
          </div>
        )}
      </button>

      {/* Tooltip — only when bubble is closed */}
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
