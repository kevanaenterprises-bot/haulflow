// server/index.js â HaulFlow API Server
// Express backend for HaulFlow TMS (Transportation Management System)

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { registerDvirRoutes } from './dvir-routes.js';
import { registerDemoRoutes } from './demo-routes.js';
import { registerDriverAuthRoutes } from './driver-auth-routes.js';
import { registerTwilioStreamRoutes } from './twilio-stream.js';

const { Pool } = pg;

const app = express();
app.set('trust proxy', 1); // Required behind Railway proxy for rate limiting
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// JWT config
// ---------------------------------------------------------------------------
// JWT secret â set JWT_SECRET env var in production. Falls back to a deterministic
// hash so tokens survive server restarts (not random per-start).
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  // Stable fallback: derive from DATABASE_URL so it's unique per deployment
  const seed = process.env.DATABASE_URL || 'haulflow-default-jwt-secret-change-me';
  return crypto.createHash('sha256').update(seed).digest('hex');
})();
const JWT_EXPIRES_IN = '24h';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : undefined,
});

// ---------------------------------------------------------------------------
// Startup: auto-migrate missing columns on the live DB
// ---------------------------------------------------------------------------
async function runMigrations() {
  const migrations = [
    // customers
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS state VARCHAR(50)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip VARCHAR(20)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
    // shippers
    `ALTER TABLE shippers ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)`,
    `ALTER TABLE shippers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)`,
    `ALTER TABLE shippers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255)`,
    // trucks
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'truck'`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50)`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS state VARCHAR(50)`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS license_plate VARCHAR(50)`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS year INTEGER`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS make VARCHAR(100)`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS model VARCHAR(100)`,
    `ALTER TABLE trucks ADD COLUMN IF NOT EXISTS vin VARCHAR(50)`,
    // loads
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_city VARCHAR(100)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_state VARCHAR(50)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_address TEXT`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_zip VARCHAR(20)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS destination_address TEXT`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS destination_city VARCHAR(100)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS destination_state VARCHAR(50)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS destination_zip VARCHAR(20)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS commodity VARCHAR(255)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS weight INTEGER`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS trailer_number VARCHAR(100)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_date DATE`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_date DATE`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS rate DECIMAL(10,2)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS miles INTEGER`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS customer_id UUID`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS shipper_id UUID`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_appt_time VARCHAR(20)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_appt_time VARCHAR(20)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS shipper_lat DECIMAL(10,7)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS shipper_lng DECIMAL(10,7)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS receiver_lat DECIMAL(10,7)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS receiver_lng DECIMAL(10,7)`,
    `ALTER TABLE loads ADD COLUMN IF NOT EXISTS geofence_radius INTEGER DEFAULT 300`,
    // invoices
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2)`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS load_id UUID`,
    // companies
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS shop_alert_email VARCHAR(255)`,
    // visitor tracking
    `CREATE TABLE IF NOT EXISTS visitor_logs (
      id SERIAL PRIMARY KEY,
      ip VARCHAR(45),
      country VARCHAR(100),
      region VARCHAR(100),
      city VARCHAR(100),
      lat DECIMAL(10,7),
      lon DECIMAL(10,7),
      timezone VARCHAR(50),
      user_agent TEXT,
      referrer TEXT,
      path VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // platform activity feed
    `CREATE TABLE IF NOT EXISTS platform_activity (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50),
      detail TEXT,
      company_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // platform error log
    `CREATE TABLE IF NOT EXISTS platform_errors (
      id SERIAL PRIMARY KEY,
      method VARCHAR(10),
      path VARCHAR(200),
      error_message TEXT,
      status_code INTEGER,
      ip VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    ];
    for (const sql of migrations) {
      try { await pool.query(sql); } catch (e) { /* column may already exist, that's fine */ }
    }
  console.log(`[migrations] ${migrations.length} migration checks completed`);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  'https://haulflow.turtlelogisticsllc.com',
  'https://haulflo-turtlelogisticsllc.vercel.app', // Vercel deploy alias
  'http://localhost:5173',  // local dev
  'http://localhost:3001',  // local API
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true })); // Fix: parse Twilio form-encoded webhooks (SpeechResult)

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window per IP
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function driverAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.driver = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired driver token' });
  }
}

// Admin auth â simple password-based, separate from tenant auth
function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin not configured' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'platform_admin' || decoded.admin_pw !== ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/admin/login â platform admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const token = jwt.sign(
      { role: 'platform_admin', admin_pw: password },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/customers â list all companies with subscription info
app.get('/api/admin/customers', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.name, c.email, c.phone, c.city, c.state,
        c.stripe_customer_id, c.subscription_status, c.trial_ends_at, c.created_at,
        c.invoice_prefix, c.payment_terms,
        (SELECT COUNT(*)::int FROM drivers WHERE company_id = c.id) AS driver_count,
        (SELECT COUNT(*)::int FROM loads WHERE company_id = c.id) AS load_count,
        (SELECT COUNT(*)::int FROM invoices WHERE company_id = c.id) AS invoice_count,
        (SELECT COUNT(*)::int FROM users WHERE company_id = c.id) AS user_count
      FROM companies c
      ORDER BY c.created_at DESC
    `);

    // Count founding slots
    const founding1yr = await pool.query(
      `SELECT COUNT(*)::int AS count FROM companies WHERE subscription_status = 'founding_1yr'`
    );
    const founding6mo = await pool.query(
      `SELECT COUNT(*)::int AS count FROM companies WHERE subscription_status = 'founding_6mo'`
    );

    res.json({
      companies: result.rows,
      slots: {
        founding_1yr_used: founding1yr.rows[0]?.count || 0,
        founding_1yr_total: 12,
        founding_1yr_remaining: Math.max(0, 12 - (founding1yr.rows[0]?.count || 0)),
        founding_6mo_used: founding6mo.rows[0]?.count || 0,
        founding_6mo_total: 15,
        founding_6mo_remaining: Math.max(0, 15 - (founding6mo.rows[0]?.count || 0)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
});

// GET /api/admin/stats â platform-wide stats
app.get('/api/admin/stats', adminAuthMiddleware, async (_req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*)::int AS count FROM companies');
    const active = await pool.query("SELECT COUNT(*)::int AS count FROM companies WHERE subscription_status = 'active'");
    const trial = await pool.query("SELECT COUNT(*)::int AS count FROM companies WHERE subscription_status LIKE 'founding%'");
    const cancelled = await pool.query("SELECT COUNT(*)::int AS count FROM companies WHERE subscription_status = 'cancelled'");
    const totalUsers = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    const totalDrivers = await pool.query('SELECT COUNT(*)::int AS count FROM drivers');
    const totalLoads = await pool.query('SELECT COUNT(*)::int AS count FROM loads');
    const totalInvoices = await pool.query('SELECT COUNT(*)::int AS count FROM invoices');

    res.json({
      companies: {
        total: total.rows[0]?.count || 0,
        active: active.rows[0]?.count || 0,
        inTrial: trial.rows[0]?.count || 0,
        cancelled: cancelled.rows[0]?.count || 0,
      },
      totalUsers: totalUsers.rows[0]?.count || 0,
      totalDrivers: totalDrivers.rows[0]?.count || 0,
      totalLoads: totalLoads.rows[0]?.count || 0,
      totalInvoices: totalInvoices.rows[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Platform error logging & activity feed
// ---------------------------------------------------------------------------

// Error logging middleware â captures API errors across the platform
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
  // Log to DB async (fire-and-forget)
  pool.query(
    `INSERT INTO platform_errors (method, path, error_message, status_code, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.method, req.path.substring(0, 200), (err.message || '').substring(0, 500),
     res.statusCode || 500, (req.ip || '').substring(0, 45)]
  ).catch(() => {});
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Helper to log activity events
async function logActivity(type, detail, companyId) {
  try {
    await pool.query(
      `INSERT INTO platform_activity (type, detail, company_id) VALUES ($1, $2, $3)`,
      [type, detail.substring(0, 500), companyId || null]
    );
  } catch {}
}

// GET /api/admin/errors â recent platform errors
app.get('/api/admin/errors', adminAuthMiddleware, async (req, res) => {
  try {
    const since = req.query.since; // optional ISO timestamp
    let q = `SELECT * FROM platform_errors`;
    let params = [];
    if (since) {
      q += ` WHERE created_at > $1`;
      params.push(since);
    }
    q += ` ORDER BY created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch errors', details: err.message });
  }
});

// DELETE /api/admin/errors â clear error log
app.delete('/api/admin/errors', adminAuthMiddleware, async (_req, res) => {
  try {
    await pool.query('DELETE FROM platform_errors');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear errors', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Visitor tracking
// ---------------------------------------------------------------------------

// POST /api/track-visit â called by the demo page to log a visit
app.post('/api/track-visit', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const { path, referrer, userAgent } = req.body || {};

    // Geo-IP lookup via free ip-api.com (no key needed, 45 req/min)
    let geo = null;
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone`);
      if (geoRes.ok) {
        const data = await geoRes.json();
        if (data.status === 'success') geo = data;
      }
    } catch { /* geo lookup failed, log without it */ }

    await pool.query(
      `INSERT INTO visitor_logs (ip, country, region, city, lat, lon, timezone, user_agent, referrer, path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        ip.substring(0, 45),
        geo?.country || null,
        geo?.regionName || null,
        geo?.city || null,
        geo?.lat || null,
        geo?.lon || null,
        geo?.timezone || null,
        (userAgent || req.headers['user-agent'] || '').substring(0, 500),
        (referrer || '').substring(0, 500),
        (path || '/demo').substring(0, 200),
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    // Never let tracking errors break anything
    res.json({ ok: true });
  }
});

// GET /api/admin/visitors â visitor analytics for admin dashboard
app.get('/api/admin/visitors', adminAuthMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [visitsRes, statsRes, countryRes, recentRes] = await Promise.all([
      // Total visits in period
      pool.query('SELECT COUNT(*)::int AS count FROM visitor_logs WHERE created_at > $1', [since]),
      // Unique IPs in period
      pool.query('SELECT COUNT(DISTINCT ip)::int AS count FROM visitor_logs WHERE created_at > $1', [since]),
      // Top countries
      pool.query(
        `SELECT country, COUNT(*)::int AS visits FROM visitor_logs WHERE created_at > $1 AND country IS NOT NULL GROUP BY country ORDER BY visits DESC LIMIT 10`,
        [since]
      ),
      // Recent visits (last 50)
      pool.query(
        `SELECT * FROM visitor_logs WHERE created_at > $1 ORDER BY created_at DESC LIMIT 50`,
        [since]
      ),
    ]);

    res.json({
      period_days: days,
      total_visits: visitsRes.rows[0].count,
      unique_visitors: statsRes.rows[0].count,
      top_countries: countryRes.rows,
      recent: recentRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch visitors', details: err.message });
  }
});

// GET /api/admin/activity â recent platform activity (signups, payments, errors)
app.get('/api/admin/activity', adminAuthMiddleware, async (req, res) => {
  try {
    const since = req.query.since; // optional ISO timestamp
    let q = `SELECT * FROM platform_activity`;
    let params = [];
    if (since) {
      q += ` WHERE created_at > $1`;
      params.push(since);
    }
    q += ` ORDER BY created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity', details: err.message });
  }
});

// GET /api/admin/health â deep platform health check
app.get('/api/admin/health', adminAuthMiddleware, async (_req, res) => {
  try {
    const checks = {};

    // Database health
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    checks.database = { status: 'healthy', latency_ms: Date.now() - dbStart };

    // Stripe connectivity
    const stripeStart = Date.now();
    try {
      if (STRIPE_SECRET_KEY) {
        const r = await fetch('https://api.stripe.com/v1/balance', {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        });
        checks.stripe = {
          status: r.ok ? 'connected' : 'error',
          latency_ms: Date.now() - stripeStart,
          mode: STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
        };
      } else {
        checks.stripe = { status: 'not configured' };
      }
    } catch {
      checks.stripe = { status: 'unreachable' };
    }

    // Railway env status
    checks.environment = {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: process.env.PORT || 3001,
      has_stripe_key: !!STRIPE_SECRET_KEY,
      has_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      has_mail_config: !!(process.env.MAIL_USER && process.env.MAIL_PASS),
      has_admin_password: !!process.env.ADMIN_PASSWORD,
    };

    // Uptime (process)
    checks.process = {
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round((process.memoryUsage?.().heapUsed || 0) / 1024 / 1024),
    };

    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: 'Health check failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Health check (Railway uses this)
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'HaulFlow API', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await pool.query(
      `SELECT u.*, c.name AS company_name
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.email = $1 AND u.is_active = true`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const payload = {
      user_id: user.id,
      company_id: user.company_id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ---------------------------------------------------------------------------
// Password reset â forgot password (send email with reset link)
// ---------------------------------------------------------------------------
const resetLimiter = rateLimit({ windowMs: 60_000, max: 3 });

function getMailTransporter() {
  const mailUser = process.env.MAIL_USER;
  const mailPass = process.env.MAIL_PASS;
  if (!mailUser || !mailPass) return null;
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp-mail.outlook.com',
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: { user: mailUser, pass: mailPass },
  });
}

app.post('/api/auth/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query(
      'SELECT u.id, u.name, c.name AS company_name FROM users u JOIN companies c ON c.id = u.company_id WHERE u.email = $1 AND u.is_active = true',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    // Always return success to avoid leaking which emails exist
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id]
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, NOW())',
      [user.id, token, expiresAt]
    );

    const transporter = getMailTransporter();
    const resetUrl = `${process.env.APP_URL || 'https://haulflow.turtlelogisticsllc.com'}/reset-password?token=${token}`;

    if (transporter) {
      transporter.sendMail({
        from: `"HaulFlow" <${process.env.MAIL_USER}>`,
        to: email,
        subject: 'HaulFlow â Password Reset',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
            <div style="background:#1e40af;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
              <h2 style="margin:0;font-size:18px;">ð HaulFlow Password Reset</h2>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px;">
              <p style="margin:0 0 16px;">Hi ${user.name || 'there'},</p>
              <p style="margin:0 0 16px;">You requested a password reset for your HaulFlow account (<strong>${user.company_name}</strong>).</p>
              <p style="margin:0 0 16px;">Click the button below to set a new password. This link expires in 1 hour.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${resetUrl}" style="background:#1e40af;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
              </div>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 16px;color:#6b7280;font-size:13px;word-break:break-all;">${resetUrl}</p>
              <p style="margin:0;color:#9ca3af;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>`,
      })
        .then(() => console.log('[AUTH] Password reset email sent to:', email))
        .catch(err => console.error('[AUTH] Password reset email failed:', err.message));
    } else {
      console.warn('[AUTH] Password reset email NOT sent â MAIL_USER/MAIL_PASS not configured');
      console.log('[AUTH] Reset URL would be:', resetUrl);
    }

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    console.error('[AUTH] Forgot password error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Password reset â set new password
// ---------------------------------------------------------------------------
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, tokenRow.user_id]
    );
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [tokenRow.user_id]
    );

    console.log('[AUTH] Password reset successfully for user:', tokenRow.user_id);
    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('[AUTH] Reset password error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Company / Loads / Drivers / Customers / Shippers / Invoices CRUD
// ---------------------------------------------------------------------------

// -- Loads --

// Distance estimation (haversine on city centroids â no external API needed)
const STATE_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};
function normalizeState(s) {
  if (!s) return s;
  const trimmed = s.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return STATE_ABBR[trimmed.toLowerCase()] || trimmed;
}
const CITY_COORDS = {
  'AL': { lat: 32.806671, lng: -86.791130 }, 'AK': { lat: 61.370716, lng: -152.404419 },
  'AZ': { lat: 33.729759, lng: -111.431211 }, 'AR': { lat: 34.969704, lng: -92.373123 },
  'CA': { lat: 36.778261, lng: -119.417932 }, 'CO': { lat: 39.059811, lng: -105.311104 },
  'CT': { lat: 41.597782, lng: -72.755371 }, 'DE': { lat: 39.318515, lng: -75.507141 },
  'FL': { lat: 27.766279, lng: -81.686783 }, 'GA': { lat: 32.157435, lng: -82.907123 },
  'HI': { lat: 21.094718, lng: -157.498337 }, 'ID': { lat: 44.068203, lng: -114.742043 },
  'IL': { lat: 40.633125, lng: -89.398528 }, 'IN': { lat: 39.766914, lng: -86.149936 },
  'IA': { lat: 41.878003, lng: -93.097770 }, 'KS': { lat: 38.526600, lng: -96.726486 },
  'KY': { lat: 37.090240, lng: -85.602432 }, 'LA': { lat: 31.169546, lng: -91.867805 },
  'ME': { lat: 44.693947, lng: -69.381944 }, 'MD': { lat: 39.063946, lng: -76.802101 },
  'MA': { lat: 42.230171, lng: -71.530106 }, 'MI': { lat: 43.326618, lng: -84.249607 },
  'MN': { lat: 46.729553, lng: -94.685700 }, 'MS': { lat: 32.741646, lng: -89.678696 },
  'MO': { lat: 38.456100, lng: -92.201820 }, 'MT': { lat: 46.879682, lng: -110.362566 },
  'NE': { lat: 41.125496, lng: -98.268082 }, 'NV': { lat: 38.802610, lng: -116.414387 },
  'NH': { lat: 42.930061, lng: -71.463557 }, 'NJ': { lat: 39.833851, lng: -74.871826 },
  'NM': { lat: 34.425974, lng: -107.757780 }, 'NY': { lat: 40.712784, lng: -74.005941 },
  'NC': { lat: 35.630066, lng: -79.806419 }, 'ND': { lat: 47.528936, lng: -99.784040 },
  'OH': { lat: 40.417287, lng: -82.907123 }, 'OK': { lat: 35.007752, lng: -95.992575 },
  'OR': { lat: 43.804133, lng: -120.554201 }, 'PA': { lat: 40.590752, lng: -77.209755 },
  'RI': { lat: 41.147234, lng: -71.544660 }, 'SC': { lat: 33.856892, lng: -80.945007 },
  'SD': { lat: 43.969814, lng: -99.901813 }, 'TN': { lat: 35.860119, lng: -86.460649 },
  'TX': { lat: 31.054487, lng: -97.563461 }, 'UT': { lat: 39.320980, lng: -111.093731 },
  'VT': { lat: 44.045868, lng: -72.710356 }, 'VA': { lat: 37.540727, lng: -78.457889 },
  'WA': { lat: 47.400902, lng: -121.490494 }, 'WV': { lat: 38.491233, lng: -80.954453 },
  'WI': { lat: 44.512483, lng: -89.764528 }, 'WY': { lat: 42.755966, lng: -107.302490 },
};

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

app.post('/api/distance', authMiddleware, (req, res) => {
  try {
    const { origin, dest } = req.body;
    const oc = CITY_COORDS[normalizeState(origin?.state) || ''];
    const dc = CITY_COORDS[normalizeState(dest?.state) || ''];
    if (!oc || !dc) return res.status(400).json({ error: 'State not recognized' });
    const miles = haversineMiles(oc.lat, oc.lng, dc.lat, dc.lng);
    res.json({ miles });
  } catch (err) {
    res.status(500).json({ error: 'Distance calculation failed', details: err.message });
  }
});

// -- Loads --
app.get('/api/loads', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, d.name AS driver_name, s.name AS shipper_name
       FROM loads l
       LEFT JOIN drivers d ON d.id = l.driver_id
       LEFT JOIN shippers s ON s.id = l.shipper_id
       WHERE l.company_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch loads', details: err.message });
  }
});

app.post('/api/loads', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO loads (
        company_id, load_number, shipper_id, customer_id, driver_id,
        origin_address, origin_city, origin_state, origin_zip,
        destination_address, destination_city, destination_state, destination_zip,
        pickup_date, delivery_date, rate, status, notes, weight, commodity, miles
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        req.user.company_id, b.load_number, b.shipper_id || null, b.customer_id || null,
        b.driver_id || null,
        b.origin_address || null, b.origin_city || null, normalizeState(b.origin_state) || null, b.origin_zip || null,
        b.destination_address || null, b.destination_city || null, normalizeState(b.destination_state) || null, b.destination_zip || null,
        b.pickup_date || null, b.delivery_date || null, b.rate || 0, b.status || 'WAITING_DISPATCH',
        b.notes || null, b.weight || null, b.commodity || null, b.miles || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create load', details: err.message });
  }
});

app.put('/api/loads/:id', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `UPDATE loads SET
        load_number=$1, shipper_id=$2, customer_id=$3, driver_id=$4,
        origin_address=$5, origin_city=$6, origin_state=$7, origin_zip=$8,
        destination_address=$9, destination_city=$10, destination_state=$11, destination_zip=$12,
        pickup_date=$13, delivery_date=$14, rate=$15, status=$16, notes=$17, weight=$18, commodity=$19
       WHERE id=$20 AND company_id=$21 RETURNING *`,
      [
        b.load_number, b.shipper_id || null, b.customer_id || null, b.driver_id || null,
        b.origin_address, b.origin_city, normalizeState(b.origin_state), b.origin_zip,
        b.destination_address, b.destination_city, normalizeState(b.destination_state), b.destination_zip,
        b.pickup_date || null, b.delivery_date || null, b.rate || 0, b.status || 'WAITING_DISPATCH',
        b.notes || null, b.weight || null, b.commodity || null,
        req.params.id, req.user.company_id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Load not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update load', details: err.message });
  }
});

app.delete('/api/loads/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM loads WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete load', details: err.message });
  }
});

// POST /api/loads/:id/assign — assign driver and dispatch load
app.post('/api/loads/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { driver_id } = req.body;
    if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });
    const result = await pool.query(
      `UPDATE loads SET driver_id = $1, status = 'DISPATCHED'
       WHERE id = $2 AND company_id = $3 RETURNING *`,
      [driver_id, req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Load not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign driver', details: err.message });
  }
});

// -- Drivers --
app.get('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM drivers WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers', details: err.message });
  }
});

// POST /api/loads/:id/regenerate-geofence — geocode shipper or receiver address
app.post('/api/loads/:id/regenerate-geofence', authMiddleware, async (req, res) => {
  try {
    const { side } = req.body; // 'shipper' or 'receiver'
    if (!side || !['shipper', 'receiver'].includes(side)) {
      return res.status(400).json({ error: 'side must be shipper or receiver' });
    }

    // Fetch the load
    const loadResult = await pool.query(
      'SELECT * FROM loads WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    const load = loadResult.rows[0];
    if (!load) return res.status(404).json({ error: 'Load not found' });

    // Build address string for geocoding
    let address, city, state;
    if (side === 'shipper') {
      address = load.origin_address;
      city = load.origin_city;
      state = load.origin_state;
    } else {
      address = load.destination_address;
      city = load.destination_city;
      state = load.destination_state;
    }

    if (!city || !state) {
      return res.status(400).json({ error: 'No address data available for geocoding' });
    }

    const query = [address, city, state, 'USA'].filter(Boolean).join(', ');

    // Use Nominatim (OpenStreetMap) - free, no key needed
    const geoUrl = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'HaulFlow-TMS/1.0' }
    });
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      return res.status(404).json({ error: 'Could not geocode address: ' + query });
    }

    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);

    // Save to DB
    const latCol = side === 'shipper' ? 'shipper_lat' : 'receiver_lat';
    const lngCol = side === 'shipper' ? 'shipper_lng' : 'receiver_lng';

    const result = await pool.query(
      'UPDATE loads SET ' + latCol + ' = $1, ' + lngCol + ' = $2 WHERE id = $3 AND company_id = $4 RETURNING *',
      [lat, lng, req.params.id, req.user.company_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Geocoding failed', details: err.message });
  }
});

app.post('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO drivers (company_id, name, phone, email, license_number, license_expiry, medical_card_expiry, hire_date, status, termination_date, cdl_file_url, medical_card_file_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.company_id, b.name, b.phone || null, b.email || null, b.license_number || null, b.license_expiry || null, b.medical_card_expiry || null, b.hire_date || null, b.status || 'available', b.termination_date || null, b.cdl_file_url || null, b.medical_card_file_url || null]
    );

    // Set driver portal password if provided
    if (b.portal_password) {
      const hash = crypto.createHash('sha256').update(b.portal_password).digest('hex');
      await pool.query('UPDATE drivers SET password_hash = $1 WHERE id = $2', [hash, result.rows[0].id]);
      result.rows[0].password_hash = hash;
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create driver', details: err.message });
  }
});

app.patch('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const fields = [];
    const values = [];
    const allowed = ['name','phone','email','license_number','license_expiry','medical_card_expiry','hire_date','termination_date','status','cdl_file_url','medical_card_file_url'];
    for (const key of allowed) {
      if (key in b) {
        fields.push(key + ' = $' + (values.length + 1));
        values.push(b[key] || null);
      }
    }
    if (b.portal_password) {
      fields.push('password_hash = $' + (values.length + 1));
      values.push(crypto.createHash('sha256').update(b.portal_password).digest('hex'));
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const idIdx = values.length + 1;
    const companyIdx = values.length + 2;
    values.push(req.params.id, req.user.company_id);
    const result = await pool.query(
      'UPDATE drivers SET ' + fields.join(', ') + ' WHERE id = $' + idIdx + ' AND company_id = $' + companyIdx + ' RETURNING *',
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update driver', details: err.message });
  }
});

app.delete('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM drivers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete driver', details: err.message });
  }
});

// -- Customers --
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE company_id = $1 ORDER BY company_name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO customers (company_id, company_name, contact_name, contact_phone, email, address, city, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.company_id, b.name || b.company_name, b.contact_name, b.phone || b.contact_phone, b.email, b.billing_address || b.address, b.city, normalizeState(b.state)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer', details: err.message });
  }
});

// -- Shippers --
app.get('/api/shippers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shippers WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shippers', details: err.message });
  }
});

app.post('/api/shippers', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO shippers (company_id, type, name, address, city, state, zip, contact_name, contact_phone, contact_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.company_id, b.type || 'shipper', b.name, b.address, b.city, normalizeState(b.state), b.zip, b.contact_name, b.contact_phone || b.phone || null, b.contact_email || b.email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create shipper', details: err.message })

// PATCH /api/shippers/:id — update a shipper or receiver
app.patch('/api/shippers/:id', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const fields = [];
    const values = [];
    const allowed = ['type','name','address','city','state','zip','contact_name','contact_phone','contact_email'];
    for (const key of allowed) {
      if (key in b) {
        fields.push(key + ' = $' + (values.length + 1));
        values.push(b[key] || null);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const idIdx = values.length + 1;
    const companyIdx = values.length + 2;
    values.push(req.params.id, req.user.company_id);
    const result = await pool.query(
      'UPDATE shippers SET ' + fields.join(', ') + ' WHERE id = $' + idIdx + ' AND company_id = $' + companyIdx + ' RETURNING *',
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Shipper not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shipper', details: err.message });
  }
});

// DELETE /api/shippers/:id — delete a shipper or receiver
app.delete('/api/shippers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM shippers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete shipper', details: err.message });
  }
});;
  }
});

// -- Invoices --
app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.company_name AS customer_name, l.load_number
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN loads l ON l.id = i.load_id
       WHERE i.company_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices', details: err.message });
  }
});

app.post('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const counterResult = await pool.query(
      `UPDATE companies SET invoice_counter = invoice_counter + 1 WHERE id = $1 RETURNING invoice_prefix, invoice_counter`,
      [req.user.company_id]
    );
    const { invoice_prefix, invoice_counter } = counterResult.rows[0];
    const invoiceNumber = `${invoice_prefix}-${String(invoice_counter).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO invoices (company_id, invoice_number, customer_id, load_id, amount, status, due_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.company_id, invoiceNumber, b.customer_id, b.load_id || null, b.amount, 'unpaid', b.due_date || null, b.notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice', details: err.message });
  }
});

app.patch('/api/invoices/:id/pay', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark invoice paid', details: err.message });
  }
});

// -- Trucks / Assets --
app.get('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trucks WHERE company_id = $1 ORDER BY unit_number',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trucks', details: err.message });
  }
});

app.post('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO trucks (company_id, unit_number, type, make, model, year, vin, license_plate, state, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.company_id, b.unit_number, b.type || 'truck', b.make, b.model, b.year, b.vin, b.license_plate, b.state, b.status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create truck', details: err.message });
  }
});

// -- Employees --
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, job_title, is_active, created_at FROM users WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees', details: err.message });
  }
});

// -- Company settings --
app.get('/api/company', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company', details: err.message });
  }
});

app.put('/api/company', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `UPDATE companies SET name=$1, email=$2, phone=$3, address=$4, city=$5, state=$6, zip=$7,
        invoice_prefix=$8, payment_terms=$9
       WHERE id=$10 RETURNING *`,
      [b.name, b.email, b.phone, b.address, b.city, b.state, b.zip, b.invoice_prefix, b.payment_terms, req.user.company_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update company', details: err.message });
  }
});

// -- Settings (thin wrapper over companies columns) --
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT auto_invoicing, dvir_photo_gated, maintenance_alert_email
         FROM companies WHERE id = $1`, [req.user.company_id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
  }
});

app.patch('/api/settings', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const sets = [];
    const vals = [];
    const allowed = ['auto_invoicing', 'dvir_photo_gated', 'maintenance_alert_email'];
    for (const col of allowed) {
      if (b[col] !== undefined) {
        sets.push(`${col} = $${sets.length + 1}`);
        vals.push(b[col]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid settings fields provided' });
    vals.push(req.user.company_id);
    const result = await pool.query(
      `UPDATE companies SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING auto_invoicing, dvir_photo_gated, maintenance_alert_email`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Driver portal routes
// ---------------------------------------------------------------------------
app.get('/api/driver/loads', driverAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.company_id, l.load_number, l.status, l.driver_id, l.customer_id, l.origin_address, l.origin_city, l.origin_state, l.origin_zip, l.dest_address, l.dest_city, l.dest_state, l.destination_address, l.destination_city, l.destination_state, l.destination_zip, l.pickup_date, l.delivery_date, l.pickup_appt_time, l.delivery_appt_time, l.cargo_description, l.commodity, l.weight, l.bol_number, l.miles, l.miles_driven, l.fuel_surcharge, l.lumper_fee, l.acceptance_token, l.accepted_at, l.delivered_at, l.pod_url, l.pod_urls, l.driver_notes, l.notes, l.shipper_lat, l.shipper_lng, l.receiver_lat, l.receiver_lng, l.geofence_radius, l.truck_id, l.trailer_number, l.shipper_id, l.shipper_name, l.created_at, s.name AS shipper_name
       FROM loads l
       LEFT JOIN shippers s ON s.id = l.shipper_id
       WHERE l.driver_id = $1 AND l.company_id = $2
       ORDER BY l.pickup_date DESC`,
      [req.driver.driver_id, req.driver.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch driver loads', details: err.message });
  }
});

app.patch('/api/driver/loads/:id/status', driverAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE loads SET status = $1 WHERE id = $2 AND driver_id = $3 AND company_id = $4 RETURNING *`,
      [status, req.params.id, req.driver.driver_id, req.driver.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Load not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update load status', details: err.message });
  }
});
// ---------------------------------------------------------------------------
// Self-Service Onboarding â POST /api/onboard
// Creates a new company + admin user, returns auto-login token
// ---------------------------------------------------------------------------
app.post('/api/onboard', onboardingLimiter, async (req, res) => {
    try {
          const {
                  company_name, company_email, company_phone,
                  mc_number, dot_number,
                  admin_name, admin_email, password,
          } = req.body || {};

          if (!company_name || !admin_name || !admin_email || !password) {
                  return res.status(400).json({ error: 'Company name, your name, email, and password are required.' });
          }
          if (password.length < 6) {
                  return res.status(400).json({ error: 'Password must be at least 6 characters.' });
          }

          // Check if email already exists
          const existing = await pool.query('SELECT id FROM users WHERE email = $1', [admin_email.toLowerCase().trim()]);
          if (existing.rows.length > 0) {
                  return res.status(409).json({ error: 'An account with that email already exists. Please log in instead.' });
          }

          const password_hash = crypto.createHash('sha256').update(password).digest('hex');

          // Create company
          const companyResult = await pool.query(
                  `INSERT INTO companies (name, email, phone, subscription_status)
                         VALUES ($1, $2, $3, 'trial')
                                RETURNING *`,
                  [company_name.trim(), company_email || null, company_phone || null]
                );
          const company = companyResult.rows[0];

          // Store MC/DOT if provided
          if (mc_number || dot_number) {
                  await pool.query(
                            `UPDATE companies SET mc_number = $1, dot_number = $2 WHERE id = $3`,
                            [mc_number || null, dot_number || null, company.id]
                          ).catch(() => {}); // columns may not exist yet â non-fatal
          }

          // Create admin user
          const userResult = await pool.query(
                  `INSERT INTO users (company_id, name, email, password_hash, role)
                         VALUES ($1, $2, $3, $4, 'admin')
                                RETURNING *`,
                  [company.id, admin_name.trim(), admin_email.toLowerCase().trim(), password_hash]
                );
          const user = userResult.rows[0];

          // Build token (same simple format as the rest of the app)
          const payload = {
                  user_id: user.id,
                  company_id: company.id,
                  email: user.email,
                  role: user.role,
          };
          const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

          console.log(`[ONBOARD] New company created: ${company_name} (${company.id}) â admin: ${admin_email}`);

          res.json({
                  token,
                  user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role,
                            company_id: company.id,
                            company_name: company.name,
                  },
                  company: {
                            id: company.id,
                            name: company.name,
                  },
          });
    } catch (err) {
          console.error('[ONBOARD] Error:', err.message);
          res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
});
// ---------------------------------------------------------------------------
// Setup Wizard Complete â POST /api/setup/complete
// Saves company profile + invoice config from the onboarding wizard
// Called after Stripe payment, from /setup page
// ---------------------------------------------------------------------------
app.post('/api/setup/complete', authMiddleware, async (req, res) => {
    try {
          const {
                  // Company profile (Step 1)
                  legalName, dotNumber, mcNumber, primaryHubAddress, taxId,
                  // Invoice config (Step 4)
                  startingInvoiceNumber, billingPhone, billingEmail, shopAlertEmail,
          } = req.body || {};

          const company_id = req.user.company_id;

          // Build update fields
          const updates = [];
          const values = [];
          let idx = 1;

          if (legalName) { updates.push(`name = $${idx++}`); values.push(legalName); }
          if (dotNumber) { updates.push(`dot_number = $${idx++}`); values.push(dotNumber); }
          if (mcNumber) { updates.push(`mc_number = $${idx++}`); values.push(mcNumber); }
          if (primaryHubAddress) { updates.push(`address = $${idx++}`); values.push(primaryHubAddress); }
          if (billingPhone) { updates.push(`phone = $${idx++}`); values.push(billingPhone); }
          if (billingEmail) { updates.push(`email = $${idx++}`); values.push(billingEmail); }
          if (shopAlertEmail) { updates.push(`shop_alert_email = $${idx++}`); values.push(shopAlertEmail); }
          if (startingInvoiceNumber) { updates.push(`invoice_counter = $${idx++}`); values.push(parseInt(startingInvoiceNumber, 10) || 1001); }

          if (updates.length > 0) {
                  values.push(company_id);
                  await pool.query(
                            `UPDATE companies SET ${updates.join(', ')} WHERE id = $${idx}`,
                            values
                          );
          }

          console.log(`[SETUP] Company ${company_id} setup complete`);
          logActivity('setup_complete', `Company ${company_id} completed setup wizard`, company_id);
          res.json({ success: true });
    } catch (err) {
          console.error('[SETUP] Error:', err.message);
          res.status(500).json({ error: 'Failed to save setup. Please try again.' });
    }
});



// ---------------------------------------------------------------------------
// Stripe Checkout
// ---------------------------------------------------------------------------
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Pricing tiers configuration
const PLANS = {
  'founding-1yr': {
    label: 'Founding Owner-Op',
    amount: 15000, // $150/mo after trial
    trialDays: 365, // 1 year free
    description: '1 year free, then $150/mo. Any platform.',
    slotLimit: 25,
    slotStatus: 'founding_1yr',
    requiresAndroid: false,
  },
  'fleet-20': {
    label: 'Fleet (2â20 trucks)',
    amount: 35000, // $350/mo
    trialDays: 0,
    description: '2â20 trucks. Full platform. Cancel anytime.',
    slotLimit: Infinity,
    slotStatus: null,
    requiresAndroid: false,
  },
  'fleet-50': {
    label: 'Fleet (21â50 trucks)',
    amount: 55000, // $550/mo
    trialDays: 0,
    description: '21â50 trucks. Full platform. Cancel anytime.',
    slotLimit: Infinity,
    slotStatus: null,
    requiresAndroid: false,
  },
};

// GET /api/pricing â returns available tiers with slot counts
app.get('/api/pricing', async (_req, res) => {
  try {
    const tiers = [];

    for (const [id, plan] of Object.entries(PLANS)) {
      const tier = {
        id,
        label: plan.label,
        amount: plan.amount,
        trialDays: plan.trialDays,
        description: plan.description,
        requiresAndroid: plan.requiresAndroid,
        slotsRemaining: null,
      };

      if (plan.slotStatus) {
        const result = await pool.query(
          `SELECT COUNT(*)::int AS taken FROM companies WHERE subscription_status = $1`,
          [plan.slotStatus]
        );
        tier.slotsRemaining = Math.max(0, plan.slotLimit - (result.rows[0]?.taken || 0));
      }

      tiers.push(tier);
    }

    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// ---------------------------------------------------------------------------
// TTS Proxy â ElevenLabs (keeps API key server-side)
// ---------------------------------------------------------------------------
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICES = {
  female: 'pNInz6obpgDQGcFmaJgB', // Rachel â warm, natural female
  male:   'TxGEqnHWrfWFTfGW9XjX', // Josh â clear, natural male
};

app.post('/api/tts', async (req, res) => {
  try {
    const { text, gender = 'female' } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    if (!ELEVENLABS_API_KEY) {
      // Fallback: return empty so frontend falls back to browser speech
      return res.status(503).json({ error: 'TTS not configured' });
    }

    const voiceId = ELEVENLABS_VOICES[gender] || ELEVENLABS_VOICES.female;
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 500), // cap at 500 chars
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errBody = await elevenRes.text();
      console.error('[TTS] ElevenLabs error:', elevenRes.status, errBody);
      return res.status(502).json({ error: 'TTS generation failed' });
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // cache for 24h
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('[TTS] Error:', err.message);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// POST /api/create-checkout-session â creates a Stripe Checkout session
app.post('/api/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment system not configured. Please contact support.' });
    }

    const { plan: planId } = req.body || {};
    const plan = PLANS[planId];

    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    // Check founding slot availability
    if (plan.slotStatus) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS taken FROM companies WHERE subscription_status = $1`,
        [plan.slotStatus]
      );
      const taken = result.rows[0]?.taken || 0;
      if (taken >= plan.slotLimit) {
        return res.status(403).json({ error: 'This founding slot has been claimed. Choose another plan.' });
      }
    }

    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'mode': 'subscription',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `HaulFlow TMS â ${plan.label}`,
      'line_items[0][price_data][product_data][description]': plan.description,
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][unit_amount]': String(plan.amount),
      'line_items[0][quantity]': '1',
      'customer_email': req.user.email,
      'metadata[company_id]': req.user.company_id,
      'metadata[user_id]': req.user.user_id,
      'metadata[plan]': planId,
      'subscription_data[metadata][company_id]': req.user.company_id,
      'subscription_data[metadata][plan]': planId,
      'success_url': `${process.env.PUBLIC_URL || 'https://haulflow.turtlelogisticsllc.com'}/setup`,
      'cancel_url': `${process.env.PUBLIC_URL || 'https://haulflow.turtlelogisticsllc.com'}/subscribe`,
    });

    // Add trial period for founding tiers
    if (plan.trialDays > 0) {
      params.append('subscription_data[trial_period_days]', String(plan.trialDays));
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[STRIPE] Checkout error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'Stripe error' });
    }

    const session = await response.json();

    // Claim the founding slot immediately (before payment completes)
    if (plan.slotStatus) {
      await pool.query(
        `UPDATE companies SET subscription_status = $1 WHERE id = $2 AND subscription_status = 'trial'`,
        [plan.slotStatus, req.user.company_id]
      );
    }

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[STRIPE] Checkout session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/webhook â Stripe webhook for payment events
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.warn('[STRIPE] Webhook received but no STRIPE_WEBHOOK_SECRET configured');
    return res.status(200).end();
  }

  let event;
  try {
    event = JSON.parse(req.body);
  } catch (err) {
    console.error('[STRIPE] Webhook parse error:', err.message);
    return res.status(400).send('Webhook error');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.metadata?.company_id;
        const plan = session.metadata?.plan;

        if (!companyId) break;

        // Store Stripe customer ID
        if (session.customer) {
          await pool.query(
            'UPDATE companies SET stripe_customer_id = $1 WHERE id = $2',
            [session.customer, companyId]
          );
        }

        // For paid plans, set active. For founding plans, status was already set at checkout creation.
        const planConfig = PLANS[plan];
        if (planConfig && !planConfig.slotStatus) {
          await pool.query(
            "UPDATE companies SET subscription_status = 'active' WHERE id = $1",
            [companyId]
          );
        }

        console.log(`[STRIPE] Checkout completed for company ${companyId} (plan: ${plan})`);
        logActivity('stripe_checkout', `Checkout completed for company ${companyId} (${plan})`, companyId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const companyId = sub.metadata?.company_id;

        if (!companyId) break;

        // Handle trial ending â subscription going active
        if (sub.status === 'active' && !sub.trial_end) {
          await pool.query(
            "UPDATE companies SET subscription_status = 'active' WHERE id = $1",
            [companyId]
          );
          console.log(`[STRIPE] Trial ended, subscription active for company ${companyId}`);
        }

        // Handle cancellation
        if (sub.status === 'canceled') {
          await pool.query(
            "UPDATE companies SET subscription_status = 'cancelled' WHERE id = $1",
            [companyId]
          );
          console.log(`[STRIPE] Subscription cancelled for company ${companyId}`);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;

        if (subId) {
          // Find company by looking up their latest subscription
          console.warn(`[STRIPE] Payment failed for subscription ${subId}`);
          // TODO: notify company admin via email
        }
        break;
      }
    }
  } catch (err) {
    console.error('[STRIPE] Webhook handler error:', err.message);
  }

  res.status(200).end();
});



// ---------------------------------------------------------------------------
// AI Driver Suggestion
// ---------------------------------------------------------------------------
app.post('/api/suggest-driver', authMiddleware, async (req, res) => {
  try {
    const { load_id } = req.body;
    if (!load_id) return res.status(400).json({ error: 'load_id is required' });

    const loadResult = await pool.query(
      'SELECT * FROM loads WHERE id = $1 AND company_id = $2',
      [load_id, req.user.company_id]
    );
    const load = loadResult.rows[0];
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const driversResult = await pool.query(
      "SELECT * FROM drivers WHERE company_id = $1 AND status != 'terminated' ORDER BY name",
      [req.user.company_id]
    );
    const drivers = driversResult.rows;
    if (drivers.length === 0) return res.status(200).json({ suggestion: null, reason: 'No drivers found.' });

    const scoringData = await Promise.all(drivers.map(async (driver) => {
      const lastLoadResult = await pool.query(
        "SELECT dest_city, dest_state, destination_city, destination_state FROM loads WHERE driver_id = $1 AND company_id = $2 AND status = 'DELIVERED' ORDER BY delivery_date DESC, created_at DESC LIMIT 1",
        [driver.id, req.user.company_id]
      );
      const lastLoad = lastLoadResult.rows[0];

      const onTimeResult = await pool.query(
        "SELECT COUNT(*)::int AS total, COUNT(CASE WHEN delivered_at IS NOT NULL AND delivered_at::date <= delivery_date THEN 1 END)::int AS on_time FROM loads WHERE driver_id = $1 AND company_id = $2 AND status = 'DELIVERED' AND delivery_date IS NOT NULL",
        [driver.id, req.user.company_id]
      );
      const { total: totalDelivered, on_time } = onTimeResult.rows[0];

      const originState = load.origin_state;
      const destState = load.destination_state || load.dest_state;
      const routeResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM loads WHERE driver_id = $1 AND company_id = $2 AND (origin_state = $3 OR origin_state = $3) AND (destination_state = $4 OR dest_state = $4) AND status = 'DELIVERED'",
        [driver.id, req.user.company_id, originState, destState]
      );
      const routeCount = routeResult.rows[0]?.count || 0;

      const driverState = lastLoad?.destination_state || lastLoad?.dest_state || null;
      let distanceMiles = null;
      if (driverState && originState) {
        const dc = CITY_COORDS[normalizeState(driverState)];
        const oc = CITY_COORDS[normalizeState(originState)];
        if (dc && oc) distanceMiles = haversineMiles(dc.lat, dc.lng, oc.lat, oc.lng);
      }

      return { driver, lastLoad, totalDelivered, on_time, routeCount, distanceMiles };
    }));

    const driverSummaries = scoringData.map(d => {
      const onTimePct = d.totalDelivered > 0 ? Math.round((d.on_time / d.totalDelivered) * 100) : null;
      const lastCity = d.lastLoad ? (d.lastLoad.destination_city || d.lastLoad.dest_city) + ', ' + (d.lastLoad.destination_state || d.lastLoad.dest_state) : 'Unknown';
      return '- ' + d.driver.name + ' | Status: ' + d.driver.status + ' | Last location: ' + lastCity + ' | Distance to pickup: ' + (d.distanceMiles != null ? d.distanceMiles + ' miles' : 'Unknown') + ' | On-time: ' + (onTimePct != null ? onTimePct + '% (' + d.totalDelivered + ' loads)' : 'No history') + ' | Done this route (' + (load.origin_state || '?') + '->' + (load.destination_state || load.dest_state || '?') + '): ' + (d.routeCount > 0 ? 'Yes (' + d.routeCount + 'x)' : 'No');
    }).join('\n');

    const prompt = 'You are a dispatcher assistant for a trucking company. Based on the following criteria, suggest the BEST driver for this load.\n\nLoad: #' + load.load_number + ' | ' + (load.origin_city || '') + ', ' + (load.origin_state || '') + ' -> ' + (load.destination_city || load.dest_city || '') + ', ' + (load.destination_state || load.dest_state || '') + ' | Pickup: ' + (load.pickup_date || 'TBD') + '\n\nScoring criteria (in order of importance):\n1. Driver is EMPTY/AVAILABLE (status = available)\n2. Driver is CLOSEST to the pickup location\n3. Driver has highest ON-TIME delivery percentage\n4. Driver has done this specific route before\n\nAvailable drivers:\n' + driverSummaries + '\n\nRespond in this exact format:\nSUGGESTED: [Driver Name]\nREASON: [One clear sentence explaining why, mentioning the key factors]';

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const aiResponse = await anthropic.messages.create({
      model: 'deepseek-v4-flash',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = aiResponse.content[0]?.text || '';
    const suggestedMatch = text.match(/SUGGESTED:\s*(.+)/);
    const reasonMatch = text.match(/REASON:\s*(.+)/);
    const suggestedName = suggestedMatch?.[1]?.trim();
    const reason = reasonMatch?.[1]?.trim() || 'Based on availability, proximity, and performance.';
    const suggestedDriver = drivers.find(d => d.name.toLowerCase() === suggestedName?.toLowerCase())
      || drivers.find(d => suggestedName && d.name.toLowerCase().includes(suggestedName.toLowerCase()));

    res.json({ suggestion: suggestedDriver || null, suggested_name: suggestedName, reason });
  } catch (err) {
    console.error('[SUGGEST-DRIVER] Error:', err.message);
    res.status(500).json({ error: 'Driver suggestion failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// DVIR routes
// ---------------------------------------------------------------------------
registerDriverAuthRoutes(app, pool, JWT_SECRET, JWT_EXPIRES_IN);
registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware);
registerDemoRoutes(app, pool);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
runMigrations().then(async () => {
  // One-time: reset kevin@go4fc.com demo password
  const demoHash = 'eb42ddeda21c7dc91dd53d95081cbf36dbe6227dcd2ac186e063b5b899629a5b';
  try {
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = 'kevin@go4fc.com' AND password_hash != $1", [demoHash]);
    console.log('[SETUP] Demo account password reset (if needed)');
  } catch {}

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HaulFlow] API server running on port ${PORT}`);
  });

  // Register Twilio Conversational Voice (Kristy)
  registerTwilioStreamRoutes(app, server);
});
// deploy trigger
// v2 deploy trigger Mon Jun 22 23:08:23 UTC 2026
