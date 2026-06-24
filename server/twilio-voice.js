// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
//
// Bypasses Twilio's unreliable STT. Uses <Record> to capture caller audio,
// transcribes with our own Whisper API, then responds with GPT + <Say>.

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
- If someone says goodbye or thanks, respond naturally. Do NOT tell them to hang up.`;

// ---------------------------------------------------------------------------
// GPT
// ---------------------------------------------------------------------------

async function kristyThink(userText) {
  if (!OPENAI_KEY) {
    console.error('[kristy-voice] No OpenAI key');
    return "I'm having a technical issue right now. Please call back later.";
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    console.error('[kristy-voice] GPT error:', resp.status);
    return "I'm having trouble right now. Could you try again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

// ---------------------------------------------------------------------------
// Whisper STT (our own — bypasses Twilio STT)
// ---------------------------------------------------------------------------

async function transcribeRecording(recordingUrl) {
  if (!OPENAI_KEY) return '';

  console.log(`[kristy-voice] Transcribing: ${recordingUrl}`);

  try {
    // Download the recording
    const audioResp = await fetch(recordingUrl);
    if (!audioResp.ok) {
      console.error('[kristy-voice] Failed to download recording:', audioResp.status);
      return '';
    }
    const audioBuf = Buffer.from(await audioResp.arrayBuffer());

    // Send to Whisper
    const fd = new FormData();
    fd.append('file', new Blob([audioBuf], { type: 'audio/wav' }), 'recording.wav');
    fd.append('model', 'whisper-1');
    fd.append('language', 'en');
    fd.append('response_format', 'text');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: fd,
    });

    if (!whisperResp.ok) {
      console.error('[kristy-voice] Whisper error:', whisperResp.status);
      return '';
    }

    const text = (await whisperResp.text()).trim();
    console.log(`[kristy-voice] Whisper result: "${text}"`);
    return text;
  } catch (err) {
    console.error('[kristy-voice] Transcribe error:', err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Goodbye detection
// ---------------------------------------------------------------------------

function isGoodbye(text) {
  const lower = text.toLowerCase();
  return /goodbye|bye\s?bye|hang\s?up|thanks\s?for\s?calling|have\s?a\s?great\s?day|talk\s?to\s?you\s?later|take\s?care/.test(lower);
}

// ---------------------------------------------------------------------------
// Voice webhook
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const turn = parseInt(req.query.turn || '0', 10) + 1;
    const retry = parseInt(req.query.retry || '0', 10);

    // Log everything Twilio sends us
    console.log(`[kristy-voice] === Turn:${turn} Retry:${retry} ===`);
    console.log(`[kristy-voice] Body keys: ${Object.keys(req.body).join(', ')}`);
    const recordingUrl = req.body.RecordingUrl || '';
    const recordingDuration = req.body.RecordingDuration || '';
    console.log(`[kristy-voice] RecordingUrl: ${recordingUrl} Duration: ${recordingDuration}s`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Safety: max turns
    if (turn > MAX_TURNS) {
      twiml.say({ voice: VOICE }, "It's been great talking with you! Call us anytime. Have a wonderful day!");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    let sayText;

    if (turn === 1 && !recordingUrl) {
      // FIRST call — greeting
      sayText = "Hi, I'm Kristy with HaulFlow. How can I help you today?";
    } else if (recordingUrl) {
      // We have a recording — transcribe with Whisper
      const transcript = await transcribeRecording(recordingUrl);

      if (!transcript || transcript.length < 2) {
        if (retry >= 2) {
          twiml.say({ voice: VOICE }, "I'm having trouble hearing you. Feel free to call back anytime. Thanks for calling HaulFlow!");
          twiml.hangup();
          res.type('text/xml');
          return res.send(twiml.toString());
        }
        sayText = "I didn't quite catch that. Could you say that again?";
      } else {
        // Kristy thinks
        const reply = await kristyThink(transcript);
        console.log(`[kristy-voice] Kristy reply: "${reply}"`);

        if (isGoodbye(reply)) {
          twiml.say({ voice: VOICE }, reply);
          twiml.hangup();
          res.type('text/xml');
          return res.send(twiml.toString());
        }

        sayText = reply;
      }
    } else {
      // No recording received (timeout/hangup)
      twiml.say({ voice: VOICE }, "Thanks for calling HaulFlow! Have a great day.");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Say the response, then record next caller input
    twiml.say({ voice: VOICE }, sayText);

    // Record caller's response (max 15 seconds, trim silence)
    const recordAction = `${baseUrl}/api/twilio/voice?turn=${turn}&retry=${retry}`;
    twiml.record({
      action: recordAction,
      method: 'POST',
      maxLength: 15,
      finishOnKey: '#',
      trim: 'do-not-trim', // Keep all audio for Whisper
      transcribe: false,   // We use our own Whisper, not Twilio's
      playBeep: true,       // Beep so caller knows we're listening
    });

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
// SMS webhook
// ---------------------------------------------------------------------------

async function handleSmsWebhook(req, res) {
  try {
    const Body = (req.body.Body || '').trim();
    const From = req.body.From || 'unknown';
    console.log(`[kristy-voice] SMS from ${From}: "${Body}"`);
    if (!Body) return res.status(200).send('');

    const reply = await kristyThink(Body);
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
  console.log('[kristy-voice] Registering Twilio Conversational Voice routes (Record + Whisper)...');
  app.post('/api/twilio/voice', handleVoiceWebhook);
  app.post('/api/twilio/sms', handleSmsWebhook);
  console.log('[kristy-voice] ✅ POST /api/twilio/voice + POST /api/twilio/sms');
}
