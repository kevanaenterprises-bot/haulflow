// server/demo-routes.js
// HaulFlow live demo — creates a self-contained, seeded demo company per visitor
// Usage: import { registerDemoRoutes } from './demo-routes.js';
//        registerDemoRoutes(app, pool);

import crypto from 'crypto';

const STAGES = [
  'WAITING_DISPATCH',   // Waiting on Dispatch
  'DISPATCHED',         // Dispatched
  'IN_TRANSIT',         // In Transit
  'WAITING_INVOICING',  // Waiting on Invoice
  'INVOICED',           // Waiting on Payment
  'PAID',               // done
];

const DEMO_TTL_HOURS = 24;

const SAMPLE_DRIVERS = [
  { name: 'Marcus Webb',  phone: '4692001011' },
  { name: 'Tanya Ruiz',   phone: '4692001012' },
  { name: 'Dale Hopkins', phone: '4692001013' },
  { name: 'Priya Nadeau', phone: '4692001014' },
];

const SAMPLE_CUSTOMERS = [
  { company_name: 'Lone Star Produce Co.', contact_name: 'Bill Avery',  email: 'ap@lonestarproduce.com', city: 'Dallas',      state: 'TX' },
  { company_name: 'Gulf Coast Steel',      contact_name: 'Rosa Mendez', email: 'billing@gcsteel.com',    city: 'Houston',     state: 'TX' },
  { company_name: 'Midwest Cold Storage',  contact_name: 'Ken Fowler',  email: 'pay@midwestcold.com',    city: 'Kansas City', state: 'MO' },
];

const LANES = [
  ['Dallas', 'TX', 'Oklahoma City', 'OK', 207, 850,  'Produce'],
  ['Houston', 'TX', 'New Orleans', 'LA', 348, 1200, 'Steel coils'],
  ['Fort Worth', 'TX', 'Memphis', 'TN', 452, 1450, 'Frozen goods'],
  ['San Antonio', 'TX', 'Phoenix', 'AZ', 854, 2350, 'Dry van — general'],
  ['Laredo', 'TX', 'Dallas', 'TX', 437, 1100, 'Auto parts'],
  ['Amarillo', 'TX', 'Denver', 'CO', 424, 1300, 'Beef — reefer'],
  ['El Paso', 'TX', 'Tucson', 'AZ', 318, 990,  'Electronics'],
  ['Austin', 'TX', 'Little Rock', 'AR', 502, 1550, 'Building materials'],
  ['Lubbock', 'TX', 'Wichita', 'KS', 372, 1080, 'Cotton'],
  ['Corpus Christi', 'TX', 'Baton Rouge', 'LA', 437, 1250, 'Chemicals — tanker'],
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function registerDemoRoutes(app, pool) {

  app.post('/api/demo/start', async (req, res) => {
    const client = await pool.connect();
    try {
      const { company, name } = req.body || {};
      const stamp = Date.now();
      const demoEmail = `demo+${stamp}@haulflow.app`;
      const expiresAt = new Date(Date.now() + DEMO_TTL_HOURS * 3600 * 1000).toISOString();

      await client.query('BEGIN');

      const companyRes = await client.query(
        `INSERT INTO companies (name, email, phone, city, state, invoice_prefix, invoice_counter, is_demo, demo_expires_at, subscription_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7, true, $8, 'demo')
         RETURNING id, name`,
        [company ? `${company} (Demo)` : 'HaulFlow Demo Co.', demoEmail, '4695550100', 'Melissa', 'TX', 'DEMO', 1000, expiresAt]
      );
      const companyId = companyRes.rows[0].id;

      const demoPasswordHash = crypto.createHash('sha256').update('demo').digest('hex');
      const userRes = await client.query(
        `INSERT INTO users (company_id, email, password_hash, name, role, is_active)
         VALUES ($1,$2,$3,$4,'admin', true)
         RETURNING id, email, name, role, company_id`,
        [companyId, demoEmail, demoPasswordHash, name || 'Demo Dispatcher']
      );
      const user = userRes.rows[0];

      const driverIds = [];
      for (const d of SAMPLE_DRIVERS) {
        const r = await client.query(
          `INSERT INTO drivers (company_id, name, phone, status) VALUES ($1,$2,$3,'available') RETURNING id`,
          [companyId, d.name, d.phone]
        );
        driverIds.push(r.rows[0].id);
      }

      const customerIds = [];
      for (const c of SAMPLE_CUSTOMERS) {
        const r = await client.query(
          `INSERT INTO customers (company_id, company_name, contact_name, email, city, state)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [companyId, c.company_name, c.contact_name, c.email, c.city, c.state]
        );
        customerIds.push(r.rows[0].id);
      }

      const seedPlan = [
        'WAITING_DISPATCH', 'WAITING_DISPATCH', 'WAITING_DISPATCH',
        'DISPATCHED', 'DISPATCHED',
        'IN_TRANSIT', 'IN_TRANSIT', 'IN_TRANSIT',
        'WAITING_INVOICING',
        'INVOICED',
      ];

      let loadSeq = 1000;
      for (const status of seedPlan) {
        const [oCity, oState, dCity, dState, miles, rate, commodity] = pick(LANES);
        loadSeq += 1;
        const assignDriver = status === 'WAITING_DISPATCH' ? null : pick(driverIds);
        await client.query(
          `INSERT INTO loads
            (company_id, load_number, driver_id, customer_id, origin_city, origin_state,
             dest_city, dest_state, pickup_date, delivery_date, rate, miles, status, commodity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [companyId, `L-${loadSeq}`, assignDriver, pick(customerIds),
           oCity, oState, dCity, dState, daysFromNow(-1), daysFromNow(2), rate, miles, status, commodity]
        );
      }

      await client.query('COMMIT');

      const payload = {
        user_id: user.id, company_id: user.company_id,
        email: user.email, role: user.role, is_demo: true,
      };
      const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;

      res.json({
        token,
        user: {
          id: user.id, email: user.email, name: user.name, role: user.role,
          company_id: user.company_id, company_name: companyRes.rows[0].name, is_demo: true,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DEMO] start error:', err.message);
      res.status(500).json({ error: 'Failed to start demo', details: err.message });
    } finally {
      client.release();
    }
  });

  app.post('/api/demo/advance', async (req, res) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64').toString());
      if (!decoded.is_demo) return res.status(403).json({ error: 'Not a demo account' });
      const companyId = decoded.company_id;
      const actions = [];

      const advanceable = await pool.query(
        `SELECT id, status, load_number FROM loads
         WHERE company_id = $1 AND status <> 'PAID' ORDER BY random() LIMIT 1`,
        [companyId]
      );
      if (advanceable.rows[0]) {
        const { id, status, load_number } = advanceable.rows[0];
        const idx = STAGES.indexOf(status);
        const next = idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : STAGES[0];
        await pool.query('UPDATE loads SET status = $1 WHERE id = $2 AND company_id = $3', [next, id, companyId]);
        actions.push({ type: 'advance', load_number, from: status, to: next });
      }

      if (Math.random() < 0.33) {
        const [oCity, oState, dCity, dState, miles, rate, commodity] = pick(LANES);
        const num = `L-${1000 + Math.floor(Math.random() * 9000)}`;
        const cust = await pool.query('SELECT id FROM customers WHERE company_id = $1 ORDER BY random() LIMIT 1', [companyId]);
        await pool.query(
          `INSERT INTO loads
            (company_id, load_number, customer_id, origin_city, origin_state,
             dest_city, dest_state, pickup_date, delivery_date, rate, miles, status, commodity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'WAITING_DISPATCH',$12)`,
          [companyId, num, cust.rows[0]?.id || null, oCity, oState, dCity, dState,
           daysFromNow(0), daysFromNow(3), rate, miles, commodity]
        );
        actions.push({ type: 'create', load_number: num });
      }

      res.json({ ok: true, actions });
    } catch (err) {
      console.error('[DEMO] advance error:', err.message);
      res.status(500).json({ error: 'Advance failed', details: err.message });
    }
  });
}
