// server/index.js — HaulFlow API Server
// Express backend for HaulFlow TMS (Transportation Management System)

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import { registerDvirRoutes } from './dvir-routes.js';
import { registerDemoRoutes } from './demo-routes.js';
import { registerDriverAuthRoutes } from './driver-auth-routes.js';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3001;

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
// Middleware
// ---------------------------------------------------------------------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

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
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function driverAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    req.driver = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid driver token' });
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
app.post('/api/auth/login', async (req, res) => {
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
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
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

app.post('/api/auth/driver-login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Phone and PIN are required' });
    }
    const result = await pool.query(
      `SELECT d.*, c.name AS company_name
       FROM drivers d
       JOIN companies c ON c.id = d.company_id
       WHERE d.phone = $1 AND d.status != 'terminated'`,
      [phone.replace(/\D/g, '')]
    );
    const driver = result.rows[0];
    if (!driver) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const payload = {
      driver_id: driver.id,
      company_id: driver.company_id,
      name: driver.name,
      phone: driver.phone,
    };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
    res.json({ token, driver: { ...payload, company_name: driver.company_name } });
  } catch (err) {
    console.error('[AUTH] Driver login error:', err.message);
    res.status(500).json({ error: 'Driver login failed' });
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

// -- Customers --
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE company_id = $1 ORDER BY name',
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
      `INSERT INTO customers (company_id, name, email, phone, billing_address, city, state, zip, payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, b.name, b.email, b.phone, b.billing_address, b.city, b.state, b.zip, b.payment_terms || 30]
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
      `INSERT INTO shippers (company_id, name, address, city, state, zip, contact_name, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.company_id, b.name, b.address, b.city, b.state, b.zip, b.contact_name, b.phone, b.email]
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
      `SELECT i.*, c.name AS customer_name, l.load_number
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
      `INSERT INTO trucks (company_id, unit_number, asset_type, make, model, year, vin, license_plate, state_registered, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.company_id, b.unit_number, b.asset_type || 'tractor', b.make, b.model, b.year, b.vin, b.license_plate, b.state_registered, b.status || 'active']
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
app.post('/api/onboard', async (req, res) => {
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
          const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;

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
// DVIR routes
// ---------------------------------------------------------------------------
registerDriverAuthRoutes(app, pool);
registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware);
registerDemoRoutes(app, pool);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HaulFlow] API server running on port ${PORT}`);
});
