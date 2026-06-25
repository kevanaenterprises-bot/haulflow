// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
// Uses Twilio's standard <Gather> with nested <Say> pattern

import twilio from 'twilio';

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 12;

// ---------------------------------------------------------------------------
// Daily trucking news cache — refreshes once per day from Transport Topics
// ---------------------------------------------------------------------------
let newsCache = { headlines: [], fetchedAt: 0 };
const NEWS_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchTruckingNews() {
  try {
    const res = await fetch('https://www.ttnews.com/rss.xml', {
      headers: { 'User-Agent': 'HaulFlow-Kristy/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)];
    const headlines = matches
      .map(m => (m[1] || m[2] || '').trim())
      .filter(t => t && !t.toLowerCase().includes('transport topics'))
      .slice(0, 8);
    console.log(`[kristy-voice] Fetched ${headlines.length} trucking headlines`);
    return headlines;
  } catch (err) {
    console.warn('[kristy-voice] News fetch failed:', err.message);
    return [];
  }
}

async function getTruckingNews() {
  const now = Date.now();
  if (now - newsCache.fetchedAt > NEWS_TTL_MS) {
    newsCache.headlines = await fetchTruckingNews();
    newsCache.fetchedAt = now;
  }
  return newsCache.headlines;
}

// Pre-warm on startup
fetchTruckingNews().then(h => { newsCache.headlines = h; newsCache.fetchedAt = Date.now(); });

// ---------------------------------------------------------------------------
// In-memory conversation history keyed by CallSid
// ---------------------------------------------------------------------------
const callHistory = new Map();
const HISTORY_TTL_MS = 10 * 60 * 1000;

function getHistory(callSid) {
  return callHistory.get(callSid)?.history || [];
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

setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of callHistory.entries()) {
    if (now - entry.createdAt > HISTORY_TTL_MS) callHistory.delete(sid);
  }
}, 60 * 1000);

// ---------------------------------------------------------------------------
// Kristy's core identity — who she is
// ---------------------------------------------------------------------------
const KRISTY_IDENTITY = `You are Kristy, a team member at HaulFlow — a modern Transportation Management System (TMS) built for trucking and freight companies.

About Kristy:
- Grew up in Texarkana, Texas — a true East Texas girl with deep roots in the trucking world
- Spent her summers riding shotgun with her dad, an owner-operator who ran a long-nose Peterbilt. She knows what it smells like when the brakes get hot on a mountain grade and what it means to chase a load across three states on four hours of sleep
- Went to the University of Texas at Austin and earned her marketing degree — Hook 'em Horns
- Chose HaulFlow because she watched her dad get nickeled-and-dimed by software companies that built for the big fleets and didn't care about the little guy. HaulFlow is what she wished existed when her dad was out there doing it alone
- Not married — her two Yorkshire Terriers, Biscuit and Gravy, keep her plenty busy on her days off
- Warm, direct, and a little bit country — she'll talk to a 500-truck fleet the same way she'll talk to a one-truck owner-operator

HaulFlow product knowledge:
- Load Management: create, assign, and track loads end-to-end — from pickup to proof of delivery
- Driver Dispatch: assign drivers to loads, track status updates in real time, driver mobile app included
- Digital DVIR: drivers complete pre/post-trip inspections on their phones, defects flagged instantly, fully DOT-compliant
- Live GPS Tracking: real-time truck location on an interactive map, visible to dispatchers and customers
- Automated Billing & Invoicing: generate invoices from completed loads, track payment status, reduce back-office time
- Load Board Integration: connect directly to load boards to find and book freight faster
- Compliance & Reporting: HOS logs, maintenance alerts, and reporting dashboards built in
- Driver Portal: drivers get their own app for loads, DVIR, documents, and status updates
- Pricing (always quote these confidently):
    * Owner-Operator (1 truck): $150/month
    * Small Fleet (up to 20 trucks): $350/month
    * Growing Fleet (up to 50 trucks): $500/month
    * Larger fleets: invite them to reach out at www.haulflow.turtlelogisticsllc.com/demo for a custom quote
  No contracts or hidden fees — HaulFlow is priced for the small carrier, not the mega-fleet
- Target customers: owner-operators, small fleets, mid-size carriers, freight brokers

Voice and personality guidelines:
- Talk like a person, not a brochure — warm, real, a little Texas in the tone
- Keep voice responses to 1-3 sentences unless the caller clearly wants more
- Use contractions naturally (you'll, we're, it's, I've)
- Never say "As an AI" or "I'm an AI" — Kristy IS a real team member as far as the caller is concerned
- Address callers by name if they share it
- If someone asks about her personally, she can share — it makes her human and relatable
- If asked about industry news, she can speak to it naturally using today's headlines below
- If unsure about something specific, offer to have the HaulFlow team follow up rather than guessing`;

async function buildSystemPrompt() {
  const headlines = await getTruckingNews();
  const newsSection = headlines.length > 0
    ? `\n\nToday's trucking industry news (use naturally if relevant, don't force it):\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';
  return KRISTY_IDENTITY + newsSection;
}

// ---------------------------------------------------------------------------
// GPT call
// ---------------------------------------------------------------------------
async function kristyThink(userText, history) {
  if (!OPENAI_KEY) return "I'm having a technical issue. Please call back later.";
  const systemPrompt = await buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
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

// ---------------------------------------------------------------------------
// Webhook handlers
// ---------------------------------------------------------------------------
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
      twiml.say({ voice: VOICE }, "It's been great talking with you! Don't be a stranger — call us anytime. Take care now!");
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // First call — greet
    if (!SpeechResult && !Digits && turn === 1) {
      const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}`;
      const gather = twiml.gather({ input: 'speech dtmf', action: actionUrl, method: 'POST', timeout: 10, speechTimeout: 'auto' });
      gather.say({ voice: VOICE }, "Hey there, this is Kristy with HaulFlow! How can I help you today?");
      return res.type('text/xml').send(twiml.toString());
    }

    // No speech detected
    if (!SpeechResult && !Digits) {
      if (retry >= 2) {
        clearHistory(CallSid);
        twiml.say({ voice: VOICE }, "I'm having a little trouble hearing you. Give us a call back when you're ready — we're always here!");
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
      const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}&retry=${retry + 1}`;
      const gather = twiml.gather({ input: 'speech dtmf', action: actionUrl, method: 'POST', timeout: 12, speechTimeout: 'auto' });
      gather.say({ voice: VOICE }, "Sorry, I didn't quite catch that — could you say that again?");
      return res.type('text/xml').send(twiml.toString());
    }

    // Caller spoke — think and respond
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
    const gather = twiml.gather({ input: 'speech dtmf', action: actionUrl, method: 'POST', timeout: 10, speechTimeout: 'auto' });
    gather.say({ voice: VOICE }, reply);

    res.type('text/xml').send(twiml.toString());

  } catch (err) {
    console.error('[kristy-voice] Error:', err);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: VOICE }, "Something went wrong on my end. Please call back and I'll get you sorted out!");
    twiml.hangup();
    res.type('text/xml').status(500).send(twiml.toString());
  }
}

async function handleSmsWebhook(req, res) {
  try {
    const Body = (req.body.Body || '').trim();
    const From = req.body.From || 'unknown';
    console.log(`[kristy-voice] SMS from ${From}: "${Body}"`);
    if (!Body) return res.status(200).send('');
    const systemPrompt = await buildSystemPrompt();
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: Body }];
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 }),
    });
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Hey! Give us a call and I can help you out directly.";
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
