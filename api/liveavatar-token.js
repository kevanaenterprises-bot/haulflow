// Vercel Serverless Function — /api/liveavatar-token
// Creates a LiveAvatar session token using the 2-call flow:
//   1. POST /v1/sessions/token (this endpoint) — returns { session_token, session_id }
//   2. Frontend uses LiveAvatarSession SDK .start() with the token
//
// Implements "Outfit of the Day" by rotating avatar_id based on the day of the week.

const LIVEAVATAR_API_URL = 'https://api.liveavatar.com';
const LIVEAVATAR_API_KEY = 'c4fef820-1351-11f1-a99e-066a7fa2e369';

// ─── Outfit of the Day: LiveAvatar avatar_id rotation ─────────────────────────
// Each avatar_id corresponds to Kristy in a different outfit on LiveAvatar.
// The user confirmed assets are already copied to LiveAvatar.
// Keys: 0 = Sunday, 1 = Monday, … 6 = Saturday
// NOTE: Replace these placeholder UUIDs with the actual LiveAvatar avatar_ids
// once they are retrieved from the LiveAvatar dashboard or List User Avatars API.
const OUTFIT_ROTATION = {
  0: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Sunday  — default Kristy
  1: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Monday
  2: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Tuesday
  3: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Wednesday
  4: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Thursday
  5: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Friday
  6: 'a9118ca3-920d-4e04-b7f2-81821710d608', // Saturday
};

function getAvatarIdForToday() {
  // Use Central Time (America/Chicago) for the day-of-week calculation
  const now = new Date();
  const centralDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  const day = centralDate.getDay(); // 0=Sun … 6=Sat
  return OUTFIT_ROTATION[day] || OUTFIT_ROTATION[1];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const avatarId = getAvatarIdForToday();

  try {
    const response = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'X-API-KEY': LIVEAVATAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'FULL',
        avatar_id: avatarId,
        avatar_persona: {
          language: 'en',
          voice: {
            voice_id: '8DzKSPdgEQPaK5vKG0Rs',
            provider: 'elevenlabs',
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
      session_token: data.data.session_token,
      session_id: data.data.session_id,
      avatar_id: avatarId,
    });
  } catch (err) {
    console.error('[liveavatar-token] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
