// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI (HTTP callback approach)
//
// Architecture:
//   Caller → Twilio → POST /api/twilio/voice (TwiML with <Gather>)
//   Caller speaks → Twilio STT → POST /api/twilio/voice (with SpeechResult)
//   → Kristy's GPT brain → <Say> response → loop
//
// No WebSocket needed — works on any hosting that handles HTTP POST.

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KRISTY_VOICE = 'Polly.Joanna'; // Amazon Polly voice, natural sounding

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
// LLM: Kristy's brain (GPT-4o-mini)
// ---------------------------------------------------------------------------

async function kristyThink(userText, conversationHistory) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-16),
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
// Is this a goodbye?
// ---------------------------------------------------------------------------

const GOODBYE_PATTERNS = /\b(bye|goodbye|good\s*bye|thanks?\s*(a\s*lot|so\s*much)?|see\s*ya|take\s*care|have\s*a\s*(good|great)\s*(day|one)|talk\s*(to\s*you\s*)?later|gotta\s*go|i'm\s*(done|set)|that's?\s*(all|it)|nothing\s*else|no\s*(more\s*)?questions?)\b/i;

function isGoodbye(text) {
  return GOODBYE_PATTERNS.test(text.trim());
}

// ---------------------------------------------------------------------------
// Build TwiML helpers
// ---------------------------------------------------------------------------

function buildTwiML(speechText, isEnd = false) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say({ voice: KRISTY_VOICE }, speechText);

  if (isEnd) {
    twiml.say({ voice: KRISTY_VOICE }, 'Thanks for calling HaulFlow. Have a great day!');
    twiml.hangup();
  } else {
    // Gather the next thing the caller says
    const gather = twiml.gather({
      input: 'speech',
      action: '/api/twilio/voice',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      maxSpeechTimeout: 15,
      profanityFilter: false,
    });
    gather.say({ voice: KRISTY_VOICE }, 'What else can I help you with?');
  }

  return twiml.toString();
}

function buildInitialTwiML() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: 'speech',
    action: '/api/twilio/voice',
    method: 'POST',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    maxSpeechTimeout: 15,
    profanityFilter: false,
    numDigits: 1, // Also allow keypad input (1 = pricing, 2 = features, etc.)
  });
  gather.say({ voice: KRISTY_VOICE }, "Hi, I'm Kristy with HaulFlow. I can tell you about our trucking management software, pricing, or anything else. How can I help you today?");

  return twiml.toString();
}

// ---------------------------------------------------------------------------
// HTTP webhook handler
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  const VoiceResponse = twilio.twiml.VoiceResponse;

  try {
    // If Twilio sends SpeechResult, process the caller's speech
    const speechResult = req.body?.SpeechResult || req.body?.speechResult;
    const digits = req.body?.Digits;

    if (speechResult) {
      const callSid = req.body?.CallSid || 'unknown';
      console.log(`[kristy-voice][${callSid}] Heard: "${speechResult}"`);

      // Restore conversation history from Twilio cookies or start fresh
      // (Twilio passes cookies back on each webhook)
      let history = [];
      try {
        const cookie = req.headers?.cookie || '';
        const match = cookie.match(/kristy_history=([^;]+)/);
        if (match) {
          history = JSON.parse(decodeURIComponent(match[1]));
        }
      } catch {}

      const reply = await kristyThink(speechResult, history);
      console.log(`[kristy-voice][${callSid}] Kristy: "${reply}"`);

      const shouldEnd = isGoodbye(speechResult) && (
        reply.toLowerCase().includes('goodbye') ||
        reply.toLowerCase().includes('take care') ||
        reply.toLowerCase().includes('great day') ||
        reply.toLowerCase().includes('thanks')
      );

      // Save history to cookie for next turn
      history.push(
        { role: 'user', content: speechResult },
        { role: 'assistant', content: reply }
      );

      const twiml = buildTwiML(reply, shouldEnd);

      res.setHeader('Set-Cookie', `kristy_history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}; Path=/; HttpOnly`);
      res.type('text/xml');
      return res.send(twiml);
    }

    // If caller pressed a digit
    if (digits) {
      const callSid = req.body?.CallSid || 'unknown';
      console.log(`[kristy-voice][${callSid}] Digit pressed: ${digits}`);

      let history = [];
      try {
        const cookie = req.headers?.cookie || '';
        const match = cookie.match(/kristy_history=([^;]+)/);
        if (match) {
          history = JSON.parse(decodeURIComponent(match[1]));
        }
      } catch {}

      let reply;
      switch (digits) {
        case '1':
          reply = "HaulFlow offers flexible plans for carriers of all sizes. Visit go4fc.com to see pricing and start a free trial. Would you like to know more about any specific features?";
          break;
        case '2':
          reply = "Our key features include load management, real-time GPS tracking, digital DVIR inspections, automated billing, driver dispatch, and compliance reporting. What would you like to know more about?";
          break;
        default:
          reply = await kristyThink(`The caller pressed number ${digits}`, history);
      }

      history.push(
        { role: 'user', content: `[pressed ${digits}]` },
        { role: 'assistant', content: reply }
      );

      const twiml = buildTwiML(reply);
      res.setHeader('Set-Cookie', `kristy_history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}; Path=/; HttpOnly`);
      res.type('text/xml');
      return res.send(twiml);
    }

    // No speech or digits — initial call or no input (retry)
    const twiml = buildInitialTwiML();
    res.type('text/xml');
    return res.send(twiml);
  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    const twiml = new VoiceResponse();
    twiml.say({ voice: KRISTY_VOICE }, "I'm sorry, something went wrong. Please try calling back.");
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }
}

// ---------------------------------------------------------------------------
// SMS webhook handler
// ---------------------------------------------------------------------------

async function handleSmsWebhook(req, res) {
  const from = req.body?.From || 'unknown';
  const body = req.body?.Body || '';
  console.log(`[kristy-sms] From: ${from}, Body: "${body}"`);

  if (!body.trim()) {
    return res.type('text/xml').send('<Response></Response>');
  }

  try {
    const reply = await kristyThink(body, []);
    console.log(`[kristy-sms] Reply: "${reply}"`);

    const VoiceResponse = twilio.twiml.MessagingResponse;
    const twiml = new VoiceResponse();
    twiml.message(reply);
    res.type('text/xml');
    return res.send(twiml.toString());
  } catch (err) {
    console.error('[kristy-sms] Error:', err);
    const VoiceResponse = twilio.twiml.MessagingResponse;
    const twiml = new VoiceResponse();
    twiml.message("Sorry, I'm having trouble right now. Please try again.");
    res.type('text/xml');
    return res.send(twiml.toString());
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
