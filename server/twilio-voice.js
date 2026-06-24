// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
// Pattern from Twilio support: <Gather><Say/></Gather> — Say INSIDE Gather

import twilio from 'twilio';

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 15;

const SYSTEM_PROMPT = `You are Kristy, the friendly and knowledgeable team member for HaulFlow — a modern Transportation Management System (TMS) for trucking and freight companies.

Your role:
- Answer questions about HaulFlow's features: load management, driver dispatch, DVIR, billing, real-time GPS tracking, compliance, and reporting
- Be warm, professional, and concise — keep voice responses to 1-3 sentences
- If asked about pricing, mention that HaulFlow offers flexible plans and they can visit go4fc.com to get started or request a custom quote
- If asked about news or off-topic things, briefly acknowledge and gently redirect to HaulFlow
- Never make up features — if unsure, offer to connect them with the HaulFlow team
- Address callers by name if they share it
- Company: HaulFlow helps carriers and freight brokers streamline operations
- Website: go4fc.com
- Never say "As an AI" — you ARE Kristy, a real team member
- If someone says goodbye or thanks, respond naturally`;

async function kristyThink(userText, history) {
  if (!OPENAI_KEY) return "I'm having a technical issue right now. Please call back later.";

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
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 150, temperature: 0.7 }),
  });

  if (!resp.ok) {
    console.error('[kristy-voice] GPT error:', resp.status);
    return "I'm having trouble right now. Could you try again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

function isGoodbye(text) {
  return /goodbye|bye\s?bye|hang\s?up|thanks\s?for\s?calling|have\s?a\s?great\s?day|talk\s?to\s?you\s?later|take\s?care/.test(text.toLowerCase());
}

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const SpeechResult = (req.body.SpeechResult || '').trim();
    const Digits = (req.body.Digits || '').trim();
    const turn = parseInt(req.query.turn || '0', 10) + 1;
    const retry = parseInt(req.query.retry || '0', 10);

    console.log(`[kristy-voice] Turn:${turn} Retry:${retry} Speech:"${SpeechResult}" Digits:"${Digits}"`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    if (turn > MAX_TURNS) {
      twiml.say({ voice: VOICE }, "It's been great talking with you! Call us anytime. Have a wonderful day!");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    let sayText;

    if (!SpeechResult && !Digits && turn <= 1) {
      // First call — greeting
      sayText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (!SpeechResult && !Digits) {
      // No speech detected
      if (retry >= 3) {
        twiml.say({ voice: VOICE }, "I'm having trouble hearing you. Feel free to call back anytime. Thanks for calling HaulFlow!");
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }
      sayText = "I didn't quite catch that. Could you repeat what you said?";
    } else {
      // Caller spoke — Kristy thinks
      const userInput = SpeechResult || `they pressed ${Digits}`;
      const reply = await kristyThink(userInput, []);

      if (isGoodbye(reply)) {
        twiml.say({ voice: VOICE }, reply);
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
      }

      sayText = reply;
    }

    // KEY FIX: <Say> nested INSIDE <Gather> — this is how Twilio STT works
    // The speech recognizer activates with Gather, ignores the Say output, then captures caller
    const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turn}&retry=${retry}`;
    const gather = twiml.gather({
      input: 'speech dtmf',
      action: actionUrl,
      method: 'POST',
      timeout: '10',
      speechTimeout: 'auto',
      maxSpeechTime: '30',
    });
    gather.say({ voice: VOICE }, sayText);

    // If gather times out with no input — retry
    twiml.say({ voice: VOICE }, "I'm not picking anything up, so I'll let you go. Feel free to call back anytime.");
    twiml.hangup();

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

export function registerTwilioVoiceRoutes(app) {
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes...');
  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);
  console.log('[kristy-voice] ✅ POST /api/twilio/voice + POST /api/twilio/sms');
}
