// server/index.js — HaulFlow API Server
// Express backend for HaulFlow TMS (Transportation Management System)

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { registerDvirRoutes } from './dvir-routes.js';
import { registerDemoRoutes } from './demo-routes.js';
import { registerDriverAuthRoutes } from './driver-auth-routes.js';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// JWT config
// ---------------------------------------------------------------------------
// JWT secret — set JWT_SECRET env var in production. Falls back to a deterministic
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
    // invoices
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2)`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS load_id UUID`,
    // companies
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS shop_alert_email VARCHAR(255)`,
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
// Company / Loads / Drivers / Customers / Shippers / Invoices CRUD
// ---------------------------------------------------------------------------

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
        pickup_date, delivery_date, rate, status, notes, weight, commodity
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        req.user.company_id, b.load_number, b.shipper_id || null, b.customer_id || null,
        b.driver_id || null, b.origin_address, b.origin_city, b.origin_state, b.origin_zip,
        b.destination_address, b.destination_city, b.destination_state, b.destination_zip,
        b.pickup_date || null, b.delivery_date || null, b.rate || 0, b.status || 'booked',
        b.notes || null, b.weight || null, b.commodity || null,
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
        b.origin_address, b.origin_city, b.origin_state, b.origin_zip,
        b.destination_address, b.destination_city, b.destination_state, b.destination_zip,
        b.pickup_date || null, b.delivery_date || null, b.rate || 0, b.status || 'booked',
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

app.post('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO drivers (company_id, name, phone, email, license_number, license_expiry, medical_card_expiry, hire_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, b.name, b.phone, b.email, b.license_number, b.license_expiry, b.medical_card_expiry, b.hire_date, b.status || 'available']
    );
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
      [req.user.company_id, b.name || b.company_name, b.contact_name, b.phone || b.contact_phone, b.email, b.billing_address || b.address, b.city, b.state]
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
      `INSERT INTO shippers (company_id, name, address, city, state, zip, contact_name, contact_phone, contact_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, b.name, b.address, b.city, b.state, b.zip, b.contact_name, b.phone || b.contact_phone, b.email || b.contact_email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create shipper', details: err.message });
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
      `SELECT l.*, s.name AS shipper_name
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
// Self-Service Onboarding — POST /api/onboard
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
                          ).catch(() => {}); // columns may not exist yet — non-fatal
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

          console.log(`[ONBOARD] New company created: ${company_name} (${company.id}) — admin: ${admin_email}`);

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
// Setup Wizard Complete — POST /api/setup/complete
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

// POST /api/create-checkout-session — creates a Stripe Checkout session
app.post('/api/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured. Please contact support.' });
    }

    const { plan } = req.body || {}; // plan: 'owner-op' | 'fleet'
    const amount = plan === 'fleet' ? 35000 : 15000; // $350 or $150 in cents
    const planLabel = plan === 'fleet' ? 'Fleet Plan' : 'Owner-Operator Plan';

    // Get company info for metadata
    const company = await pool.query('SELECT name, email FROM companies WHERE id = $1', [req.user.company_id]);
    const co = company.rows[0] || {};

    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'mode': 'subscription',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `HaulFlow TMS — ${planLabel}`,
      'line_items[0][price_data][product_data][description]': 'Full TMS platform. Cancel anytime.',
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][quantity]': '1',
      'customer_email': req.user.email,
      'metadata[company_id]': req.user.company_id,
      'metadata[user_id]': req.user.user_id,
      'subscription_data[metadata][company_id]': req.user.company_id,
      'success_url': `${process.env.PUBLIC_URL || 'https://haulflow.turtlelogisticsllc.com'}/setup`,
      'cancel_url': `${process.env.PUBLIC_URL || 'https://haulflow.turtlelogisticsllc.com'}/subscribe`,
    });

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
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[STRIPE] Checkout session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/webhook — Stripe webhook for payment events
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.warn('[STRIPE] Webhook received but no STRIPE_WEBHOOK_SECRET configured');
    return res.status(200).end();
  }

  let event;
  try {
    event = JSON.parse(req.body);
    // In production, verify with stripe.webhooks.constructEvent()
    // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[STRIPE] Webhook parse error:', err.message);
    return res.status(400).send('Webhook error');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const companyId = session.metadata?.company_id;

    if (companyId) {
      try {
        await pool.query(
          `UPDATE companies SET subscription_status = 'active' WHERE id = $1`,
          [companyId]
        );
        console.log(`[STRIPE] Subscription activated for company ${companyId}`);
      } catch (err) {
        console.error(`[STRIPE] Failed to update company ${companyId}:`, err.message);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const companyId = sub.metadata?.company_id;

    if (companyId) {
      try {
        await pool.query(
          `UPDATE companies SET subscription_status = 'cancelled' WHERE id = $1`,
          [companyId]
        );
        console.log(`[STRIPE] Subscription cancelled for company ${companyId}`);
      } catch (err) {
        console.error(`[STRIPE] Failed to cancel company ${companyId}:`, err.message);
      }
    }
  }

  res.status(200).end();
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
runMigrations().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HaulFlow] API server running on port ${PORT}`);
  });
});
