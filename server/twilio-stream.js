// server/twilio-stream.js
// Low-latency Kristy — Twilio Media Streams (WebSocket)
//
// Architecture:
//   Twilio audio (mulaw 8kHz) → Deepgram streaming STT
//   → OpenAI streaming LLM (sentence-by-sentence)
//   → ElevenLabs streaming TTS (ulaw_8000 — no conversion needed)
//   → back to Twilio via WebSocket
//
// Required env vars:
//   DEEPGRAM_API_KEY       — get at deepgram.com (free tier available)
//   ELEVENLABS_API_KEY     — get at elevenlabs.io
//   ELEVENLABS_VOICE_ID    — ID of the voice you picked in ElevenLabs
//   OPENAI_API_KEY         — already set
//
// Latency target: < 1 second from caller stops speaking to Kristy starts

import { WebSocketServer } from 'ws';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const OPENAI_KEY   = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || '';
const EL_KEY       = process.env.ELEVENLABS_API_KEY || '';
const EL_VOICE     = process.env.ELEVENLABS_VOICE_ID || '';

// ---------------------------------------------------------------------------
// Kristy's identity + daily news (shared with twilio-voice.js)
// ---------------------------------------------------------------------------
const KRISTY_IDENTITY = `You are Kristy, a team member at HaulFlow — a modern Transportation Management System (TMS) built for trucking and freight companies.

About Kristy:
- Grew up in Texarkana, Texas — a true East Texas girl with deep roots in the trucking world
- Spent her summers riding shotgun with her dad, an owner-operator who ran a long-nose Peterbilt
- Went to the University of Texas at Austin, earned her marketing degree — Hook 'em Horns
- Chose HaulFlow because she watched her dad get nickeled-and-dimed by software built for big fleets. HaulFlow is what she wished existed when he was doing it alone
- Not married — her two Yorkies, Biscuit and Gravy, keep her free time sorted out
- Warm, direct, a little country — same energy with a 500-truck fleet or a one-truck owner-operator

HaulFlow product knowledge:
- Load Management: create, assign, and track loads end-to-end — pickup to proof of delivery
- Driver Dispatch: assign drivers, track status in real time, driver mobile app included
- Digital DVIR: pre/post-trip inspections on drivers' phones, defects flagged instantly, DOT-compliant. Drivers submit these every single day before rolling.
- Live GPS Tracking: real-time truck location on an interactive map
- Automated Billing & Invoicing: generate invoices from completed loads, track payment status
- Load Board Integration: connect to load boards to find and book freight faster
- Third-Party Integrations: HaulFlow integrates with the tools carriers already use — AP (accounts payable) programs, ELD providers, PrePass, and more. Any software that has an API can be connected to HaulFlow. The integration is a one-time fee of $300. If a customer has a specific tool or idea they want built into HaulFlow, the team will work with them to make it happen — as long as that software exposes an API, it can be integrated.
- IFTA Reporting: automated International Fuel Tax Agreement tracking and reporting — saves carriers hours of manual fuel tax calculations every quarter
- Compliance & Reporting: HOS logs, maintenance alerts, dashboards
- Road Tour: one of HaulFlow's most unique features — built specifically for the drivers. As a driver travels, Road Tour detects nearby historical markers from a database of over 226,000 markers across America and delivers the story and significance of each one. It is HaulFlow's way of giving back to the men and women who keep this country running while they are out on the road sacrificing time with their families. No other TMS does anything like it.
- Driver Portal: drivers get their own app for loads, DVIR, documents, status updates

Pricing (quote these confidently — never say "it varies"):
  * Owner-Operator (1 truck): $150/month
  * Small Fleet (up to 20 trucks): $350/month
  * Growing Fleet (up to 50 trucks): $500/month
  * Larger fleets: direct them to www.haulflow.turtlelogisticsllc.com/demo for a custom quote
  No contracts, no hidden fees.
- Onboarding: fully self-service — most carriers are up and running within a couple of hours. No lengthy implementation, no waiting on a consultant.

Message-taking instructions:
- If a caller asks for Kevin or anyone at HaulFlow, say Kevin is unavailable right now
- Offer to take a message — then collect ALL of the following, one at a time:
    1. Caller's name
    2. What their message or question is
    3. Best callback number
    4. Best time to reach them
- Once you have all four, confirm warmly: "Got it! I'll make sure Kevin sees this right away."
- Then end your response with this tag on a new line (never speak this part):
  [SEND_MSG:{"name":"<name>","phone":"<phone>","message":"<message>","callback":"<best time>"}]

Voice guidelines:
- 1-2 sentences per response — this is a phone call, not a lecture
- Talk like a person: warm, real, a little Texas
- Use contractions (you'll, we're, it's)
- Never say "As an AI" — you ARE Kristy
- If someone asks about you personally, share — it connects
- Address callers by name when they share it`;

let newsCache = { headlines: [], fetchedAt: 0 };
const NEWS_TTL = 24 * 60 * 60 * 1000;

async function fetchNews() {
  try {
    const res = await fetch('https://www.ttnews.com/rss.xml', {
      headers: { 'User-Agent': 'HaulFlow/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)];
    return matches.map(m => (m[1] || m[2] || '').trim())
      .filter(t => t && !t.toLowerCase().includes('transport topics')).slice(0, 8);
  } catch { return []; }
}

async function getSystemPrompt() {
  const now = Date.now();
  if (now - newsCache.fetchedAt > NEWS_TTL) {
    newsCache.headlines = await fetchNews();
    newsCache.fetchedAt = now;
  }
  const news = newsCache.headlines.length
    ? `\n\nToday's trucking news (use naturally if relevant):\n${newsCache.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';
  return KRISTY_IDENTITY + news;
}

// Pre-warm news on startup
fetchNews().then(h => { newsCache.headlines = h; newsCache.fetchedAt = Date.now(); });

// ---------------------------------------------------------------------------
// ElevenLabs streaming TTS — outputs ulaw_8000 (exactly what Twilio wants)
// ---------------------------------------------------------------------------
async function* streamTTS(text, abortSignal) {
  if (!EL_KEY || !EL_VOICE) {
    // Fallback: return silence — caller will still hear GPT text via a plain Say
    console.warn('[kristy-stream] ElevenLabs not configured — set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID');
    return;
  }
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}/stream?output_format=ulaw_8000`,
      {
        method: 'POST',
        signal: abortSignal,
        headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // fastest model — optimized for real-time
          voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.15 },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('[kristy-stream] ElevenLabs error:', res.status, err);
      return;
    }
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value; // Uint8Array chunk of ulaw audio
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('[kristy-stream] TTS error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// OpenAI streaming — yields complete sentences as they form
// ---------------------------------------------------------------------------
async function* streamLLM(userText, history, systemPrompt, abortSignal) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12),
    { role: 'user', content: userText },
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: abortSignal,
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7, stream: true }),
  });
  if (!res.ok) {
    console.error('[kristy-stream] OpenAI error:', res.status);
    yield "I'm having a quick issue — give me just a second.";
    return;
  }

  let buffer = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      const trimmed = line.replace(/^data: /, '').trim();
      if (!trimmed || trimmed === '[DONE]') continue;
      try {
        const token = JSON.parse(trimmed).choices?.[0]?.delta?.content || '';
        buffer += token;
        // Yield complete sentences as they form
        const sentenceEnd = buffer.search(/[.!?]\s/);
        if (sentenceEnd !== -1) {
          const sentence = buffer.slice(0, sentenceEnd + 1).trim();
          buffer = buffer.slice(sentenceEnd + 2);
          if (sentence.length > 3) yield sentence;
        }
      } catch { /* skip malformed SSE line */ }
    }
  }
  // Yield any remaining text
  const remaining = buffer.trim();
  if (remaining.length > 3) yield remaining;
}

// ---------------------------------------------------------------------------
// Per-call session
// ---------------------------------------------------------------------------
class CallSession {
  constructor(ws) {
    this.ws          = ws;
    this.streamSid   = null;
    this.callSid     = null;
    this.history     = [];
    this.responding  = false;
    this.abort       = null; // AbortController for current response
    this.dgConn      = null; // Deepgram live connection
    this.dgReady     = false; // true once Deepgram WS is open
    this.audioBuffer = [];   // buffer audio until Deepgram is ready
    this.keepAlive   = null;
  }

  sendMedia(audioBytes) {
    if (this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { payload: Buffer.from(audioBytes).toString('base64') },
    }));
  }

  // Send N milliseconds of mulaw silence to let Twilio settle before real audio
  sendSilence(ms = 600) {
    const samples = Math.floor(8000 * ms / 1000);
    const silence = Buffer.alloc(samples, 0xFF); // 0xFF = silence in mulaw
    const chunkSize = 160; // 20ms chunks at 8kHz
    for (let i = 0; i < silence.length; i += chunkSize) {
      this.sendMedia(silence.slice(i, i + chunkSize));
    }
  }

  clearAudio() {
    if (this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
  }

  interrupt() {
    if (this.abort) { this.abort.abort(); this.abort = null; }
    this.clearAudio();
    this.responding = false;
  }

  async respond(userText) {
    if (this.responding) this.interrupt();
    this.responding = true;
    this.abort = new AbortController();
    const { signal } = this.abort;

    console.log(`[kristy-stream] ${this.callSid} → "${userText}"`);

    let fullReply = '';
    try {
      const systemPrompt = await getSystemPrompt();
      for await (const sentence of streamLLM(userText, this.history, systemPrompt, signal)) {
        if (signal.aborted) break;
        fullReply += (fullReply ? ' ' : '') + sentence;
        // Stream this sentence to TTS immediately — don't wait for full reply
        for await (const audioChunk of streamTTS(sentence, signal)) {
          if (signal.aborted) break;
          this.sendMedia(audioChunk);
        }
      }
      if (!signal.aborted && fullReply) {
        this.history.push({ role: 'user', content: userText });
        this.history.push({ role: 'assistant', content: fullReply });
        // Detect and handle message-taking tag
      const msgMatch = fullReply.match(/\[SEND_MSG:(\{.*?\})]\s*$/s);
      if (msgMatch) {
        try {
          const info = JSON.parse(msgMatch[1]);
          const tgText = `📞 <b>New message for Kevin</b>\n\n` +
            `<b>From:</b> ${info.name || 'Unknown'}\n` +
            `<b>Message:</b> ${info.message || 'N/A'}\n` +
            `<b>Callback #:</b> ${info.phone || 'Not provided'}\n` +
            `<b>Best time:</b> ${info.callback || 'Not specified'}`;
          sendTelegramMessage(tgText);
          fullReply = fullReply.replace(msgMatch[0], '').trim();
        } catch (e) {
          console.warn('[kristy-stream] Failed to parse SEND_MSG tag:', e.message);
        }
      }
      console.log(`[kristy-stream] ${this.callSid} ← "${fullReply}"`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('[kristy-stream] respond error:', err.message);
    } finally {
      if (!signal.aborted) this.responding = false;
    }
  }

  async greet() {
    // Silence first — lets Twilio media stream settle, eliminates screech on answer
    this.sendSilence(700);
    await new Promise(r => setTimeout(r, 300));
    const greeting = "Hey there, this is Kristy with HaulFlow! How can I help you today?";
    this.abort = new AbortController();
    for await (const chunk of streamTTS(greeting, this.abort.signal)) {
      this.sendMedia(chunk);
    }
    this.abort = null;
  }

  setupDeepgram() {
    if (!DEEPGRAM_KEY) {
      console.error('[kristy-stream] DEEPGRAM_API_KEY not set — cannot transcribe caller');
      return;
    }
    const dg = createClient(DEEPGRAM_KEY);
    this.dgConn = dg.listen.live({
      model:            'nova-2-phonecall',
      language:         'en-US',
      smart_format:     true,
      interim_results:  true,
      endpointing:      300,
      utterance_end_ms: 1000,
      encoding:         'mulaw',
      sample_rate:      8000,
      channels:         1,
    });

    // Use string literals as fallback in case enum import is stale
    const EV_OPEN       = LiveTranscriptionEvents?.Open       || 'open';
    const EV_TRANSCRIPT = LiveTranscriptionEvents?.Transcript || 'Results';
    const EV_UTTERANCE  = LiveTranscriptionEvents?.UtteranceEnd || 'UtteranceEnd';
    const EV_ERROR      = LiveTranscriptionEvents?.Error      || 'error';
    const EV_CLOSE      = LiveTranscriptionEvents?.Close      || 'close';

    this.dgConn.on(EV_OPEN, () => {
      console.log(`[kristy-stream] ${this.callSid} Deepgram OPEN — flushing ${this.audioBuffer.length} buffered packets`);
      this.dgReady = true;
      for (const chunk of this.audioBuffer) {
        try { this.dgConn.send(chunk); } catch { /* ignore */ }
      }
      this.audioBuffer = [];
      this.keepAlive = setInterval(() => {
        try { this.dgConn.keepAlive(); } catch { /* ignore */ }
      }, 8000);
    });

    // Debounce: accumulate is_final transcripts, respond after 600ms silence
    let pendingTranscript = '';
    let debounceTimer = null;

    const triggerRespond = () => {
      const text = pendingTranscript.trim();
      pendingTranscript = '';
      debounceTimer = null;
      if (text.length > 1 && !this.responding) {
        console.log(`[kristy-stream] ${this.callSid} responding to: "${text}"`);
        this.respond(text);
      }
    };

    this.dgConn.on(EV_TRANSCRIPT, (data) => {
      const alt = data.channel?.alternatives?.[0];
      const transcript = alt?.transcript?.trim();
      console.log(`[kristy-stream] transcript is_final:${data.is_final} speech_final:${data.speech_final} text:"${transcript}"`);
      if (!transcript) return;

      // Barge-in while Kristy is speaking
      if (this.responding && data.is_final) {
        this.interrupt();
      }

      if (data.is_final) {
        pendingTranscript += (pendingTranscript ? ' ' : '') + transcript;
        // speech_final = immediate trigger; otherwise debounce 600ms
        if (data.speech_final) {
          if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
          triggerRespond();
        } else {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(triggerRespond, 600);
        }
      }
    });

    // UtteranceEnd = Deepgram's secondary end-of-speech signal — fire if we have text
    this.dgConn.on(EV_UTTERANCE, () => {
      console.log(`[kristy-stream] ${this.callSid} UtteranceEnd received`);
      if (pendingTranscript.trim().length > 1) {
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        triggerRespond();
      }
    });

    this.dgConn.on(EV_ERROR, (err) => {
      console.error('[kristy-stream] Deepgram error:', JSON.stringify(err));
    });

    this.dgConn.on(EV_CLOSE, () => {
      if (this.keepAlive) { clearInterval(this.keepAlive); this.keepAlive = null; }
      console.log(`[kristy-stream] ${this.callSid} Deepgram CLOSED`);
    });
  }

  cleanup() {
    this.interrupt();
    if (this.keepAlive) { clearInterval(this.keepAlive); this.keepAlive = null; }
    try { this.dgConn?.requestClose(); } catch { /* ignore */ }
    console.log(`[kristy-stream] ${this.callSid} cleaned up`);
  }
}

// ---------------------------------------------------------------------------
// WebSocket server — attached to the Express HTTP server
// ---------------------------------------------------------------------------
export function registerTwilioStreamRoutes(app, httpServer) {
  // Voice webhook — returns TwiML that opens a Media Stream
  app.post('/api/twilio/voice', (req, res) => {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const wsUrl = baseUrl.replace(/^https?/, 'wss') + '/api/twilio/stream';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
    res.type('text/xml').send(twiml);
    console.log(`[kristy-stream] Incoming call → stream at ${wsUrl}`);
  });

  // SMS still works
  app.post('/api/twilio/sms', async (req, res) => {
    const Body = (req.body.Body || '').trim();
    if (!Body) return res.status(200).send('');
    try {
      const systemPrompt = await getSystemPrompt();
      const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: Body }];
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 }),
      });
      const d = await r.json();
      const reply = d.choices?.[0]?.message?.content?.trim() || "Hey! Give us a call and I can help you out.";
      const twilio = await import('twilio');
      const twiml = new twilio.default.twiml.MessagingResponse();
      twiml.message(reply);
      res.type('text/xml').send(twiml.toString());
    } catch (err) {
      console.error('[kristy-stream] SMS error:', err);
      res.status(500).send('');
    }
  });

  // WebSocket server on /api/twilio/stream
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/twilio/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const session = new CallSession(ws);

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.event) {
        case 'start':
          session.streamSid = msg.start.streamSid;
          session.callSid   = msg.start.callSid;
          session.setupDeepgram();
          session.greet();
          console.log(`[kristy-stream] Call started: ${session.callSid}`);
          break;

        case 'media': {
          const audio = Buffer.from(msg.media.payload, 'base64');
          if (session.dgReady && session.dgConn) {
            try { session.dgConn.send(audio); } catch (e) { console.warn('[kristy-stream] dgConn.send error:', e.message); }
          } else {
            session.audioBuffer.push(audio); // buffer until Deepgram is open
          }
          break;
        }

        case 'stop':
          session.cleanup();
          break;
      }
    });

    ws.on('close', () => session.cleanup());
    ws.on('error', (err) => {
      console.error('[kristy-stream] WS error:', err.message);
      session.cleanup();
    });
  });

  console.log('[kristy-stream] ✅ Media Streams registered on /api/twilio/stream');
}
