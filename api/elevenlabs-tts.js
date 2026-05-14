// Vercel Serverless Function — /api/elevenlabs-tts
// Proxies text-to-speech requests to ElevenLabs, keeping the API key server-side.
// Accepts: { text: string, voice: "male" | "female" }
// Returns: audio/mpeg stream

const VOICE_IDS = {
  male: 'iP95p4xoKVk53GoZ742B',
  female: 'lxYfHSkYm1EzQzGhdbfc',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[elevenlabs-tts] ELEVENLABS_API_KEY env var not set');
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  const { text, voice = 'female' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text field' });
  }

  const voiceId = VOICE_IDS[voice] || VOICE_IDS.female;

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[elevenlabs-tts] ElevenLabs error:', resp.status, errText);
      return res.status(resp.status).json({ error: 'TTS generation failed' });
    }

    // Stream audio back
    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await resp.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[elevenlabs-tts] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
