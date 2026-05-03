export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, sans-serif', color: '#1e293b', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>HaulFlow</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>Effective Date: May 1, 2025 · Last Updated: May 1, 2025</p>
      </div>

      <p>HaulFlow ("we," "us," or "our") operates the HaulFlow transportation management platform and the HaulFlow Driver mobile application. This Privacy Policy explains how we collect, use, and protect your information.</p>

      <h2 style={h2}>1. Information We Collect</h2>
      <h3 style={h3}>Account Information</h3>
      <p>Name, email address, phone number, company name, MC number, DOT number, and password when you register.</p>

      <h3 style={h3}>Location Data</h3>
      <p>The HaulFlow Driver app collects GPS location data in the foreground and background while a load is active. This data is used to show your position on the fleet map, record arrival and departure times at stops, and generate IFTA mileage reports. Location tracking stops when no load is active.</p>

      <h3 style={h3}>Load & Delivery Data</h3>
      <p>Load details, proof of delivery photos, bill of lading numbers, driver notes, fuel purchases, and delivery timestamps.</p>

      <h3 style={h3}>Driver Qualification (DQ) Data</h3>
      <p>If you complete a digital DQ application, we collect employment history, driving record information, license details, and your electronic signature. This data is stored securely and shared only with the carrier you are applying to.</p>

      <h3 style={h3}>Device & Usage Data</h3>
      <p>IP address, device type, operating system version, and app usage logs for debugging and security purposes.</p>

      <h2 style={h2}>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and operate the HaulFlow platform and driver app</li>
        <li>To track active deliveries and generate compliance reports (IFTA, DQ files)</li>
        <li>To send load assignments, invoices, and account notifications via email</li>
        <li>To improve app performance and diagnose technical issues</li>
        <li>To comply with FMCSA and DOT regulatory requirements</li>
      </ul>

      <h2 style={h2}>3. Data Sharing</h2>
      <p>We do <strong>not</strong> sell your personal information. We share data only:</p>
      <ul>
        <li><strong>Within your carrier organization</strong> — dispatchers and admins on your account can view driver location, load status, and DQ file data.</li>
        <li><strong>Service providers</strong> — we use Railway (database hosting), Resend (email delivery), and Supabase (file storage). These providers process data only as needed to deliver the service.</li>
        <li><strong>Legal requirements</strong> — if required by law, court order, or regulatory authority.</li>
      </ul>

      <h2 style={h2}>4. Data Retention</h2>
      <p>Load records and proof of delivery photos are retained indefinitely to support FMCSA audit requirements. You may request deletion of your account and associated data by contacting us; some records may be retained as required by law.</p>

      <h2 style={h2}>5. Background Location</h2>
      <p>The HaulFlow Driver app requests "Always On" location permission to support continuous GPS tracking during active deliveries. This permission is used exclusively for fleet tracking and IFTA mileage reporting. You can revoke this permission in your device settings at any time, which will disable GPS tracking features.</p>

      <h2 style={h2}>6. Data Security</h2>
      <p>We use HTTPS encryption for all data in transit and secure database hosting with encrypted credentials. Authentication tokens are stored using your device's secure keychain. We do not store plaintext passwords.</p>

      <h2 style={h2}>7. Children's Privacy</h2>
      <p>HaulFlow is intended for commercial trucking professionals and is not directed at children under 13. We do not knowingly collect data from children.</p>

      <h2 style={h2}>8. Your Rights</h2>
      <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at the address below. Carriers can also remove drivers from their account through the admin portal.</p>

      <h2 style={h2}>9. Changes to This Policy</h2>
      <p>We may update this policy periodically. We will notify you of material changes by email or in-app notice. Continued use of HaulFlow after changes constitutes acceptance.</p>

      <h2 style={h2}>10. Contact Us</h2>
      <p>
        Kevana Enterprises LLC<br />
        <a href="mailto:kevanaenterprises@gmail.com" style={{ color: '#2563eb' }}>kevanaenterprises@gmail.com</a><br />
        <a href="https://haulflow.vercel.app" style={{ color: '#2563eb' }}>haulflow.vercel.app</a>
      </p>

      <p style={{ marginTop: 48, color: '#94a3b8', fontSize: 14 }}>© 2025 Kevana Enterprises LLC. All rights reserved.</p>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8, color: '#0f172a' };
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 4, color: '#334155' };
