import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      <Header />
      <main className="flex-grow">
        <div className="prose prose-invert mx-auto py-16 px-6 border-l-4 border-blue-500 rounded-lg shadow-lg bg-gray-800/80">
          <h1 className="text-3xl font-bold mb-6 text-blue-400">Privacy Policy</h1>

          <p><strong>Effective Date:</strong> May 2, 2026</p>
          <p><strong>Developer:</strong> Kevana Enterprises / Turtle Logistics LLC</p>
          <p><strong>Contact:</strong> kevanaenterprises@gmail.com</p>

          <h2>1. Overview</h2>
          <p>
            HaulFlow (“the App”) is a mobile application for truck drivers to track loads, scan freight documents,
            manage routes, and discover historical landmarks. This Privacy Policy explains what information we collect,
            how we use it, and your rights.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>Location Data</h3>
          <p>
            HaulFlow uses GPS to detect when you're near historical markers and for navigation features.
            Data is processed on-device and not stored or shared for advertising.
          </p>

          <h3>Documents You Scan</h3>
          <p>
            Photos you take (BOLs, PODs, etc.) are stored locally or in your secure account. They’re yours—we don’t review or share them.
          </p>

          <h3>Load & Trip Information</h3>
          <p>
            Load details you enter are stored for your account only, used to provide tracking and load history.
          </p>

          <h3>Account Information</h3>
          <p>
            We collect your name and email; payments are processed securely by third-party services such as Stripe.
          </p>

          <h3>Device Information</h3>
          <p>
            Basic system data (OS version, device model) is used solely for crash reports and performance improvement.
          </p>

          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>Operate and deliver HaulFlow features</li>
            <li>Detect and present historical marker content</li>
            <li>Store and retrieve load records</li>
            <li>Send necessary app notifications</li>
            <li>Improve performance and stability</li>
          </ul>
          
<p>We do not sell, trade, or share your data for advertising.</p>

<h2>4. Location Permissions</h2>
<p>
  Location access powers marker detection and navigation. Disable it anytime in Settings; HaulFlow will still function minus those tools.
</p>

<h2>5. Camera & Storage Permissions</h2>
<p>
  Camera access is requested only while scanning documents. Captured images stay on your device or account; we don’t access them otherwise.
</p>

<h2>6. Data Storage & Security</h2>
<p>
  We use industry-standard encryption between device and server. Account data is retained while active and deleted within 30 days of account removal.
</p>

<h2>7. Third‑Party Services</h2>
<ul>
  <li>Expo (EAS) – App build and delivery</li>
  <li>Google Play Services – Distribution and crash reporting/li&gt;
  li&gt;Stripe – Payment processing/li&gt;
&lt;/ul&gt;

&lt; h2&gt;8. Children’s Privacy&lt;/ h2&gt;
&lt;p&gt;
Not directed at children under 13. We don’t knowingly collect child data; report any instance and we’ll delete it.
&lt;/ p&gt;

&lt; h2&gt;9. Your Rights&lt;/ h2&gt;
&lt; ul&gt;
<li > Access your data< / li >
<li > Request corrections or deletion< / li >
<li > Opt out of processing where applicable< / li >
< / ul >

< p > Contact us to exercise these rights: kevanaenterprises@gmail.com< / p >

< h2 >10 . Changes to This Policy< / h2 >
< p >
Updates will change the effective date . Continued use of HaulFlow after revision = acceptance of changes .
< / p >

< h2 >📬 Contact Us< / h2 >
< p >
Kevana Enterprises / Turtle Logistics LLC
kevanaenterprises@gmail.com
< / p >

<p className="mt-8 text-sm text-gray-400">Last updated: April 2026
        </div >
      </main >
      <
      Footer /
    ></div >
)
}
