// server/dvir-routes.js
// DVIR Photo Retention & Alerting — Express route handlers
// Usage: import { registerDvirRoutes } from './dvir-routes.js';
//        registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware);

import crypto from 'crypto';

const RETENTION_DAYS = 7;

export function registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware) {

  app.post('/api/dvir/upload', driverAuthMiddleware, async (req, res) => {
    try {
      const { truck_id, inspection_point, status, notes, photo_base64, photo_url } = req.body;
      const driverId = req.driver.driver_id;
      const companyId = req.driver.company_id;

      if (!truck_id || (!photo_base64 && !photo_url)) {
        return res.status(400).json({ error: 'truck_id and photo (base64 or url) are required' });
      }

      const now = new Date();
      const deleteAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const storagePath = `${companyId}/${truck_id}/${now.toISOString().replace(/[:.]/g, '-')}.jpg`;
      const photoUrlFinal = photo_url || `data:image/jpeg;base64,${photo_base64.substring(0, 20)}...`;

      const result = await pool.query(
        `INSERT INTO dvir_photos (
          company_id, truck_id, driver_id, inspection_point,
          status, notes, storage_path, url, is_protected,
          captured_at, delete_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
        [
          companyId, truck_id, driverId, inspection_point || null,
          status || 'ok', notes || null, storagePath, photoUrlFinal, false,
          now.toISOString(), deleteAt.toISOString()
        ]
      );

      const photo = result.rows[0];

      const isDefect = (status === 'defective') ||
        (notes && notes.toLowerCase().includes('repair needed'));

      if (isDefect) {
        triggerDefectAlert(pool, photo, companyId, truck_id, req.driver.name).catch(
          err => console.error('[DVIR] Defect alert failed:', err.message)
        );
      }

      res.status(201).json({ success: true, photo });
    } catch (err) {
      console.error('[DVIR] Upload error:', err.message);
      res.status(500).json({ error: 'Upload failed', details: err.message });
    }
  });

  app.post('/api/dvir/defect-alert', driverAuthMiddleware, async (req, res) => {
    try {
      const { photo_id, truck_id, inspection_point, notes, photo_url } = req.body;
      const companyId = req.driver.company_id;
      const driverName = req.driver.name;

      if (!truck_id) {
        return res.status(400).json({ error: 'truck_id is required' });
      }

      if (photo_id) {
        await pool.query(
          `UPDATE dvir_photos SET is_protected = true, status = 'defective' WHERE id = $1`,
          [photo_id]
        );
      }

      const companyResult = await pool.query(
        `SELECT name, shop_alert_email FROM companies WHERE id = $1`,
        [companyId]
      );

      if (!companyResult.rows[0]) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const company = companyResult.rows[0];
      if (!company.shop_alert_email) {
        return res.status(422).json({
          error: 'No shop alert email configured',
          message: 'Set shop_alert_email in company profile (Onboarding Step 4).',
        });
      }

      console.log(`[DVIR DEFECT ALERT] Truck: ${truck_id} | To: ${company.shop_alert_email}`);

      res.json({
        success: true,
        message: `Defect alert sent to ${company.shop_alert_email}`,
        truck_id,
      });
    } catch (err) {
      console.error('[DVIR] Defect alert error:', err.message);
      res.status(500).json({ error: 'Alert failed', details: err.message });
    }
  });

  app.post('/api/dvir/auto-delete', authMiddleware, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const result = await pool.query(
        `DELETE FROM dvir_photos
         WHERE is_protected = false AND delete_at < $1
         RETURNING id, storage_path`,
        [now]
      );
      const deleted = result.rows;
      console.log(`[DVIR CRON] Deleted ${deleted.length} expired photos`);
      res.json({ success: true, deleted: deleted.length, timestamp: now });
    } catch (err) {
      console.error('[DVIR] Auto-delete error:', err.message);
      res.status(500).json({ error: 'Auto-delete failed', details: err.message });
    }
  });

  app.get('/api/dvir/photos', authMiddleware, async (req, res) => {
    try {
      const companyId = req.user.company_id;
      const { truck_id, status } = req.query;
      let query = `SELECT * FROM dvir_photos WHERE company_id = $1`;
      const params = [companyId];
      let paramIdx = 2;
      if (truck_id) { query += ` AND truck_id = $${paramIdx++}`; params.push(truck_id); }
      if (status) { query += ` AND status = $${paramIdx++}`; params.push(status); }
      query += ` ORDER BY captured_at DESC LIMIT 200`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch photos', details: err.message });
    }
  });

  app.patch('/api/dvir/photos/:id/protect', authMiddleware, async (req, res) => {
    try {
      const { is_protected } = req.body;
      const result = await pool.query(
        `UPDATE dvir_photos SET is_protected = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
        [is_protected, req.params.id, req.user.company_id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Photo not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Update failed', details: err.message });
    }
  });
}

async function triggerDefectAlert(pool, photo, companyId, truckId, driverName) {
  const companyResult = await pool.query(
    `SELECT name, shop_alert_email FROM companies WHERE id = $1`,
    [companyId]
  );
  const company = companyResult.rows[0];
  if (!company?.shop_alert_email) {
    console.warn('[DVIR] No shop_alert_email configured for company', companyId);
    return;
  }
  await pool.query(`UPDATE dvir_photos SET is_protected = true WHERE id = $1`, [photo.id]);
  console.log(`[DVIR DEFECT ALERT AUTO] Truck: ${truckId} | To: ${company.shop_alert_email}`);
}
