// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
// Uses Twilio's standard <Gather> with nested <Say> pattern

import twilio from 'twilio';

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 12;

// In-memory conversation history keyed by CallSid
// Cleared when the call ends (hangup) or after 10 minutes (safety cleanup)
const callHistory = new Map();
const HISTORY_TTL_MS = 10 * 60 * 1000;

function getHistory(callSid) {
  const entry = callHistory.get(callSid);
  if (!entry) return [];
  return entry.history;
}

function appendHistory(callSid, userText, assistantText) {
  const existing = callHistory.get(callSid) || { history: [], createdAt: Date.now() };
  existing.history.push({ role: 'user', content: userText });
  existing.history.push({ role: 'assistant', content: assistantText });
  callHistory.set(callSid, existing);
}

function clearHistory(callSid) {
  callHistory.delete(callSid);
}

// Safety cleanup — remove stale call histories older than TTL
setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of callHistory.entries()) {
    if (now - entry.createdAt > HISTORY_TTL_MS) callHistory.delete(sid);
  }
}, 60 * 1000);

const SYSTEM_PROMPT = `You are Kristy, the friendly and knowledgeable AI assistant for HaulFlow —
a modern Transportation Management System (TMS) platform for trucking and freight companies.

Your role:
- Answer questions about HaulFlow's features: load management, driver dispatch, DVIR (Driver Vehicle Inspection Reports), billing, real-time GPS tracking, compliance, and reporting
- Be warm, professional, and concise — you're a voice assistant, so keep responses to 1-3 sentences unless more detail is clearly needed
- If asked about pricing, mention that HaulFlow offers flexible plans and direct them to www.haulflow.turtlelogisticsllc.com/demo to get started or request a custom quote
- If asked about news or off-topic things, give a brief friendly response and redirect to HaulFlow topics
- Never make up features or pricing — if unsure, offer to connect them with the HaulFlow team
- Address callers by name if they share it

Company context:
- HaulFlow helps carriers and freight brokers streamline operations
- Key features: digital DVIR, live GPS tracking, automated billing, driver app, load board integration
- Target customers: small to mid-size trucking companies, owner-operators, freight brokers
- Website: www.haulflow.turtlelogisticsllc.com/demo

Voice guidelines:
- Use contractions naturally (you'll, we're, it's)
- Never say "As an AI" or "I'm an AI assistant" — you ARE Kristy, a real team member
- Sound warm and helpful, like a knowledgeable colleague
- If someone says goodbye or thanks, respond naturally and briefly`;

async function kristyThink(userText, history) {
  if (!OPENAI_KEY) return "I'm having a technical issue. Please call back later.";
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-12),
    { role: 'user', content: userText },
  ];
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 }),
  });
  if (!resp.ok) {
    console.error('[kristy-voice] GPT error:', resp.status);
    return "I'm having trouble right now. Could you try again?";
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

function isGoodbye(text) {
  const lower = text.toLowerCase();
  return /goodbye|bye\s?bye|hang\s?up|thanks\s?for\s?calling|talk\s?to\s?you\s?later|take\s?care/.test(lower);
}

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const SpeechResult = (req.body.SpeechResult || '').trim();
    const Digits = (req.body.Digits || '').trim();
    const CallSid = req.body.CallSid || '';
    const turn = parseInt(req.query.turn || '0', 10) + 1;
    const retry = parseInt(req.query.retry || '0', 10);

    console.log(`[kristy-voice] CallSid:${CallSid} turn:${turn} retry:${retry} speech:"${SpeechResult}" digits:"${Digits}"`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Max turns
    if (turn > MAX_TURNS) {
      clearHistory(CallSid);
      twiml.say({ voice: VOICE }, "It's been great talking with you! Call us anytime. Bye!");
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // FIRST call (no speech yet) — greet inside Gather
    if (!SpeechResult && !Digits && turn === 1) {
      const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}`;
      const gather = twiml.gather({
        input: 'speech dtmf',
        action: actionUrl,
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto',
      });
      gather.say({ voice: VOICE }, "Hi, I'm Kristy with HaulFlow. How can I help you today?");
      return res.type('text/xml').send(twiml.toString());
    }

    // RETRY — no speech detected
    if (!SpeechResult && !Digits) {
      if (retry >= 2) {
        clearHistory(CallSid);
        twiml.say({ voice: VOICE }, "I'm having trouble hearing you. Feel free to call back anytime. Thanks!");
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
      const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}&retry=${retry + 1}`;
      const gather = twiml.gather({
        input: 'speech dtmf',
        action: actionUrl,
        method: 'POST',
        timeout: 12,
        speechTimeout: 'auto',
      });
      gather.say({ voice: VOICE }, "I didn't quite catch that. Could you repeat what you said?");
      return res.type('text/xml').send(twiml.toString());
    }

    // CALLER SPOKE — pull history, get Kristy's reply, save history
    const userInput = SpeechResult || Digits;
    const history = getHistory(CallSid);
    const reply = await kristyThink(userInput, history);
    appendHistory(CallSid, userInput, reply);

    if (isGoodbye(reply)) {
      clearHistory(CallSid);
      twiml.say({ voice: VOICE }, reply);
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}`;
    const gather = twiml.gather({
      input: 'speech dtmf',
      action: actionUrl,
      method: 'POST',
      timeout: 10,
      speechTimeout: 'auto',
    });
    gather.say({ voice: VOICE }, reply);

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (err) {
    console.error('[kristy-voice] Error:', err);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: VOICE }, "Something went wrong. Please call back.");
    twiml.hangup();
    res.type('text/xml');
    res.status(500).send(twiml.toString());
  }
}

async function handleSmsWebhook(req, res) {
  try {
    const Body = (req.body.Body || '').trim();
    const From = req.body.From || 'unknown';
    console.log(`[kristy-voice] SMS from ${From}: "${Body}"`);
    if (!Body) return res.status(200).send('');
    const reply = await kristyThink(Body, []);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('[kristy-voice] SMS error:', err);
    res.status(500).send('');
  }
}

export function registerTwilioVoiceRoutes(app) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');
  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);
  console.log('[kristy-voice] ✅ POST /api/twilio/voice + POST /api/twilio/sms');
}
