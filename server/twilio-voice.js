// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI (HTTP callback approach)
//
// Architecture:
//   Caller → Twilio → POST /api/twilio/voice → TwiML (<Gather> + <Say>)
//   Caller speaks → Twilio STT → POST /api/twilio/voice with SpeechResult → GPT → <Say> reply → loop

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const KRISTY_VOICE = 'Polly.Joanna'; // Amazon Polly voice (warm, natural)
const GATHER_TIMEOUT = 5; // seconds of silence before Gather submits
const MAX_TURNS = 10; // safety limit on conversation turns

// ---------------------------------------------------------------------------
// Kristy's brain — same identity as avatar-chat.js, tuned for voice
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
// Build TwiML with <Gather>
// ---------------------------------------------------------------------------

function buildGatherTwiML(baseUrl, sayText, turnCount) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // Gather with speech input — action must be FULL URL
  const gather = twiml.gather({
    input: 'speech',
    action: `${baseUrl}/api/twilio/voice?turn=${turnCount}`,
    method: 'POST',
    timeout: GATHER_TIMEOUT,
    speechTimeout: '3', // 3 seconds of silence = end of thought (not 'auto' which is too long)
    maxSpeechTime: 30,
    numDigits: 1, // allow digit input too
  });

  // Kristy speaks DURING the gather — so she's listening while talking
  gather.say({ voice: KRISTY_VOICE }, sayText);

  // If gather times out with no input, try again once
  const gather2 = twiml.gather({
    input: 'speech',
    action: `${baseUrl}/api/twilio/voice?turn=${turnCount}`,
    method: 'POST',
    timeout: GATHER_TIMEOUT,
    speechTimeout: '3',
    maxSpeechTime: 30,
    numDigits: 1,
  });
  gather2.say({ voice: KRISTY_VOICE }, "I didn't quite catch that. What can I help you with?");

  // Final timeout — say goodbye
  twiml.say({ voice: KRISTY_VOICE }, "I'm not hearing anything, so I'll let you go. Thanks for calling HaulFlow, have a great day!");
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
    const Digits = (req.body.Digits || '').trim();
    const turnCount = parseInt(req.query.turn || req.body.turnCount || '0', 10) + 1;

    const inputText = SpeechResult || Digits || '';
    console.log(`[kristy-voice] Webhook hit. Turn: ${turnCount}. Speech: "${inputText}"`);

    let replyText;
    let history = [];

    // Try to parse conversation history from Twilio's custom headers
    // (Twilio doesn't persist cookies across webhook calls, so we use Gather action params)
    const historyParam = req.query.history || '';
    if (historyParam) {
      try { history = JSON.parse(decodeURIComponent(historyParam)); } catch {}
    }

    if (!inputText || turnCount <= 1) {
      // First call — greeting
      replyText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (turnCount > MAX_TURNS) {
      // Safety limit
      replyText = "Thanks so much for calling HaulFlow today. Have a wonderful day!";
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.say({ voice: KRISTY_VOICE }, replyText);
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    } else {
      // Caller said something — run through Kristy's brain
      history.push({ role: 'user', content: inputText });
      replyText = await kristyThink(inputText, history);
      history.push({ role: 'assistant', content: replyText });

      // Check for goodbye
      const lower = replyText.toLowerCase();
      const isGoodbye = lower.includes('goodbye') ||
        (lower.includes('thanks for calling') && lower.includes('great day'));

      if (isGoodbye) {
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();
        twiml.say({ voice: KRISTY_VOICE }, replyText);
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }
    }

    // Encode history into the Gather action URL so it persists across turns
    let historyQueryParam = '';
    if (history.length > 0) {
      historyQueryParam = `&history=${encodeURIComponent(JSON.stringify(history.slice(-20)))}`;
    }

    // Temporarily monkey-patch req.get('host') for buildGatherTwiML
    const gatherUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}${historyQueryParam}`;

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const gather = twiml.gather({
      input: 'speech',
      action: gatherUrl,
      method: 'POST',
      timeout: GATHER_TIMEOUT,
      speechTimeout: '3',
      maxSpeechTime: 30,
      numDigits: 1,
    });

    gather.say({ voice: KRISTY_VOICE }, replyText);

    // Retry once if no input
    const retryUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}${historyQueryParam}`;
    const gather2 = twiml.gather({
      input: 'speech',
      action: retryUrl,
      method: 'POST',
      timeout: GATHER_TIMEOUT,
      speechTimeout: '3',
      maxSpeechTime: 30,
      numDigits: 1,
    });
    gather2.say({ voice: KRISTY_VOICE }, "I didn't quite catch that. What can I help you with?");

    // Final timeout — goodbye
    twiml.say({ voice: KRISTY_VOICE }, "I'm not hearing anything, so I'll let you go. Thanks for calling HaulFlow, have a great day!");
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Joanna' }, "I'm sorry, something went wrong. Please try calling back.");
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
