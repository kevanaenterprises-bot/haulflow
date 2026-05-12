import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // CORS headers for Vite dev server
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, company, phone, fleetSize, notes } = req.body || {};

  // Always 200 — prospects always get into the demo regardless of email status
  try {
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;

    if (mailUser && mailPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || "smtp.gmail.com",
        port: Number(process.env.MAIL_PORT) || 465,
        secure: true,
        auth: { user: mailUser, pass: mailPass },
      });

      const recipient =
        process.env.MAIL_TO || "kevanaenterprises@gmail.com";

      await transporter.sendMail({
        from: `"HaulFlow Demo" <${mailUser}>`,
        to: recipient,
        subject: `🚛 New HaulFlow Demo Request — ${company || name}`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;color:#1a1a1a;padding:24px;">
            <div style="background:#1e40af;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
              <h2 style="margin:0;font-size:18px;">🚛 New HaulFlow Demo Request</h2>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 10px 10px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#6b7280;width:130px;font-size:14px;">Name</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${name || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}" style="color:#1e40af;">${email || "—"}</a></td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Company</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${company || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Phone</td><td style="padding:8px 0;font-size:14px;">${phone || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Fleet Size</td><td style="padding:8px 0;font-size:14px;">${fleetSize || "—"}</td></tr>
                ${notes ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;vertical-align:top;">Notes</td><td style="padding:8px 0;font-size:14px;">${notes}</td></tr>` : ""}
              </table>
              <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;"/>
              <p style="color:#9ca3af;font-size:12px;margin:0;">Submitted via haulflow.turtlelogisticsllc.com</p>
            </div>
          </div>
        `,
      });
    } else {
      // Log the signup when email is not yet configured
      console.log("[HaulFlow Demo Request]", {
        name, email, company, phone, fleetSize, notes,
        timestamp: new Date().toISOString(),
      });
      console.warn("Email not sent: MAIL_USER / MAIL_PASS env vars not configured in Vercel.");
    }
  } catch (err) {
    console.error("[demo-signup] email error:", err?.message || err);
    // Still return 200 — never block the prospect
  }

  return res.status(200).json({ success: true });
}
