// Vercel Serverless Function — /api/avatar-chat
// Enriches visitor messages for the HeyGen streaming avatar.
// Detects news-related intent and wraps responses with HaulFlow persona context.

const NEWS_KEYWORDS = [
  'news', 'headline', 'headlines', 'today', 'latest', 'current events',
  'what happened', "what's happening", 'update', 'updates', 'trending',
  'breaking', 'report', 'reports',
];

function isNewsIntent(message) {
  const lower = message.toLowerCase();
  return NEWS_KEYWORDS.some((kw) => lower.includes(kw));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing message field' });
  }

  const news = isNewsIntent(message);

  let speechText;
  if (news) {
    speechText =
      `You asked about the news! While I'm primarily here to help you with HaulFlow — our all-in-one trucking management platform — ` +
      `I'm happy to chat about current events too. Unfortunately I don't have a live news feed connected right now, ` +
      `but I can tell you that the freight industry is always moving! Want to learn how HaulFlow keeps your loads, drivers, and invoices organized instead?`;
  } else {
    speechText =
      `Great question! As Kristy from HaulFlow, here's what I can tell you: ` +
      `HaulFlow is a flat-rate TMS platform at $350/month with unlimited users. ` +
      `We handle load management, GPS tracking, invoicing, SMS dispatch, driver portals, and IFTA reporting. ` +
      `Regarding your question: "${message}" — I'd love to walk you through how HaulFlow can help. ` +
      `Would you like to request a personalized demo?`;
  }

  return res.status(200).json({
    speech_text: speechText,
    is_news: news,
  });
}
