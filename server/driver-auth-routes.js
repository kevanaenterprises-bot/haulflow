import crypto from 'crypto';

/**
 * registerDriverAuthRoutes — registers driver login routes
  * Must be imported and called in index.js BEFORE the old driver-login route.
   * Supports login by phone number + password (SHA-256 hashed).
    * Falls back gracefully if password_hash column does not exist (no-password legacy mode).
     */
export function registerDriverAuthRoutes(app, pool) {
    // POST /api/auth/driver-login  (used by DriverLoginPage.tsx)
    // POST /api/driver/login       (alias — old path kept for compatibility)
    const handler = async (req, res) => {
          try {
                  const { phone, password } = req.body || {};
                  if (!phone) {
                            return res.status(400).json({ error: 'Phone number is required' });
                  }

                  const cleanPhone = phone.replace(/\D/g, '');

                  const result = await pool.query(
                            `SELECT d.*, c.name AS company_name
                             FROM drivers d
                             JOIN companies c ON c.id = d.company_id
                             WHERE (d.phone = $1 OR d.phone = $2)
                               AND d.status != 'terminated'`,
                            [cleanPhone, phone.trim()]
                          );

                  const driver = result.rows[0];
                  if (!driver) {
                            return res.status(401).json({ error: 'Invalid credentials' });
                  }

                  // If driver has a password_hash set, validate it
                  if (driver.password_hash) {
                            if (!password) {
                                        return res.status(401).json({ error: 'Password is required' });
                            }
                            const hash = crypto.createHash('sha256').update(password).digest('hex');
                            if (hash !== driver.password_hash) {
                                        return res.status(401).json({ error: 'Invalid credentials' });
                            }
                  }
                  // If no password_hash set on driver record, allow login by phone alone (legacy / first login)

                  const payload = {
                            driver_id: driver.id,
                            company_id: driver.company_id,
                            name: driver.name,
                            phone: driver.phone,
                  };
                  const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.sig`;
                  res.json({
                            token,
                            driver: {
                                        ...payload,
                                        company_name: driver.company_name,
                            },
                  });
          } catch (err) {
                  console.error('[AUTH] Driver login error:', err.message);
                  res.status(500).json({ error: 'Driver login failed' });
          }
    };

    app.post('/api/auth/driver-login', handler);
    app.post('/api/driver/login', handler);
}
