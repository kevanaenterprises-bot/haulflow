// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
//
// Standard pattern: <Say> → <Gather> → caller speaks → POST back → GPT → <Say> → <Gather> → loop
// No nested Say inside Gather — that confuses the speech recognizer

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 15;

// ---------------------------------------------------------------------------
// Kristy's brain (same identity as avatar-chat.js)
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
// Goodbye detection
// ---------------------------------------------------------------------------

function isGoodbye(text) {
  const lower = text.toLowerCase();
  return /goodbye|bye\s?bye|hang\s?up|thanks\s?for\s?calling|have\s?a\s?great\s?day|talk\s?to\s?you\s?later|take\s?care/.test(lower);
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const SpeechResult = (req.body.SpeechResult || '').trim();
    const Digits = (req.body.Digits || '').trim();
    const turnCount = parseInt(req.query.turn || '0', 10) + 1;
    const retryCount = parseInt(req.query.retry || '0', 10);

    console.log(`[kristy-voice] Turn:${turnCount} Retry:${retryCount} Speech:"${SpeechResult}" Digits:"${Digits}"`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // --- Max turns safety ---
    if (turnCount > MAX_TURNS) {
      twiml.say({ voice: VOICE }, "It's been great talking with you! Feel free to call us anytime. Have a wonderful day!");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // --- Determine what to say ---
    let sayText;

    if (!SpeechResult && !Digits && turnCount <= 1) {
      // FIRST call — greeting only
      sayText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (!SpeechResult && !Digits) {
      // No speech detected on a retry — prompt again or give up
      if (retryCount >= 2) {
        twiml.say({ voice: VOICE }, "I'm having trouble hearing you. Feel free to call back anytime. Thanks for calling HaulFlow!");
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }
      sayText = "I didn't quite catch that. Could you say that again?";
    } else {
      // Caller spoke! Kristy thinks.
      const userInput = SpeechResult || `they pressed ${Digits}`;
      const reply = await kristyThink(userInput, []);

      // Check for goodbye
      if (isGoodbye(reply)) {
        twiml.say({ voice: VOICE }, reply);
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      sayText = reply;
    }

    // --- Build response: <Say> first, THEN <Gather> (never nested) ---
    // Kristy speaks first, then listens
    twiml.say({ voice: VOICE }, sayText);

    // Now listen — caller has up to 10s to start, 3s silence to end
    const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}&retry=${retryCount}`;
    twiml.gather({
      input: 'speech dtmf',
      action: actionUrl,
      method: 'POST',
      timeout: 10,
      speechTimeout: '3',
      maxSpeechTime: 30,
    });

    // If Gather times out with no input — retry
    const retryUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}&retry=${retryCount + 1}`;
    twiml.redirect(retryUrl);

    res.type('text/xml');
    res.send(twiml.toString());

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
// SMS handler
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
// Export — no httpServer needed, just Express routes
// ---------------------------------------------------------------------------

export function registerTwilioVoiceRoutes(app) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');
  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);
  console.log('[kristy-voice] ✅ POST /api/twilio/voice + POST /api/twilio/sms');
}
