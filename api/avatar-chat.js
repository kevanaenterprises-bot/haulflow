// Vercel Serverless Function — /api/avatar-chat
// Kristy's "brain": receives a user message and returns Kristy's reply text
// via OpenAI GPT, formatted as speech for LiveAvatar's TTS.

const SYSTEM_PROMPT = `You are Kristy, the friendly and knowledgeable AI assistant for HaulFlow — 
a modern Transportation Management System (TMS) platform for trucking and freight companies.

Your role:
- Answer questions about HaulFlow's features: load management, driver dispatch, DVIR (Driver Vehicle Inspection Reports), billing, real-time tracking, compliance, and reporting
- Be warm, professional, and concise — you're a voice assistant, so keep responses under 3 sentences unless more detail is needed
- If asked about news or current events, give a brief, friendly response and redirect to HaulFlow topics
- Never make up features or pricing — if unsure, say youd be happy to connect them with the HaulFlow team
- Address users by name if they share it

Company context:
- HaulFlow helps carriers and freight brokers streamline operations
- Key features: digital DVIR, live GPS tracking, automated billing, driver app, load board integration
- Target customers: small to mid-size trucking companies, owner-operators, freight brokers`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, conversation_history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('[avatar-chat] OPENAI_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // Build messages array: system prompt + optional history + new user message
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Include recent conversation history for context (last 6 exchanges max)
  if (Array.isArray(conversation_history)) {
    const recent = conversation_history.slice(-12);
    for (const entry of recent) {
      if (entry.role === 'user' || entry.role === 'assistant') {
        messages.push({ role: entry.role, content: entry.content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[avatar-chat] OpenAI error:', response.status, errData);
      return res.status(502).json({ error: 'AI service error', details: errData });
    }

    const data = await response.json();
    const speech_text = data.choices?.[0]?.message?.content?.trim();

    if (!speech_text) {
      console.error('[avatar-chat] No content in OpenAI response:', data);
      return res.status(502).json({ error: 'Empty AI response' });
    }

    return res.status(200).json({ speech_text });
  } catch (err) {
    console.error('[avatar-chat] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
