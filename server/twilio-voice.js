// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI (HTTP callback approach, no WebSocket)
//
// Architecture:
//   Caller → Twilio → POST /api/twilio/voice → TwiML (<Gather> + <Say>)
//   Caller speaks → Twilio STT → POST /api/twilio/voice with SpeechResult → GPT → <Say> reply → loop

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const KRISTY_VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna'; // Amazon Polly voice
const GATHER_TIMEOUT = 5; // seconds of silence before Gather submits
const MAX_TURNS = 10; // safety limit on conversation turns

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
- If someone says goodbye or thanks, respond naturally — just say something like "Thanks for calling, have a great day!" and do NOT include any indication that the call should end. The system handles hangup.`;

// ---------------------------------------------------------------------------
// GPT call
// ---------------------------------------------------------------------------

async function kristyThink(userText, history) {
  if (!OPENAI_KEY) {
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
    console.error('[kristy-voice] GPT error:', resp.status);
    return "I'm having trouble thinking right now. Could you try again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

// ---------------------------------------------------------------------------
// Build TwiML
// ---------------------------------------------------------------------------

function buildTwiML(sayText, turnCount) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: 'speech',
    action: '/api/twilio/voice',
    method: 'POST',
    timeout: GATHER_TIMEOUT,
    speechTimeout: 'auto',
    maxSpeechTime: 30,
  });

  gather.say({ voice: KRISTY_VOICE }, sayText);

  // If Gather times out (no speech), say goodbye
  twiml.say({ voice: KRISTY_VOICE }, "I didn't catch that. Thanks for calling HaulFlow, have a great day!");
  twiml.hangup();

  return twiml.toString();
}

// ---------------------------------------------------------------------------
// Handle incoming voice webhook
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const SpeechResult = (req.body.SpeechResult || '').trim();
    const turnCount = parseInt(req.body.turnCount || '0', 10) + 1;

    console.log(`[kristy-voice] Webhook hit. Turn: ${turnCount}. Speech: "${SpeechResult}"`);

    let replyText;
    let history = [];

    // Try to parse history from cookie
    if (req.headers.cookie) {
      try {
        const match = req.headers.cookie.match(/kristy_history=([^;]+)/);
        if (match) {
          history = JSON.parse(decodeURIComponent(match[1]));
        }
      } catch {}
    }

    if (!SpeechResult || turnCount <= 1) {
      // First call — greet
      replyText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (turnCount > MAX_TURNS) {
      // Safety limit
      replyText = "Thanks so much for calling HaulFlow today. Have a wonderful day!";
      res.type('text/xml');
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.say({ voice: KRISTY_VOICE }, replyText);
      twiml.hangup();
      return res.send(twiml.toString());
    } else {
      // Caller said something — run through Kristy's brain
      history.push({ role: 'user', content: SpeechResult });
      replyText = await kristyThink(SpeechResult, history);
      history.push({ role: 'assistant', content: replyText });

      // Check for goodbye
      const lower = replyText.toLowerCase();
      const isGoodbye = lower.includes('goodbye') || lower.includes('have a great day') || lower.includes('thanks for calling');

      if (isGoodbye) {
        res.type('text/xml');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();
        twiml.say({ voice: KRISTY_VOICE }, replyText);
        twiml.hangup();
        return res.send(twiml.toString());
      }
    }

    // Save history in cookie for next turn
    const historyCookie = history.length > 0
      ? `kristy_history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}; Path=/; HttpOnly`
      : '';

    res.type('text/xml');
    if (historyCookie) res.setHeader('Set-Cookie', historyCookie);
    res.send(buildTwiML(replyText, turnCount));

  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: KRISTY_VOICE }, "I'm sorry, something went wrong. Please try calling back." );
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

    if (!Body) {
      return res.status(200).send('');
    }

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

export function registerTwilioVoiceRoutes(app, httpServer) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');

  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);

  console.log('[kristy-voice] ✅ Twilio voice routes registered:');
  console.log('[kristy-voice]    POST /api/twilio/voice (voice calls)');
  console.log('[kristy-voice]    POST /api/twilio/sms (SMS)');
}
