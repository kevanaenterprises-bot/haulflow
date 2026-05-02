import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PDFDocument as LibPDF } from 'pdf-lib';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

// Auto-run schema
import { readFileSync } from 'fs';
try {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[DB] Schema applied');
} catch (e) {
  console.error('[DB] Schema error:', e.message);
}

// ── JWT helpers (simple HMAC) ──
const JWT_SECRET = process.env.JWT_SECRET || 'haulflow-secret-change-in-prod';
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch { return null; }
}
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  req.user = payload;
  next();
}

// ── Health ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'haulflow-v1' }));

// ── Driver auth middleware ──
function driverAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload || !payload.driver_id) return res.status(401).json({ error: 'Invalid driver token' });
  req.driver = payload;
  next();
}

// ── Driver Portal Auth ──
app.post('/api/driver/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });
    const clean = phone.replace(/\D/g, '');
    const result = await pool.query(
      `SELECT * FROM drivers WHERE (phone = $1 OR phone = $2 OR phone = $3) AND password_hash IS NOT NULL`,
      [clean, `1${clean}`, clean.replace(/^1/, '')]
    );
    const driver = result.rows[0];
    if (!driver || driver.password_hash !== password) return res.status(401).json({ error: 'Invalid phone or password' });
    const token = signToken({ driver_id: driver.id, company_id: driver.company_id, name: driver.name });
    res.json({ token, driver });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Driver Portal: My Loads ──
app.get('/api/driver/loads', driverAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, c.company_name as customer_name
       FROM loads l LEFT JOIN customers c ON c.id = l.customer_id
       WHERE l.driver_id = $1 AND l.status NOT IN ('PAID')
       ORDER BY l.pickup_date ASC NULLS LAST, l.created_at DESC`,
      [req.driver.driver_id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Driver Portal: Update Load Status ──
app.patch('/api/driver/loads/:id/status', driverAuthMiddleware, async (req, res) => {
  try {
    const { status, pod_url } = req.body;
    const allowed = ['IN_TRANSIT', 'DELIVERED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updates = { status };
    if (status === 'DELIVERED') updates.delivered_at = new Date().toISOString();
    if (pod_url) updates.pod_url = pod_url;
    const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`).join(', ');
    const result = await pool.query(
      `UPDATE loads SET ${sets} WHERE id = $1 AND driver_id = $2 RETURNING *`,
      [req.params.id, req.driver.driver_id, ...Object.values(updates)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Load not found' });
    // On delivery: check auto_invoicing setting
    if (status === 'DELIVERED') {
      const load = result.rows[0];
      const company = await pool.query('SELECT * FROM companies WHERE id = $1', [load.company_id]);
      const comp = company.rows[0];
      if (comp.auto_invoicing !== false) {
        // Auto mode: create invoice + move to INVOICED
        const invNum = `${comp.invoice_prefix}-${comp.invoice_counter}`;
        await pool.query('UPDATE companies SET invoice_counter = invoice_counter + 1 WHERE id = $1', [load.company_id]);
        const total = (load.rate || 0) + (load.fuel_surcharge || 0) + (load.extra_stop_fee || 0) + (load.lumper_fee || 0);
        await pool.query(
          'INSERT INTO invoices (company_id, load_id, invoice_number, amount) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [load.company_id, load.id, invNum, total]
        );
        await pool.query(`UPDATE loads SET status = 'INVOICED' WHERE id = $1`, [load.id]);
      } else {
        // Manual mode: move to WAITING_INVOICING
        await pool.query(`UPDATE loads SET status = 'WAITING_INVOICING' WHERE id = $1`, [load.id]);
      }
      // Mirror to driver Supabase
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const driverSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        await driverSupabase.from('loads').update({ status: 'DELIVERED', delivered_at: updates.delivered_at }).eq('id', load.id);
      } catch (_) {}
    }
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Auth ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await pool.query(
      'SELECT u.*, c.name as company_name, c.invoice_prefix, c.subscription_status FROM users u JOIN companies c ON c.id = u.company_id WHERE u.email = $1 AND u.is_active = true',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user || user.password_hash !== password) return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken({ id: user.id, company_id: user.company_id, role: user.role });
    res.json({
      token,
      user: { id: user.id, company_id: user.company_id, email: user.email, name: user.name, role: user.role },
      company: { id: user.company_id, name: user.company_name, invoice_prefix: user.invoice_prefix, subscription_status: user.subscription_status },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Loads ──
app.get('/api/loads', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, d.name as driver_name, d.phone as driver_phone, c.company_name as customer_name
       FROM loads l
       LEFT JOIN drivers d ON d.id = l.driver_id
       LEFT JOIN customers c ON c.id = l.customer_id
       WHERE l.company_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/loads', authMiddleware, async (req, res) => {
  try {
    const { load_number, customer_id, origin_address, origin_city, origin_state, dest_address, dest_city, dest_state, pickup_date, delivery_date, rate, cargo_description, miles, fuel_surcharge } = req.body;
    if (!load_number) return res.status(400).json({ error: 'Load number required' });
    const result = await pool.query(
      `INSERT INTO loads (company_id, load_number, customer_id, origin_address, origin_city, origin_state, dest_address, dest_city, dest_state, pickup_date, delivery_date, rate, cargo_description, miles, fuel_surcharge)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.company_id, load_number, customer_id || null, origin_address, origin_city, origin_state, dest_address, dest_city, dest_state, pickup_date || null, delivery_date || null, rate || null, cargo_description || null, miles || null, fuel_surcharge || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Load number already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/loads/:id', authMiddleware, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map(f => req.body[f]);
    const result = await pool.query(
      `UPDATE loads SET ${sets} WHERE id = $1 AND company_id = $${fields.length + 2} RETURNING *`,
      [req.params.id, ...values, req.user.company_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Load not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/loads/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM loads WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Drivers ──
app.get('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers WHERE company_id = $1 ORDER BY name', [req.user.company_id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const { name, phone, email, license_number, license_expiry, medical_card_expiry, hire_date, termination_date, cdl_file_url, medical_card_file_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO drivers (company_id, name, phone, email, license_number, license_expiry, medical_card_expiry, hire_date, termination_date, cdl_file_url, medical_card_file_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.user.company_id, name, phone || null, email || null, license_number || null, license_expiry || null, medical_card_expiry || null, hire_date || null, termination_date || null, cdl_file_url || null, medical_card_file_url || null]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE drivers SET ${sets} WHERE id = $1 AND company_id = $${fields.length + 2} RETURNING *`,
      [req.params.id, ...fields.map(f => req.body[f]), req.user.company_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM drivers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customers ──
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE company_id = $1 ORDER BY company_name', [req.user.company_id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, address, city, state, fuel_surcharge_enabled, fuel_surcharge_per_mile } = req.body;
    if (!company_name) return res.status(400).json({ error: 'Company name required' });
    const result = await pool.query(
      'INSERT INTO customers (company_id, company_name, contact_name, email, phone, address, city, state, fuel_surcharge_enabled, fuel_surcharge_per_mile) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [req.user.company_id, company_name, contact_name || null, email || null, phone || null, address || null, city || null, state || null, fuel_surcharge_enabled || false, fuel_surcharge_per_mile || 0]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE customers SET ${sets} WHERE id = $1 AND company_id = $${fields.length + 2} RETURNING *`,
      [req.params.id, ...fields.map(f => req.body[f]), req.user.company_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Shippers & Receivers ──
app.get('/api/shippers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shippers WHERE company_id = $1 ORDER BY name', [req.user.company_id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shippers', authMiddleware, async (req, res) => {
  try {
    const { type, name, contact_name, phone, email, address, city, state, zip, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO shippers (company_id, type, name, contact_name, phone, email, address, city, state, zip, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [req.user.company_id, type || 'shipper', name, contact_name || null, phone || null, email || null, address || null, city || null, state || null, zip || null, notes || null]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/shippers/:id', authMiddleware, async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE shippers SET ${sets} WHERE id = $1 AND company_id = $${fields.length + 2} RETURNING *`,
      [req.params.id, ...fields.map(f => req.body[f]), req.user.company_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shippers/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM shippers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Employees (users management) ──
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, job_title, is_active, created_at FROM users WHERE company_id = $1 ORDER BY name',
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', authMiddleware, async (req, res) => {
  try {
    const { name, email, password, role, job_title } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
    const result = await pool.query(
      'INSERT INTO users (company_id, name, email, password_hash, role, job_title) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, job_title, is_active, created_at',
      [req.user.company_id, name, email.toLowerCase().trim(), password, role || 'admin', job_title || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    const { name, email, role, job_title, is_active, password } = req.body;
    if (password) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 AND company_id = $3', [password, req.params.id, req.user.company_id]);
    }
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role),
       job_title = COALESCE($4, job_title), is_active = COALESCE($5, is_active)
       WHERE id = $6 AND company_id = $7
       RETURNING id, name, email, role, job_title, is_active, created_at`,
      [name || null, email?.toLowerCase().trim() || null, role || null, job_title || null, is_active ?? null, req.params.id, req.user.company_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await pool.query('DELETE FROM users WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Assign driver ──
app.post('/api/loads/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { driver_id } = req.body;
    const token = crypto.randomBytes(16).toString('hex');

    // Free previous driver
    const prev = await pool.query('SELECT driver_id FROM loads WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    if (prev.rows[0]?.driver_id) {
      await pool.query('UPDATE drivers SET status = $1 WHERE id = $2', ['available', prev.rows[0].driver_id]);
    }

    const result = await pool.query(
      `UPDATE loads SET driver_id = $1, status = 'DISPATCHED', acceptance_token = $2, accepted_at = NULL WHERE id = $3 AND company_id = $4 RETURNING *`,
      [driver_id, token, req.params.id, req.user.company_id]
    );
    await pool.query('UPDATE drivers SET status = $1 WHERE id = $2', ['on_route', driver_id]);

    // Mirror to driver Supabase
    const load = result.rows[0];
    mirrorLoadToDriverSupabase(load, driver_id).catch(e => console.warn('[Mirror]', e.message));

    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Update load status (called by driver app) ──
app.post('/api/loads/:id/status', async (req, res) => {
  try {
    const { status, bol_number, extra_stop_fee, lumper_fee } = req.body;
    const allowed = ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED', 'PAID'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updates = { status };
    if (status === 'DELIVERED') updates.delivered_at = new Date().toISOString();
    if (bol_number) updates.bol_number = bol_number;
    if (extra_stop_fee != null) updates.extra_stop_fee = extra_stop_fee;
    if (lumper_fee != null) updates.lumper_fee = lumper_fee;

    const fields = Object.keys(updates);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE loads SET ${sets} WHERE id = $1`, [req.params.id, ...fields.map(f => updates[f])]);

    // Auto-create invoice on INVOICED
    if (status === 'INVOICED') {
      await createInvoiceForLoad(req.params.id);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings ──
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query('SELECT auto_invoicing FROM companies WHERE id = $1', [req.user.company_id]);
    res.json(r.rows[0] || { auto_invoicing: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { auto_invoicing } = req.body;
    const r = await pool.query(
      'UPDATE companies SET auto_invoicing = $1 WHERE id = $2 RETURNING auto_invoicing',
      [auto_invoicing, req.user.company_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Manual invoice creation for WAITING_INVOICING loads ──
app.post('/api/loads/:id/invoice', authMiddleware, async (req, res) => {
  try {
    const lr = await pool.query('SELECT * FROM loads WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    const load = lr.rows[0];
    if (!load) return res.status(404).json({ error: 'Load not found' });
    if (load.status !== 'WAITING_INVOICING') return res.status(400).json({ error: 'Load is not waiting on invoicing' });
    const cr = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    const comp = cr.rows[0];
    const invNum = `${comp.invoice_prefix}-${comp.invoice_counter}`;
    await pool.query('UPDATE companies SET invoice_counter = invoice_counter + 1 WHERE id = $1', [req.user.company_id]);
    const total = (load.rate || 0) + (load.fuel_surcharge || 0) + (load.extra_stop_fee || 0) + (load.lumper_fee || 0);
    await pool.query(
      'INSERT INTO invoices (company_id, load_id, invoice_number, amount) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [req.user.company_id, load.id, invNum, total]
    );
    await pool.query(`UPDATE loads SET status = 'INVOICED' WHERE id = $1`, [load.id]);
    res.json({ success: true, invoice_number: invNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Invoices ──
app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, l.load_number, l.origin_city, l.origin_state, l.dest_city, l.dest_state,
              l.rate as load_rate, l.miles, l.fuel_surcharge, l.extra_stop_fee, l.lumper_fee,
              c.company_name as customer_name
       FROM invoices i JOIN loads l ON l.id = i.load_id LEFT JOIN customers c ON c.id = l.customer_id
       WHERE i.company_id = $1 ORDER BY i.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/invoices/:id/pay', authMiddleware, async (req, res) => {
  try {
    const { payment_method } = req.body;
    const result = await pool.query(
      `UPDATE invoices SET status = 'PAID', paid_at = NOW(), payment_method = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
      [payment_method || 'check', req.params.id, req.user.company_id]
    );
    // Mark load as PAID too
    if (result.rows[0]) {
      await pool.query(`UPDATE loads SET status = 'PAID' WHERE id = $1`, [result.rows[0].load_id]);
    }
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Send invoice email ──
app.post('/api/invoices/:id/send', authMiddleware, async (req, res) => {
  try {
    const invRes = await pool.query(
      `SELECT i.*, l.*, c.company_name as customer_company, c.email as customer_email
       FROM invoices i JOIN loads l ON l.id = i.load_id LEFT JOIN customers c ON c.id = l.customer_id
       WHERE i.id = $1 AND i.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!invRes.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRes.rows[0];
    if (!inv.customer_email) return res.status(400).json({ error: 'Customer has no email configured' });

    const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    const comp = compRes.rows[0];

    // Fetch POD images from driver Supabase
    const podImageBuffers = await fetchPodImages(inv.load_id);

    const pdfBuffer = await buildInvoicePDF({ inv, comp, podImageBuffers });

    await sendEmail({
      to: inv.customer_email,
      subject: `Invoice ${inv.invoice_number} — Load #${inv.load_number}`,
      html: `<p>Dear ${inv.customer_company || 'Valued Customer'},</p><p>Please find attached your invoice for Load <strong>#${inv.load_number}</strong>. The attachment includes the invoice and all proof of delivery documents.</p><p>Payment due within ${comp?.payment_terms || 30} days. Thank you for your business.</p>`,
      attachments: [{ filename: `Invoice_${inv.invoice_number}.pdf`, content: pdfBuffer }],
    });

    res.json({ success: true, message: `Invoice sent to ${inv.customer_email}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Onboarding (public) ──
app.post('/api/onboard', async (req, res) => {
  try {
    const { company_name, company_email, company_phone, admin_email, admin_name, password } = req.body;
    const email = admin_email;
    const name = admin_name;
    const phone = company_phone;
    if (!company_name || !email || !password || !name) return res.status(400).json({ error: 'Missing required fields' });

    const comp = await pool.query(
      'INSERT INTO companies (name, email, phone, address, city, state) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [company_name, company_email || email, phone || null, null, null, null]
    );
    const user = await pool.query(
      'INSERT INTO users (company_id, email, password_hash, name, role) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [comp.rows[0].id, email.toLowerCase().trim(), password, name, 'admin']
    );
    const token = signToken({ id: user.rows[0].id, company_id: comp.rows[0].id, role: 'admin' });
    res.json({ token, user: user.rows[0], company: comp.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

// ── Helpers ──
const DRIVER_SUPABASE_URL = 'https://qekevyqhwxqyypmhjobd.supabase.co';
const DRIVER_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFla2V2eXFod3hxeXlwbWhqb2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTUwNDEsImV4cCI6MjA4NjU5MTA0MX0.YXbIJG5F1nSB9obbuLkhINPcPyznCc4VpZhWuP70_BE';
const driverHeaders = { apikey: DRIVER_SUPABASE_KEY, Authorization: `Bearer ${DRIVER_SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function mirrorLoadToDriverSupabase(load, railwayDriverId) {
  // Look up driver in driver Supabase by matching phone
  const driverRes = await pool.query('SELECT phone FROM drivers WHERE id = $1', [railwayDriverId]);
  const phone = driverRes.rows[0]?.phone?.replace(/\D/g, '');
  if (!phone) return;

  const dsRes = await fetch(`${DRIVER_SUPABASE_URL}/rest/v1/drivers?select=id,phone&or=(phone.eq.${phone},phone.eq.1${phone})`, { headers: driverHeaders });
  const dsDrivers = dsRes.ok ? await dsRes.json() : [];
  const preferred = dsDrivers.find(d => d.phone === `1${phone}`) || dsDrivers[0];
  const driverSupabaseId = preferred?.id || railwayDriverId;

  await fetch(`${DRIVER_SUPABASE_URL}/rest/v1/loads`, {
    method: 'POST',
    headers: { ...driverHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: load.id,
      load_number: load.load_number,
      driver_id: driverSupabaseId,
      status: 'DISPATCHED',
      origin_city: load.origin_city,
      origin_state: load.origin_state,
      dest_city: load.dest_city,
      dest_state: load.dest_state,
      rate: load.rate,
      pickup_date: load.pickup_date,
      delivery_date: load.delivery_date,
      customer_id: null,
      acceptance_token: load.acceptance_token,
    }),
  });
}

async function fetchPodImages(loadId) {
  const buffers = [];
  try {
    const r = await fetch(`${DRIVER_SUPABASE_URL}/rest/v1/pod_documents?load_id=eq.${loadId}&select=file_url`, { headers: driverHeaders });
    if (!r.ok) return buffers;
    const pods = await r.json();
    for (const pod of pods) {
      try {
        const imgRes = await fetch(pod.file_url);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length > 0) buffers.push(buf);
        }
      } catch {}
    }
  } catch {}
  return buffers;
}

async function createInvoiceForLoad(loadId) {
  const loadRes = await pool.query('SELECT * FROM loads WHERE id = $1', [loadId]);
  const load = loadRes.rows[0];
  if (!load) return;
  const compRes = await pool.query('SELECT * FROM companies WHERE id = $1', [load.company_id]);
  const comp = compRes.rows[0];
  const prefix = comp?.invoice_prefix || 'INV';
  const counter = comp?.invoice_counter || 1000;
  const invoiceNumber = `${prefix}${counter + 1}`;
  const total = (parseFloat(load.rate) || 0) + (parseFloat(load.extra_stop_fee) || 0) + (parseFloat(load.lumper_fee) || 0);
  await pool.query(
    'INSERT INTO invoices (company_id, load_id, invoice_number, amount) VALUES ($1,$2,$3,$4)',
    [load.company_id, loadId, invoiceNumber, total]
  );
  await pool.query('UPDATE companies SET invoice_counter = invoice_counter + 1 WHERE id = $1', [load.company_id]);
}

async function buildInvoicePDF({ inv, comp, podImageBuffers }) {
  return new Promise(async (resolve, reject) => {
    try {
      const BLUE = '#2D5BA0';
      const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', async () => {
        try {
          const invoicePdfBytes = Buffer.concat(chunks);
          if (!podImageBuffers.length) return resolve(invoicePdfBytes);
          const merged = await LibPDF.create();
          const invoiceDoc = await LibPDF.load(invoicePdfBytes);
          for (let i = 0; i < invoiceDoc.getPageCount(); i++) {
            const [p] = await merged.copyPages(invoiceDoc, [i]);
            merged.addPage(p);
          }
          for (const imgBuf of podImageBuffers) {
            try {
              let img;
              try { img = await merged.embedJpg(imgBuf); } catch { img = await merged.embedPng(imgBuf); }
              const { width, height } = img.scale(1);
              const pw = 612, ph = 792;
              const scale = Math.min(pw / width, ph / height, 1);
              const page = merged.addPage([pw, ph]);
              page.drawImage(img, { x: (pw - width * scale) / 2, y: (ph - height * scale) / 2, width: width * scale, height: height * scale });
            } catch {}
          }
          resolve(Buffer.from(await merged.save()));
        } catch (e) { reject(e); }
      });

      // Header
      doc.rect(40, 40, 532, 44).fill(BLUE);
      doc.fontSize(18).fillColor('white').font('Helvetica-Bold')
        .text(comp?.name || 'HaulFlow', 52, 52, { width: 280 });
      doc.fontSize(18).text('INVOICE', 40, 52, { width: 524, align: 'right' });

      // Meta
      doc.fillColor('black').font('Helvetica-Bold').fontSize(12).text(`Invoice #: ${inv.invoice_number}`, 40, 104);
      doc.font('Helvetica').fontSize(11).text(`Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 350, 104);
      doc.font('Helvetica').fontSize(10).fillColor('#555').text(`Load #: ${inv.load_number || ''}`, 40, 120).text(`BOL #: ${inv.bol_number || ''}`, 220, 120);

      // Bill To
      doc.moveTo(40, 142).lineTo(572, 142).strokeColor('#ddd').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('BILL TO', 40, 150);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(inv.customer_company || '—', 40, 163);
      doc.font('Helvetica').fontSize(10).fillColor('#555').text(inv.customer_email || '', 40, 177);

      // Route
      doc.moveTo(40, 200).lineTo(572, 200).strokeColor('#ddd').stroke();
      doc.font('Helvetica').fontSize(11).fillColor('black')
        .text(`Route: ${inv.origin_city || ''}, ${inv.origin_state || ''}  →  ${inv.dest_city || ''}, ${inv.dest_state || ''}`, 40, 210);

      // Line items
      doc.rect(40, 230, 532, 20).fill('#eee');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('Description', 52, 235).text('Amount', 52, 235, { width: 512, align: 'right' });
      let y = 258;
      const row = (label, amt) => {
        if (!amt) return;
        doc.font('Helvetica').fontSize(10).fillColor('black').text(label, 52, y).text(`$${parseFloat(amt).toFixed(2)}`, 52, y, { width: 512, align: 'right' });
        y += 20;
      };
      row('Freight Charge', inv.rate);
      row('Extra Stop Fee', inv.extra_stop_fee);
      row('Lumper Fee', inv.lumper_fee);

      // Total
      const total = (parseFloat(inv.rate) || 0) + (parseFloat(inv.extra_stop_fee) || 0) + (parseFloat(inv.lumper_fee) || 0);
      doc.rect(40, y + 4, 532, 24).fill(BLUE);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('white').text('TOTAL DUE', 52, y + 10).text(`$${total.toFixed(2)}`, 52, y + 10, { width: 512, align: 'right' });
      y += 50;

      // Footer
      doc.font('Helvetica').fontSize(9).fillColor('#888').text(`Payment due within ${comp?.payment_terms || 30} days. Thank you for your business!`, 40, y);
      doc.end();
    } catch (e) { reject(e); }
  });
}

async function sendEmail({ to, subject, html, attachments = [] }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@haulflow.app';
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
  const body = { from: FROM_EMAIL, to: [to], subject, html };
  if (attachments.length) {
    body.attachments = attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') }));
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend error: ${await r.text()}`);
}

// Serve frontend
app.use(express.static(join(__dirname, '../dist')));
app.get('/{*path}', (req, res) => res.sendFile(join(__dirname, '../dist/index.html')));

app.listen(PORT, () => console.log(`HaulFlow server running on port ${PORT}`));
