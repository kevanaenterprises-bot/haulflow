// Vercel Serverless Function — /api/anam-token
// Generates an Anam session token with Signature Rotation (10-outfit cycle).
// Rotation logic: count days since May 16, 2026, use (days % 10) to pick persona.

const ANAM_API_KEY = 'YTM1MjkyYTgtYzFhMC00NWJjLTg0MjQtNWNkZWZhZGM3NGRmOlpTZEVXQkhsbS85UzZ3TUJxME05MG4yK0NQckNZdEJ2bEdoSTUwbUlSZlU9';

// 10-persona rotation — one outfit per slot (index 0–9)
const PERSONA_IDS = [
  '7f797d62-912b-4976-bbcc-ad8c3cc64ff4', // slot 0
  'bbd37e01-2215-4cca-8724-5eb0fdd5d0ad', // slot 1
  'ad0a04fc-1829-4938-bbc0-8ac0141a84a4', // slot 2
  'd720e664-aadb-466b-a9ab-7fc2ee87f7cf', // slot 3
  'f17e4416-e413-4814-96f3-308b806676d4', // slot 4
  'f3c3f5ec-1e41-481f-a739-fa678245a895', // slot 5
  '241c92e3-0537-4df7-8d44-cc7a259dd12d', // slot 6
  'a07b3c18-b4f2-49c0-b5f4-49bd8263e107', // slot 7
  '4f92b2df-743b-4473-bb1c-c3be9778da90', // slot 8
  'b9b066d5-de2a-4c33-b40e-cc834e75d249', // slot 9
];

// Start date for the rotation cycle
const ROTATION_START = new Date('2026-05-16T00:00:00.000Z');

function getPersonaId() {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysCount = Math.floor((now - ROTATION_START) / msPerDay);
  const index = ((daysCount % 10) + 10) % 10; // guard against negative modulo
  return PERSONA_IDS[index];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const personaId = getPersonaId();

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ personaId }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = 'Failed to create Anam session token';

      if (contentType && contentType.includes('application/json')) {
        try {
          const errData = await response.json();
          errorMessage = errData.message || errData.error || errorMessage;
        } catch { /* ignore parse error */ }
      } else {
        const text = await response.text();
        errorMessage = text || errorMessage;
      }

      console.error('[anam-token] Error:', response.status, errorMessage);
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = await response.json();

    // Anam returns: { sessionToken: "..." }
    const sessionToken = data.sessionToken || data.session_token;
    if (!sessionToken) {
      console.error('[anam-token] Unexpected response shape:', data);
      return res.status(500).json({ error: 'Unexpected API response' });
    }

    return res.status(200).json({ sessionToken, personaId });
  } catch (err) {
    console.error('[anam-token] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
