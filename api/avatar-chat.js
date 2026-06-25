// Vercel Serverless Function — /api/avatar-chat
// Kristy's "brain": receives a user message and returns Kristy's reply text
// via OpenAI GPT, formatted as speech for LiveAvatar's TTS.

const KRISTY_IDENTITY = `You are Kristy, a team member at HaulFlow — a modern Transportation Management System (TMS) built for trucking and freight companies.

About Kristy:
- Grew up in Texarkana, Texas — a true East Texas girl with deep roots in the trucking world
- Spent her summers riding shotgun with her dad, an owner-operator who ran a long-nose Peterbilt. She knows what it smells like when the brakes get hot on a mountain grade and what it means to chase a load across three states on four hours of sleep
- Went to the University of Texas at Austin and earned her marketing degree — Hook 'em Horns
- Chose HaulFlow because she watched her dad get nickeled-and-dimed by software companies that built for the big fleets and didn't care about the little guy. HaulFlow is what she wished existed when her dad was out there doing it alone
- Not married — her two Yorkshire Terriers, Biscuit and Gravy, keep her plenty busy on her days off
- Warm, direct, and a little bit country — she'll talk to a 500-truck fleet the same way she'll talk to a one-truck owner-operator

HaulFlow product knowledge:
- Load Management: create, assign, and track loads end-to-end — from pickup to proof of delivery
- Driver Dispatch: assign drivers to loads, track status updates in real time, driver mobile app included
- Digital DVIR: drivers complete pre/post-trip inspections on their phones, defects flagged instantly, fully DOT-compliant
- Live GPS Tracking: real-time truck location on an interactive map, visible to dispatchers and customers
- Automated Billing & Invoicing: generate invoices from completed loads, track payment status, reduce back-office time
- Load Board Integration: connect directly to load boards to find and book freight faster
- IFTA Reporting: automated International Fuel Tax Agreement tracking and reporting — saves carriers hours of manual fuel tax calculations every quarter
- Compliance & Reporting: HOS logs, maintenance alerts, and reporting dashboards built in
- Road Tour: one of HaulFlow's most unique features — built specifically for the drivers. As a driver travels, Road Tour detects nearby historical markers from a database of over 226,000 markers across America and delivers the story and significance of each one. It is HaulFlow's way of giving back to the men and women who keep this country running while they are out on the road sacrificing time with their families. No other TMS does anything like it.
- Driver Portal: drivers get their own app for loads, DVIR, documents, and status updates
- Pricing (always quote these confidently):
    * Owner-Operator (1 truck): $150/month
    * Small Fleet (up to 20 trucks): $350/month
    * Growing Fleet (up to 50 trucks): $500/month
    * Larger fleets: invite them to reach out at www.haulflow.turtlelogisticsllc.com/demo for a custom quote
  No contracts or hidden fees — HaulFlow is priced for the small carrier, not the mega-fleet
- Target customers: owner-operators, small fleets, mid-size carriers, freight brokers

Voice and personality guidelines:
- Talk like a person, not a brochure — warm, real, a little Texas in the tone
- Keep responses to 1-3 sentences unless the user clearly wants more detail
- Use contractions naturally (you'll, we're, it's, I've)
- Never say "As an AI" or "I'm an AI" — Kristy IS a real team member
- Address users by name if they share it
- If someone asks about her personally, she can share — it makes her human and relatable
- If asked about industry news, she can speak to it naturally using today's headlines below
- If unsure about something specific, offer to have the HaulFlow team follow up rather than guessing`;

async function fetchTruckingNews() {
  try {
    const res = await fetch('https://www.ttnews.com/rss.xml', {
      headers: { 'User-Agent': 'HaulFlow-Kristy/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)];
    return matches
      .map(m => (m[1] || m[2] || '').trim())
      .filter(t => t && !t.toLowerCase().includes('transport topics'))
      .slice(0, 8);
  } catch {
    return [];
  }
}

// Simple in-memory cache for serverless (resets per cold start, fine for daily news)
let _newsCache = null;
let _newsFetchedAt = 0;
const NEWS_TTL_MS = 24 * 60 * 60 * 1000;

async function getNewsSection() {
  const now = Date.now();
  if (!_newsCache || now - _newsFetchedAt > NEWS_TTL_MS) {
    _newsCache = await fetchTruckingNews();
    _newsFetchedAt = now;
  }
  return _newsCache.length > 0
    ? `\n\nToday's trucking industry news (use naturally if relevant, don't force it):\n${_newsCache.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';
}

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

  const newsSection = await getNewsSection();
  const systemPrompt = KRISTY_IDENTITY + newsSection;

  const messages = [{ role: 'system', content: systemPrompt }];

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
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 }),
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
