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

const KRISTY_VOICE = 'alice';

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
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!openaiKey) {
    console.error('[kristy-voice] OPENAI_API_KEY not set');
    return "I'm excited to tell you more about HaulFlow! Visit go4fc dot com to learn about our trucking management software, or call back later when our team is available.";
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-16),
    { role: 'user', content: userText },
  ];

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 150,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[kristy-voice] GPT error:', resp.status, JSON.stringify(err).slice(0, 200));
      return null;
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[kristy-voice] GPT fetch error:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Goodbye detection
// ---------------------------------------------------------------------------

const GOODBYE_PATTERNS = /\b(bye|goodbye|good\s*bye|see\s*ya|take\s*care|talk\s*(to\s*you\s*)?later|gotta\s*go|i'm\s*(done|set)|that's?\s*(all|it)|nothing\s*else|no\s*(more\s*)?questions?)\b/i;

function isGoodbye(text) {
  return GOODBYE_PATTERNS.test(text.trim());
}

// ---------------------------------------------------------------------------
// TwiML builders
// ---------------------------------------------------------------------------

const GATHER_OPTS = {
  input: 'speech dtmf',
  action: '/api/twilio/voice',
  method: 'POST',
  speechTimeout: '3',           // Wait up to 3s of silence to detect end of speech
  speechModel: 'phone_call',
  enhanced: true,
  numResults: 1,
  profanityFilter: false,
  timeout: 10,                  // 10s of total silence before redirecting back
};

function buildResponseTwiML(speechText, isEnd = false) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (isEnd) {
    twiml.say({ voice: KRISTY_VOICE }, 'Thanks for calling HaulFlow. Have a great day!');
    twiml.hangup();
  } else {
    // <Say> first, then <Gather> — more reliable for speech detection
    twiml.say({ voice: KRISTY_VOICE }, speechText);
    twiml.pause({ length: 1 });
    const gather = twiml.gather(GATHER_OPTS);
    gather.say({ voice: KRISTY_VOICE }, 'What else can I help you with?');
    // Timeout redirect — keeps conversation alive
    gather.redirect('/api/twilio/voice');
  }

  return twiml.toString();
}

function buildInitialTwiML() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // Intro outside of gather so it plays cleanly
  twiml.say({ voice: KRISTY_VOICE }, "Hi! I'm Kristy with HaulFlow.");
  twiml.pause({ length: 1 });
  twiml.say({ voice: KRISTY_VOICE }, "I can tell you about our trucking management software, pricing, or anything else you'd like to know.");
  twiml.pause({ length: 1 });

  // Now gather for their response
  const gather = twiml.gather(GATHER_OPTS);
  gather.say({ voice: KRISTY_VOICE }, "How can I help you today?");
  gather.redirect('/api/twilio/voice');

  return twiml.toString();
}

// ---------------------------------------------------------------------------
// HTTP webhook handler
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const speechResult = req.body?.SpeechResult || req.body?.speechResult;
    const digits = req.body?.Digits;
    const callSid = req.body?.CallSid || 'unknown';

    console.log(`[kristy-voice][${callSid}] Webhook hit. Speech: "${speechResult || ''}" Digits: "${digits || ''}"`);

    // Caller spoke something
    if (speechResult) {
      console.log(`[kristy-voice][${callSid}] Heard: "${speechResult}"`);

      let history = [];
      try {
        const cookie = req.headers?.cookie || '';
        const match = cookie.match(/kristy_history=([^;]+)/);
        if (match) history = JSON.parse(decodeURIComponent(match[1]));
      } catch {}

      const reply = await kristyThink(speechResult, history);

      let responseText;
      let shouldEnd = false;

      if (reply) {
        responseText = reply;
        shouldEnd = isGoodbye(speechResult);
        if (shouldEnd) {
          // Let GPT say goodbye naturally, then end
          const finalGreeting = await kristyThink(`The caller said "${speechResult}". Say a warm goodbye as Kristy from HaulFlow. Keep it to one sentence.`, history);
          responseText = finalGreeting || "Thanks for calling HaulFlow. Have a great day!";
        }
        console.log(`[kristy-voice][${callSid}] Kristy: "${responseText}"`);
      } else {
        responseText = "I'm sorry, I had a little trouble with that. Could you try again?";
        console.log(`[kristy-voice][${callSid}] GPT failed, using fallback`);
      }

      history.push(
        { role: 'user', content: speechResult },
        { role: 'assistant', content: responseText }
      );

      const twiml = buildResponseTwiML(responseText, shouldEnd);
      res.setHeader('Set-Cookie', `kristy_history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}; Path=/; HttpOnly`);
      res.type('text/xml');
      return res.send(twiml);
    }

    // Caller pressed a digit
    if (digits) {
      console.log(`[kristy-voice][${callSid}] Digit: ${digits}`);
      let reply;
      switch (digits) {
        case '1':
          reply = "HaulFlow offers flexible plans for carriers of all sizes. Visit go4fc.com to see pricing and start a free trial.";
          break;
        case '2':
          reply = "Our key features include load management, real-time GPS tracking, digital DVIR inspections, automated billing, and driver dispatch.";
          break;
        default:
          reply = "I'm not sure what that option means. You can ask me anything about HaulFlow in your own words.";
      }
      const twiml = buildResponseTwiML(reply);
      res.type('text/xml');
      return res.send(twiml);
    }

    // No speech or digits — initial call or timeout redirect
    const twiml = buildInitialTwiML();
    res.type('text/xml');
    return res.send(twiml);
  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    // Don't hang up — keep conversation alive
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: KRISTY_VOICE }, "Sorry about that. Let me try again.");
    const gather = twiml.gather(GATHER_OPTS);
    gather.say({ voice: KRISTY_VOICE }, "What can I help you with?");
    gather.redirect('/api/twilio/voice');
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

    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message(reply || "Thanks for texting HaulFlow! Someone will get back to you soon.");
    res.type('text/xml');
    return res.send(twiml.toString());
  } catch (err) {
    console.error('[kristy-sms] Error:', err);
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message("Thanks for texting HaulFlow! Someone will get back to you soon.");
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
