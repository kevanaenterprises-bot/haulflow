// server/twilio-voice.js
// Conversational Kristy — Twilio Voice AI
//
// Uses <Record> + Whisper STT instead of Twilio's broken <Gather> speech recognition.
// Flow: <Say> → <Record> → caller speaks → recording URL → Whisper → GPT → <Say> → loop

import twilio from 'twilio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || '';
const VOICE = 'Polly.Joanna';
const MAX_TURNS = 15;

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
- If someone says goodbye or thanks, respond naturally and briefly`;

// ---------------------------------------------------------------------------
// GPT call
// ---------------------------------------------------------------------------

async function kristyThink(userText) {
  if (!OPENAI_KEY) {
    console.error('[kristy-voice] No OPENAI_API_KEY');
    return "I'm sorry, I'm having a technical issue right now. Please call back later.";
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
    return "I'm having trouble thinking right now. Could you try again?";
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "Let me think about that.";
}

// ---------------------------------------------------------------------------
// Whisper STT — download recording → transcribe
// ---------------------------------------------------------------------------

async function transcribeRecording(recordingUrl) {
  console.log('[kristy-voice] Downloading recording:', recordingUrl);

  // Download recording from Twilio
  const recResp = await fetch(recordingUrl);
  if (!recResp.ok) {
    console.error('[kristy-voice] Recording download failed:', recResp.status);
    return '';
  }

  const audioBuf = Buffer.from(await recResp.arrayBuffer());
  console.log(`[kristy-voice] Recording downloaded: ${audioBuf.length} bytes`);

  if (audioBuf.length < 1000) {
    console.log('[kristy-voice] Recording too small, skipping');
    return '';
  }

  // Send to Whisper
  const formData = new FormData();
  formData.append('file', new Blob([audioBuf], { type: 'audio/wav' }), 'recording.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: formData,
  });

  if (!whisperResp.ok) {
    const err = await whisperResp.text();
    console.error('[kristy-voice] Whisper error:', whisperResp.status, err.slice(0, 200));
    return '';
  }

  const text = (await whisperResp.text()).trim();
  console.log(`[kristy-voice] Whisper transcript: "${text}"`);
  return text;
}

// ---------------------------------------------------------------------------
// Goodbye detection
// ---------------------------------------------------------------------------

function isGoodbye(text) {
  const lower = text.toLowerCase();
  return /goodbye|bye\s?bye|hang\s?up|thanks\s?for\s?calling|have\s?a\s?great|talk\s?later|take\s?care/.test(lower);
}

// ---------------------------------------------------------------------------
// Helper: build TwiML with Say + Record
// ---------------------------------------------------------------------------

function buildTwiML(sayText, actionUrl, recordingParams = {}) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say({ voice: VOICE }, sayText);

  twiml.record({
    action: actionUrl,
    method: 'POST',
    maxLength: 30,
    timeout: 8,           // silence timeout before ending recording
    finishOnKey: '#',     // press # to submit early
    transcribe: false,    // we use Whisper, not Twilio's transcription
    playBeep: true,
    ...recordingParams,
  });

  // Fallback: if recording fails or times out with no speech
  twiml.redirect(actionUrl);

  return twiml.toString();
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

async function handleVoiceWebhook(req, res) {
  try {
    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const turnCount = parseInt(req.query.turn || '0', 10) + 1;
    const RecordingUrl = req.body.RecordingUrl || '';
    const RecordingDuration = req.body.RecordingDuration || '0';
    const CallSid = req.body.CallSid || 'unknown';

    console.log(`[kristy-voice] Turn:${turnCount} RecordingUrl:${RecordingUrl ? 'yes' : 'no'} Duration:${RecordingDuration}s`);

    // --- Max turns safety ---
    if (turnCount > MAX_TURNS) {
      const twiml = new (twilio.twiml.VoiceResponse)();
      twiml.say({ voice: VOICE }, "It's been great talking with you! Feel free to call HaulFlow anytime. Have a wonderful day!");
      twiml.hangup();
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // --- First call: greeting ---
    if (turnCount === 1) {
      const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}`;
      res.type('text/xml');
      return res.send(buildTwiML(
        "Hi, I'm Kristy with HaulFlow. How can I help you today?",
        actionUrl
      ));
    }

    // --- Subsequent turns: process recording ---
    let sayText;

    if (RecordingUrl && parseInt(RecordingDuration) > 1) {
      // We have a recording with actual audio — transcribe with Whisper
      const transcript = await transcribeRecording(RecordingUrl);

      if (transcript && transcript.length > 1) {
        // Kristy thinks
        const reply = await kristyThink(transcript);

        if (isGoodbye(reply)) {
          const twiml = new (twilio.twiml.VoiceResponse)();
          twiml.say({ voice: VOICE }, reply);
          twiml.hangup();
          res.type('text/xml');
          return res.send(twiml.toString());
        }

        sayText = reply;
      } else {
        sayText = "I didn't catch that. Could you try again?";
      }
    } else {
      // No recording or too short — retry prompt
      sayText = "I didn't hear anything that time. Go ahead and speak, or press the pound key when you're done.";
    }

    const actionUrl = `${baseUrl}/api/twilio/voice?turn=${turnCount}`;
    res.type('text/xml');
    res.send(buildTwiML(sayText, actionUrl));

  } catch (err) {
    console.error('[kristy-voice] Webhook error:', err);
    const twiml = new (twilio.twiml.VoiceResponse)();
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

    const reply = await kristyThink(Body);
    const twiml = new (twilio.twiml.MessagingResponse)();
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
  console.log('[kristy-voice] ✅ POST /api/twilio/voice (Record+Whisper) + POST /api/twilio/sms');
}
