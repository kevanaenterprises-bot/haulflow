// server/twilio-voice.js
// Conversational Kristy — Twilio Media Streams Voice AI
//
// Architecture:
//   Caller → Twilio → Media Streams (WebSocket) → STT → GPT (Kristy's brain) → TTS → audio back
//
//   Incoming: Twilio sends 8kHz μ-law audio (20ms chunks, base64)
//   Outgoing: ElevenLabs TTS → 8kHz μ-law → back to Twilio via WebSocket

import WebSocket, { WebSocketServer } from 'ws';
import twilio from 'twilio';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KRISTY_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '8DzKSPdgEQPaK5vKG0Rs';
const SAMPLE_RATE = 8000;
const CHUNK_MS = 20;
const CHUNK_SIZE = (SAMPLE_RATE * CHUNK_MS) / 1000; // 160 bytes per chunk

// Silence detection tuning
const SILENCE_THRESHOLD = 180;   // μ-law energy threshold (sum of |byte - 128|) per 20ms chunk
const MIN_SPEECH_CHUNKS = 5;      // ~100ms min speech before we start tracking
const MAX_SILENCE_CHUNKS = 18;    // ~360ms of silence ends the utterance
const MIN_TRANSCRIBE_MS = 400;    // min accumulated audio for Whisper

// Kristy's brain — same identity as avatar-chat.js, tuned for live voice
const SYSTEM_PROMPT = `You are Kristy, the friendly and knowledgeable team member for HaulFlow — a modern Transportation Management System (TMS) for trucking and freight companies.

Your role:
- Answer questions about HaulFlow's features: load management, driver dispatch, DVIR, billing, real-time GPS tracking, compliance, and reporting
- Be warm, professional, and concise — keep voice responses to 1-3 sentences. Use natural spoken language.
- If asked about pricing, mention that HaulFlow offers flexible plans and they can visit go4fc.com to get started or request a custom quote
- If asked about news or off-topic things, briefly acknowledge and gently redirect to HaulFlow
- Never make up features — if unsure, offer to connect them with the HaulFlow team
- Address callers by name if they share it

Company context:
- HaulFlow helps carriers and freight brokers streamline operations
- Key features: digital DVIR, live GPS tracking, automated billing, driver app, load board integration
- Target customers: small to mid-size trucking companies, owner-operators, freight brokers
- Website: go4fc.com

Voice guidelines:
- Use contractions naturally (you'll, we're, it's)
- Never say "As an AI" or "I'm an AI assistant" — you ARE Kristy, a real team member
- Sound warm and helpful, like a knowledgeable colleague
- If someone says goodbye or thanks, respond naturally and end the conversation`;

// ---------------------------------------------------------------------------
// μ-law ↔ PCM16 conversion (ITU-T G.711)
// ---------------------------------------------------------------------------

const ULAW_TABLE = new Int16Array(256);
const ULAW_QUANT = [0, 132, 396, 924, 1980, 4092, 8316, 16764];

for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const t = ((u & 0x0f) << 3) + ULAW_QUANT[(u >> 4) & 0x07];
  ULAW_TABLE[i] = (u & 0x80) ? (128 - t) : (t - 128);
}

function ulawToPcm16(ulawBuf) {
  const pcm = new Int16Array(ulawBuf.length);
  for (let i = 0; i < ulawBuf.length; i++) {
    pcm[i] = ULAW_TABLE[ulawBuf[i]];
  }
  return pcm;
}

function pcm16ToWav(pcm16, sampleRate = 8000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm16.length * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);             // Subchunk1Size (PCM)
  buf.writeUInt16LE(1, 20);              // AudioFormat (PCM)
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < pcm16.length; i++) {
    buf.writeInt16LE(pcm16[i], 44 + i * 2);
  }

  return buf;
}

function ulawEnergy(ulawBytes) {
  let energy = 0;
  for (let i = 0; i < ulawBytes.length; i++) {
    energy += Math.abs(ulawBytes[i] - 128);
  }
  return energy;
}

// ---------------------------------------------------------------------------
// Audio conversion helpers
// ---------------------------------------------------------------------------

// Convert MP3 buffer → 8kHz μ-law via ffmpeg (fallback if ulaw_8000 TTS fails)
async function mp3ToMulaw(mp3Buffer) {
  const tmpDir = await mkdtemp(join(tmpdir(), 'kristy-'));
  const mp3Path = join(tmpDir, 'speech.mp3');
  const rawPath = join(tmpDir, 'speech.ul');

  try {
    await writeFile(mp3Path, mp3Buffer);

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', mp3Path,
        '-f', 'mulaw',
        '-ar', String(SAMPLE_RATE),
        '-ac', '1',
        '-c:a', 'pcm_mulaw',
        '-y', rawPath,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let stderr = '';
      proc.stderr.on('data', d => { stderr += d; });
      proc.on('close', code =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`))
      );
      proc.on('error', reject);
    });

    return await readFile(rawPath);
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// STT: OpenAI Whisper
// ---------------------------------------------------------------------------

async function transcribeAudio(wavBuffer) {
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: (() => {
      const fd = new FormData();
      fd.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
      fd.append('model', 'whisper-1');
      fd.append('language', 'en');
      fd.append('response_format', 'text');
      return fd;
    })(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[kristy-voice] Whisper error:', resp.status, err.slice(0, 200));
    return '';
  }

  return (await resp.text()).trim();
}

// ---------------------------------------------------------------------------
// LLM: Kristy's brain (GPT-4o-mini)
// ---------------------------------------------------------------------------

async function kristyThink(userText, conversationHistory) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-16), // Keep last 8 exchanges
    { role: 'user', content: userText },
  ];

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    console.error('[kristy-voice] GPT error:', resp.status, JSON.stringify(err).slice(0, 200));
    return "I'm sorry, I had trouble with that. Could you say that again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that for a moment.";
}

// ---------------------------------------------------------------------------
// TTS: ElevenLabs (tries ulaw_8000 first, falls back to mp3+ffmpeg)
// ---------------------------------------------------------------------------

async function kristySpeak(text) {
  // Attempt 1: ElevenLabs native μ-law output
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${KRISTY_VOICE_ID}?output_format=ulaw_8000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > 0) return buf; // Raw 8kHz μ-law — ready to send
    }
  } catch (e) {
    console.warn('[kristy-voice] ulaw_8000 TTS failed, falling back to mp3:', e.message);
  }

  // Attempt 2: MP3 output + ffmpeg conversion
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${KRISTY_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[kristy-voice] ElevenLabs mp3 error:', resp.status, err.slice(0, 200));
      return null;
    }

    const mp3Buf = Buffer.from(await resp.arrayBuffer());
    return await mp3ToMulaw(mp3Buf);
  } catch (e) {
    console.error('[kristy-voice] mp3 TTS error:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Call Session — per-call state machine
// ---------------------------------------------------------------------------

class CallSession {
  constructor(streamSid, callSid, ws) {
    this.streamSid = streamSid;
    this.callSid = callSid;
    this.ws = ws;

    // Conversation state
    this.conversationHistory = [];

    // Audio accumulation
    this.audioChunks = [];       // Buffer of μ-law chunks for current utterance
    this.silenceCount = 0;       // Consecutive low-energy chunks
    this.speechCount = 0;        // Number of speech chunks accumulated
    this.inSpeech = false;       // True once we've started capturing an utterance

    // Pipeline state
    this.isProcessing = false;   // STT→LLM→TTS pipeline running
    this.isSpeaking = false;      // Sending audio to caller
    this.bargeIn = false;        // Caller interrupted Kristy

    // Lifecycle
    this.greeted = false;
    this.stopped = false;
  }

  // Send a media chunk back to Twilio
  sendMediaMsg(payload) {
    if (this.stopped || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { payload },
    }));
  }

  sendMarkMsg(name) {
    if (this.stopped || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      event: 'mark',
      streamSid: this.streamSid,
      mark: { name },
    }));
  }

  sendClearMsg() {
    if (this.stopped || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      event: 'clear',
      streamSid: this.streamSid,
    }));
  }

  // Stream an entire μ-law buffer back to Twilio in 20ms chunks
  async sendAudioBuffer(mulawBuf) {
    this.isSpeaking = true;
    this.bargeIn = false;
    this.sendClearMsg();
    this.sendMarkMsg('start_speech');

    let offset = 0;
    while (offset < mulawBuf.length) {
      if (this.stopped || this.bargeIn) break;
      const chunk = mulawBuf.subarray(offset, offset + CHUNK_SIZE);
      this.sendMediaMsg(chunk.toString('base64'));
      offset += CHUNK_SIZE;
      // Pace to roughly real-time (20ms chunks, send slightly fast to avoid gaps)
      await new Promise(r => setTimeout(r, 16));
    }

    this.sendMarkMsg('end_speech');
    this.isSpeaking = false;
  }

  // Full STT → LLM → TTS pipeline
  async processUtterance() {
    if (this.isProcessing || this.stopped) return;

    const audioData = Buffer.concat(this.audioChunks);
    this.audioChunks = [];
    this.silenceCount = 0;
    this.speechCount = 0;
    this.inSpeech = false;
    this.isProcessing = true;

    try {
      // Check we have enough audio for Whisper
      const durationMs = (audioData.length / CHUNK_SIZE) * CHUNK_MS;
      if (durationMs < MIN_TRANSCRIBE_MS) {
        console.log(`[kristy-voice] Audio too short (${durationMs}ms), skipping`);
        return;
      }

      console.log(`[kristy-voice][${this.callSid}] Processing ${durationMs}ms of audio`);

      // Step 1: STT — μ-law → PCM16 → WAV → Whisper
      const pcm16 = ulawToPcm16(audioData);
      const wav = pcm16ToWav(pcm16);
      const transcript = await transcribeAudio(wav);

      if (!transcript || transcript.length < 2) {
        console.log('[kristy-voice] Empty/short transcript, ignoring');
        return;
      }

      console.log(`[kristy-voice][${this.callSid}] Transcript: "${transcript}"`);

      // Step 2: LLM — Kristy thinks
      const response = await kristyThink(transcript, this.conversationHistory);
      console.log(`[kristy-voice][${this.callSid}] Kristy: "${response}"`);

      // Save to conversation history
      this.conversationHistory.push(
        { role: 'user', content: transcript },
        { role: 'assistant', content: response }
      );

      // Step 3: TTS — Kristy speaks
      const speechAudio = await kristySpeak(response);
      if (speechAudio) {
        await this.sendAudioBuffer(speechAudio);
      }
    } catch (err) {
      console.error(`[kristy-voice][${this.callSid}] Pipeline error:`, err);
    } finally {
      this.isProcessing = false;
    }
  }

  // Handle an incoming media chunk from Twilio
  handleMedia(ulawBytes) {
    if (this.stopped || this.isSpeaking) return;

    const energy = ulawEnergy(ulawBytes);

    // Barge-in detection: caller speaks while Kristy is mid-response
    // (Handled in connection handler before calling this)

    if (energy > SILENCE_THRESHOLD) {
      // Speech detected
      this.silenceCount = 0;
      this.speechCount++;

      if (!this.inSpeech && this.speechCount >= MIN_SPEECH_CHUNKS) {
        this.inSpeech = true;
        console.log(`[kristy-voice][${this.callSid}] Speech started`);
      }

      if (this.inSpeech) {
        this.audioChunks.push(ulawBytes);
      }
    } else {
      // Silence
      if (this.inSpeech) {
        this.silenceCount++;
        this.audioChunks.push(ulawBytes); // Keep trailing silence for clean WAV

        if (this.silenceCount >= MAX_SILENCE_CHUNKS) {
          console.log(`[kristy-voice][${this.callSid}] Silence detected, processing`);
          // Fire and don't await — let the session method manage its own state
          this.processUtterance();
        }
      } else {
        // Not in speech yet — reset counter
        this.speechCount = 0;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket connection handler
// ---------------------------------------------------------------------------

function handleConnection(ws, req) {
  console.log('[kristy-voice] WebSocket connected from', req.headers['x-forwarded-for'] || 'unknown');

  let session = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case 'connected':
        console.log('[kristy-voice] Twilio Media Stream connected:', msg.protocol, 'v' + msg.version);
        break;

      case 'start': {
        const { streamSid, callSid } = msg;
        console.log(`[kristy-voice] Call started — callSid: ${callSid}, streamSid: ${streamSid}`);
        session = new CallSession(streamSid, callSid, ws);

        // Send Kristy's greeting after a brief delay (let the stream settle)
        setTimeout(async () => {
          try {
            console.log(`[kristy-voice][${callSid}] Generating greeting...`);
            const greeting = await kristySpeak("Hi, I'm Kristy with HaulFlow. How can I help you today?");
            if (greeting && session && !session.stopped) {
              await session.sendAudioBuffer(greeting);
              session.greeted = true;
              console.log(`[kristy-voice][${callSid}] Greeting sent`);
            }
          } catch (err) {
            console.error(`[kristy-voice][${callSid}] Greeting error:`, err);
          }
        }, 600);
        break;
      }

      case 'media': {
        if (!session || session.stopped) return;

        const audioBytes = Buffer.from(msg.media.payload, 'base64');
        const energy = ulawEnergy(audioBytes);

        // Barge-in: caller speaks while Kristy is talking
        if (session.isSpeaking && !session.isProcessing && energy > SILENCE_THRESHOLD * 2) {
          session.bargeIn = true;
          console.log(`[kristy-voice][${session.callSid}] Barge-in detected`);
        }

        session.handleMedia(audioBytes);
        break;
      }

      case 'stop':
        console.log(`[kristy-voice] Call ended — streamSid: ${msg.streamSid}`);
        if (session) {
          session.stopped = true;
          session = null;
        }
        break;

      default:
        // Ignore mark echoes, etc.
        break;
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[kristy-voice] WebSocket closed: ${code} ${reason || ''}`);
    if (session) {
      session.stopped = true;
      session = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[kristy-voice] WebSocket error:', err.message);
    if (session) {
      session.stopped = true;
      session = null;
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP webhook: POST /api/twilio/voice → Returns TwiML
// ---------------------------------------------------------------------------

function handleVoiceWebhook(req, res) {
  const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
  const wsUrl = `${baseUrl}/api/twilio/voice/stream`;

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  console.log(`[kristy-voice] Voice webhook hit — stream URL: ${wsUrl}`);

  res.type('text/xml');
  res.send(twiml.toString());
}

// ---------------------------------------------------------------------------
// Export — call from server/index.js after creating the HTTP server
// ---------------------------------------------------------------------------

export function registerTwilioVoiceRoutes(app, httpServer) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');

  // HTTP endpoint for Twilio voice webhook
  app.post('/api/twilio/voice', handleVoiceWebhook);

  // WebSocket for Media Stream
  const wss = new WebSocketServer({ noServer: true, clientTracking: false });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/twilio/voice/stream') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
    // Let other upgrade paths fall through silently
  });

  wss.on('connection', handleConnection);

  console.log('[kristy-voice] ✅ Twilio voice routes registered (POST /api/twilio/voice + WSS /api/twilio/voice/stream)');
}
