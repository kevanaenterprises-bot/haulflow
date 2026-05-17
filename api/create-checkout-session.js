// Vercel Serverless Function — /api/create-checkout-session
// Creates a Stripe Checkout session for HaulFlow Founding Carrier Activation ($350 one-time)

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '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';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'mode': 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': 'HaulFlow TMS - Founding Carrier Activation',
        'line_items[0][price_data][unit_amount]': '35000',
        'line_items[0][quantity]': '1',
        'success_url': 'https://haulflow.turtlelogisticsllc.com/setup',
        'cancel_url': 'https://haulflow.turtlelogisticsllc.com/subscribe',
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[create-checkout-session] Stripe error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'Stripe error' });
    }

    const session = await response.json();
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[create-checkout-session] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
