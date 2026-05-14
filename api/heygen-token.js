// Vercel Serverless Function — /api/heygen-token
// Proxies HeyGen access token creation to keep API key server-side

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    console.error('[heygen-token] HEYGEN_API_KEY env var not set');
    return res.status(500).json({ error: 'HeyGen API key not configured' });
  }

  try {
    const resp = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[heygen-token] HeyGen error:', resp.status, text);
      return res.status(resp.status).json({ error: 'Failed to create token' });
    }

    const data = await resp.json();
    return res.status(200).json({ token: data.data?.token || data.token });
  } catch (err) {
    console.error('[heygen-token] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
