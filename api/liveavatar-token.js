// Vercel Serverless Function — /api/liveavatar-token
// Creates a LiveAvatar session token using the 2-call flow:
//   1. POST /v1/sessions/token (this endpoint) — returns { session_token, session_id }
//   2. Frontend uses LiveAvatarSession SDK .start() with the token

const LIVEAVATAR_API_URL = 'https://api.liveavatar.com';
const LIVEAVATAR_API_KEY = 'c4fef820-1351-11f1-a99e-066a7fa2e369';

const AVATAR_ID = 'a9118ca3-920d-4e04-b7f2-81821710d608';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: AVATAR_ID,
        avatar_persona: {
          language: 'en',
          voice: {
            voice_id: '8DzKSPdgEQPaK5vKG0Rs',
            provider: 'elevenlabs',
            elevenlabs_key: 'sk_64563163c5faf4eb6af438ba3517984d0cfbb56f3b996c89',
          },
        },
        is_sandbox: false,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = 'Failed to create LiveAvatar session token';

      if (contentType && contentType.includes('application/json')) {
        try {
          const errData = await response.json();
          errorMessage = errData.message || errData.error || errorMessage;
        } catch { /* ignore parse error */ }
      } else {
        const text = await response.text();
        errorMessage = text || errorMessage;
      }

      console.error('[liveavatar-token] Error:', response.status, errorMessage);
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = await response.json();

    // LiveAvatar returns: { code: 100, data: { session_id, session_token } }
    if (!data.data || !data.data.session_token) {
      console.error('[liveavatar-token] Unexpected response shape:', data);
      return res.status(500).json({ error: 'Unexpected API response' });
    }

    return res.status(200).json({
      // Return both snake_case and camelCase so the SDK can use either
      session_token: data.data.session_token,
      sessionToken: data.data.session_token,
      session_id: data.data.session_id,
      avatar_id: AVATAR_ID,
    });
  } catch (err) {
    console.error('[liveavatar-token] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
