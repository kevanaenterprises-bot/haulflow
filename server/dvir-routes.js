// server/dvir-routes.js
// DVIR Photo Retention & Alerting + Pre-Trip Inspection — Express route handlers
// Usage: import { registerDvirRoutes } from './dvir-routes.js';
// registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware);

const RETENTION_DAYS = 7;

export function registerDvirRoutes(app, pool, authMiddleware, driverAuthMiddleware) {

  // ─────────────────────────────────────────────────────────────────────────
  // DRIVER: Submit a full pre-trip inspection
  // POST /api/driver/dvir/submit
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/driver/dvir/submit', driverAuthMiddleware, async (req, res) => {
        try {
                const { truck_unit, items } = req.body;
                const driverId = req.driver.driver_id;
                const companyId = req.driver.company_id;
                const driverName = req.driver.name || 'Unknown Driver';

          if (!items || !Array.isArray(items) || items.length === 0) {
                    return res.status(400).json({ error: 'items array is required' });
          }

          const hasDefects = items.some(item => item.status === 'fail');
                const overallStatus = hasDefects ? 'fail' : 'pass';

          const result = await pool.query(
                    `INSERT INTO dvir_inspections
                              (company_id, driver_id, driver_name, truck_unit, items, has_defects, overall_status, submitted_at)
                                       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                                                RETURNING *`,
                    [companyId, driverId, driverName, truck_unit || null, JSON.stringify(items), hasDefects, overallStatus]
                  );

          const inspection = result.rows[0];

          // If any defects found, protect photos and alert
          if (hasDefects) {
                    const defectItems = items.filter(i => i.status === 'fail');
                    for (const item of defectItems) {
                                if (item.photo_url) {
                                              await pool.query(
                                                              `UPDATE dvir_photos SET is_protected = true, status = 'defective'
                                                                             WHERE url = $1 AND company_id = $2`,
                                                              [item.photo_url, companyId]
                                                            ).catch(() => {});
                                }
                    }

                  // Trigger shop alert email if configured
                  triggerDefectAlert(pool, inspection, companyId, truck_unit, driverName).catch(
                              err => console.error('[DVIR] Defect alert failed:', err.message)
                            );
          }

          res.status(201).json({ success: true, inspection });
        } catch (err) {
                console.error('[DVIR] Submit error:', err.message);
                res.status(500).json({ error: 'Inspection submit failed', details: err.message });
        }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DRIVER: Check if driver already submitted an inspection today
  // GET /api/driver/dvir/today
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/driver/dvir/today', driverAuthMiddleware, async (req, res) => {
        try {
                const driverId = req.driver.driver_id;
                const companyId = req.driver.company_id;

          const result = await pool.query(
                    `SELECT id, submitted_at, overall_status, has_defects, truck_unit
                             FROM dvir_inspections
                                      WHERE driver_id = $1
                                                 AND company_id = $2
                                                            AND submitted_at >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 hours'
                                                                     ORDER BY submitted_at DESC
                                                                              LIMIT 1`,
                    [driverId, companyId]
                  );

          res.json({ inspection: result.rows[0] || null });
        } catch (err) {
                console.error('[DVIR] Today check error:', err.message);
                res.status(500).json({ error: 'Failed to check today inspection', details: err.message });
        }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Get all inspections (with optional defects-only filter)
  // GET /api/dvir/inspections?defects_only=true&limit=50&offset=0
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/dvir/inspections', authMiddleware, async (req, res) => {
        try {
                const companyId = req.user.company_id;
                const defectsOnly = req.query.defects_only === 'true';
                const limit = parseInt(req.query.limit) || 50;
                const offset = parseInt(req.query.offset) || 0;

          const whereClause = defectsOnly
                  ? 'WHERE i.company_id = $1 AND i.has_defects = true'
                    : 'WHERE i.company_id = $1';

          const result = await pool.query(
                    `SELECT
                               i.id,
                                          i.driver_name,
                                                     i.truck_unit,
                                                                i.submitted_at,
                                                                           i.overall_status,
                                                                                      i.has_defects,
                                                                                                 i.items,
                                                                                                            d.name AS driver_full_name
                                                                                                                     FROM dvir_inspections i
                                                                                                                              LEFT JOIN drivers d ON d.id = i.driver_id
                                                                                                                                       ${whereClause}
                                                                                                                                                ORDER BY i.submitted_at DESC
                                                                                                                                                         LIMIT $2 OFFSET $3`,
                    [companyId, limit, offset]
                  );

          const countResult = await pool.query(
                    `SELECT COUNT(*) FROM dvir_inspections i ${whereClause}`,
                    [companyId]
                  );

          res.json({
                    inspections: result.rows,
                    total: parseInt(countResult.rows[0].count),
                    limit,
                    offset,
          });
        } catch (err) {
                console.error('[DVIR] Fetch inspections error:', err.message);
                res.status(500).json({ error: 'Failed to fetch inspections', details: err.message });
        }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Get a single inspection by ID
  // GET /api/dvir/inspections/:id
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/dvir/inspections/:id', authMiddleware, async (req, res) => {
        try {
                const result = await pool.query(
                          `SELECT i.*, d.name AS driver_full_name
                                   FROM dvir_inspections i
                                            LEFT JOIN drivers d ON d.id = i.driver_id
                                                     WHERE i.id = $1 AND i.company_id = $2`,
                          [req.params.id, req.user.company_id]
                        );
                if (!result.rows[0]) return res.status(404).json({ error: 'Inspection not found' });
                res.json(result.rows[0]);
        } catch (err) {
                console.error('[DVIR] Fetch inspection error:', err.message);
                res.status(500).json({ error: 'Failed to fetch inspection', details: err.message });
        }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EXISTING: Upload a DVIR photo
  // POST /api/dvir/upload
  // ─────────────────────────────────────────────────────────────────────────
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
                const isDefect = (status === 'defective') || (notes && notes.toLowerCase().includes('repair needed'));

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

  // ─────────────────────────────────────────────────────────────────────────
  // EXISTING: Defect alert
  // POST /api/dvir/defect-alert
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/dvir/defect-alert', driverAuthMiddleware, async (req, res) => {
        try {
                const { photo_id, truck_id, inspection_point, notes, photo_url } = req.body;
                const companyId = req.driver.company_id;
                const driverName = req.driver.name;

          if (!truck_id) return res.status(400).json({ error: 'truck_id is required' });

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

          if (!companyResult.rows[0]) return res.status(404).json({ error: 'Company not found' });
                const company = companyResult.rows[0];
                if (!company.shop_alert_email) {
                          return res.status(422).json({
                                      error: 'No shop alert email configured',
                                      message: 'Set shop_alert_email in company profile (Onboarding Step 4).',
                          });
                }

          console.log(`[DVIR DEFECT ALERT] Truck: ${truck_id} | To: ${company.shop_alert_email}`);
                res.json({ success: true, message: `Defect alert sent to ${company.shop_alert_email}`, truck_id });
        } catch (err) {
                console.error('[DVIR] Defect alert error:', err.message);
                res.status(500).json({ error: 'Alert failed', details: err.message });
        }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EXISTING: Auto-delete expired photos
  // POST /api/dvir/auto-delete
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/dvir/auto-delete', authMiddleware, async (req, res) => {
        try {
                const now = new Date().toISOString();
                const result = await pool.query(
                          `DELETE FROM dvir_photos WHERE is_protected = false AND delete_at < $1 RETURNING id, storage_path`,
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: fire defect alert email
// ─────────────────────────────────────────────────────────────────────────────
async function triggerDefectAlert(pool, record, companyId, truckId, driverName) {
    const companyResult = await pool.query(
          `SELECT name, shop_alert_email FROM companies WHERE id = $1`,
          [companyId]
        );
    const company = companyResult.rows[0];
    if (!company?.shop_alert_email) return;
    console.log(`[DVIR DEFECT ALERT] Truck: ${truckId} | Driver: ${driverName} | To: ${company.shop_alert_email}`);
    // Email sending integration point — plug in SendGrid/SES here
}
