// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI (HTTP callback approach)
//
// Architecture:
//   Caller → Twilio → POST /api/twilio/voice → TwiML (<Say> then <Gather>)
//   Caller speaks → Twilio STT → POST /api/twilio/voice with SpeechResult → GPT → <Say> reply → loop

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 10;

// ---------------------------------------------------------------------------
// Kristy's brain
// ---------------------------------------------------------------------------

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
- If someone says goodbye or thanks, respond naturally and say something brief. Do NOT tell them to hang up or that the call is ending.`;

// ---------------------------------------------------------------------------
// GPT call
// ---------------------------------------------------------------------------

async function kristyThink(userText, history) {
  if (!OPENAI_KEY) {
    console.error('[kristy-voice] No OPENAI_API_KEY set');
    return "I'm sorry, I'm having a technical issue right now. Please call back later.";
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-16),
    { role: 'user', content: userText },
  ];

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
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
    const errText = await resp.text().catch(() => '');
    console.error('[kristy-voice] GPT error:', resp.status, errText.slice(0, 200));
    return "I'm having trouble thinking right now. Could you try again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

// ---------------------------------------------------------------------------
// Build a complete conversational TwiML turn
// ---------------------------------------------------------------------------

function buildTwiML(baseUrl, sayText, turnCount, history) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // Step 1: Kristy speaks her response
  twiml.say({ voice: VOICE }, sayText);

  // Step 2: Pause briefly so she stops talking before listening starts
  twiml.pause({ length: 1 });

  // Step 3: Listen for caller's response
  const historyParam = history.length > 0
    ? `&history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}`
    : '';
  const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}${historyParam}`;

  // First gather — give them 6 seconds to start speaking, 4 seconds of silence to know they're done
  const gather = twiml.gather({
    input: 'speech dtmf',
    action: actionUrl,
    method: 'POST',
    timeout: 6,
    speechTimeout: '4',
    maxSpeechTime: 30,
  });
  // Silent prompt — just listening, no nested <Say> to avoid transcribing Kristy's voice
  gather.pause({ length: 1 });

  // If first gather times out (no speech at all), try again with a prompt
  const retryUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}${historyParam}`;
  const gather2 = twiml.gather({
    input: 'speech dtmf',
    action: retryUrl,
    method: 'POST',
    timeout: 8,
    speechTimeout: '4',
    maxSpeechTime: 30,
  });
  gather2.say({ voice: VOICE }, "I didn't quite catch that. Could you repeat what you said?");

  // If still nothing — say goodbye gracefully
  twiml.say({ voice: VOICE }, "I'm not picking anything up, so I'll let you go. Feel free to call back anytime. Thanks for calling HaulFlow!");
  twiml.hangup();

  return twiml.toString();
}

// ---------------------------------------------------------------------------
// Handle incoming voice webhook
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const SpeechResult = (req.body.SpeechResult || '').trim();
    const turnCount = parseInt(req.query.turn || '0', 10) + 1;

    console.log(`[kristy-voice] Webhook hit. Turn: ${turnCount}. Speech: "${SpeechResult}"`);

    // Parse persisted history from URL params
    let history = [];
    try {
      const h = req.query.history || '';
      if (h) history = JSON.parse(decodeURIComponent(h));
    } catch {}

    let replyText;

    if (!SpeechResult || turnCount <= 1) {
      // First call — greeting (no speech input yet)
      replyText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (turnCount > MAX_TURNS) {
      // Safety limit
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.say({ voice: VOICE }, "Thanks so much for calling HaulFlow today. Have a wonderful day!");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      // Caller spoke — think and reply
      history.push({ role: 'user', content: SpeechResult });
      replyText = await kristyThink(SpeechResult, history);
      history.push({ role: 'assistant', content: replyText });

      // Check for goodbye signals
      const lower = replyText.toLowerCase();
      if (lower.includes('goodbye') || lower.includes('have a great day') || lower.includes('thanks for calling')) {
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();
        twiml.say({ voice: VOICE }, replyText);
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }
    }

    const twiml = buildTwiML(baseUrl, replyText, turnCount, history);
    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: VOICE }, "I'm sorry, something went wrong. Please try calling back.");
    twiml.hangup();
    res.type('text/xml');
    res.status(500).send(twiml.toString());
  }
}

// ---------------------------------------------------------------------------
// Handle incoming SMS
// ---------------------------------------------------------------------------

async function handleSmsWebhook(req, res) {
  try {
    const Body = (req.body.Body || '').trim();
    const From = req.body.From || 'unknown';
    console.log(`[kristy-voice] SMS from ${From}: "${Body}"`);

    if (!Body) return res.status(200).send('');

    const reply = await kristyThink(Body, []);
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message(reply);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (err) {
    console.error('[kristy-voice] SMS error:', err);
    res.status(500).send('');
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function registerTwilioVoiceRoutes(app) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');
  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);
  console.log('[kristy-voice] ✅ Twilio voice routes registered');
}
