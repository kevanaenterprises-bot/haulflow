import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, company, fleetSize, notes } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.MAIL_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"HaulFlow Demo" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_TO || process.env.MAIL_USER,
      subject: `New HaulFlow Demo Request – ${company || name}`,
      text: `
Name: ${name}
Email: ${email}
Company: ${company}
Fleet Size: ${fleetSize}
Notes: ${notes}
      `,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Email failed" });
  }
}
