// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI (HTTP callback approach)
//
// Architecture:
//   Caller → Twilio → POST /api/twilio/voice → TwiML (<Gather> with nested <Say>)
//   Kristy speaks INSIDE the <Gather> so Twilio listens simultaneously
//   Caller speaks → Twilio STT → POST to action URL → GPT brain → <Say> reply → loop

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 12;

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
- If someone says goodbye or thanks, respond naturally and say something brief. Do NOT tell them to hang up.`;

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
// Build TwiML — Say is INSIDE Gather so Twilio listens while Kristy speaks
// ---------------------------------------------------------------------------

function buildTwiML(baseUrl, sayText, turnCount, history) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}`;

  // KEY FIX: <Say> is nested INSIDE <Gather>
  // This means Twilio listens for speech WHILE Kristy talks
  // Caller can interrupt (barge-in) or speak after she finishes
  const gather = twiml.gather({
    input: 'speech',
    action: actionUrl,
    method: 'POST',
    timeout: 12,           // wait up to 12s for caller to start speaking
    speechTimeout: 'auto', // let Twilio auto-detect end of speech
    maxSpeechTime: 30,
    speechModel: 'phone_call',
    language: 'en-US',
  });
  gather.say({ voice: VOICE }, sayText);

  // Fallback: if Gather times out with no speech at all
  const fallbackUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}&retry=1`;
  const gather2 = twiml.gather({
    input: 'speech',
    action: fallbackUrl,
    method: 'POST',
    timeout: 12,
    speechTimeout: 'auto',
    maxSpeechTime: 30,
    speechModel: 'phone_call',
    language: 'en-US',
  });
  gather2.say({ voice: VOICE }, "I didn't quite catch that. What can I help you with?");

  // If still nothing — goodbye
  twiml.say({ voice: VOICE }, "I'm not picking anything up right now. Feel free to call back anytime. Thanks for calling HaulFlow!");
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
    const isRetry = req.query.retry === '1';

    console.log(`[kristy-voice] Webhook hit. Turn: ${turnCount}. Retry: ${isRetry}. Speech: "${SpeechResult}"`);

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
      // Caller spoke — Kristy thinks and replies
      replyText = await kristyThink(SpeechResult, []);

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

    const twiml = buildTwiML(baseUrl, replyText, turnCount, []);
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
