import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, company, phone, fleetSize, notes } = req.body;

  // Always respond 200 so the prospect gets into the demo
  // — email failure is logged server-side but never blocks access.
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
          <div style="font-family:sans-serif;max-width:520px;color:#1a1a1a;">
            <h2 style="margin:0 0 16px;color:#2563eb;">New Demo Request</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#666;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;font-weight:600;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;">Company</td><td style="padding:8px 0;font-weight:600;">${company || "—"}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;font-weight:600;">${phone || "—"}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Fleet Size</td><td style="padding:8px 0;font-weight:600;">${fleetSize || "—"}</td></tr>
              ${notes ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;">Notes</td><td style="padding:8px 0;">${notes}</td></tr>` : ""}
            </table>
            <hr style="margin:20px 0;border:none;border-top:1px solid #eee;"/>
            <p style="color:#999;font-size:12px;">Submitted via haulflow.turtlelogisticsllc.com/demo</p>
          </div>
        `,
      });
    } else {
      // Log to console if email is not configured yet
      console.log("[HaulFlow Demo Signup]", { name, email, company, phone, fleetSize, notes });
      console.warn("MAIL_USER / MAIL_PASS env vars not set — email not sent.");
    }
  } catch (err) {
    // Log but don't block the prospect
    console.error("[demoSignup] email error:", err);
  }

  // Always 200 — redirect to demo happens client-side
  res.status(200).json({ success: true });
}
