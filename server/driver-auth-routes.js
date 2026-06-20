import crypto from 'crypto';

/**
 * registerDriverAuthRoutes — registers driver login routes
 * Uses signed JWT tokens (HMAC-SHA256) instead of base64.
 */
export function registerDriverAuthRoutes(app, pool, jwtSecret, jwtExpiresIn) {
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
                               AND d.status != 'terminated'
                               ORDER BY d.created_at DESC LIMIT 1`,
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
                  // Use dynamic import to avoid circular dependency
                  const { default: jwt } = await import('jsonwebtoken');
                  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
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

    // POST /api/drivers/:id/impersonate — dispatcher views driver portal (same company only)
    app.post('/api/drivers/:id/impersonate', async (req, res) => {
      try {
        // Auth check — must be a logged-in admin/dispatcher
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
        const token = header.slice(7);
        const { default: jwt } = await import('jsonwebtoken');
        let user;
        try { user = jwt.verify(token, jwtSecret); } catch { return res.status(401).json({ error: 'Invalid token' }); }

        const driverId = req.params.id;

        // Fetch driver — must belong to same company
        const result = await pool.query(
          `SELECT d.*, c.name AS company_name FROM drivers d
           JOIN companies c ON c.id = d.company_id
           WHERE d.id = $1`, [driverId]
        );
        const driver = result.rows[0];
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        // Enforce company isolation
        if (user.company_id && user.company_id !== driver.company_id) {
          return res.status(403).json({ error: 'Cannot impersonate driver from another company' });
        }

        // Generate driver token with impersonation flag
        const payload = {
          driver_id: driver.id,
          company_id: driver.company_id,
          name: driver.name,
          phone: driver.phone,
          impersonated_by: user.user_id || user.email || 'admin',
        };
        const driverToken = jwt.sign(payload, jwtSecret, { expiresIn: '1h' }); // shorter expiry for impersonation

        res.json({
          token: driverToken,
          driver: { ...payload, company_name: driver.company_name },
        });
      } catch (err) {
        console.error('[AUTH] Driver impersonation error:', err.message);
        res.status(500).json({ error: 'Impersonation failed' });
      }
    });
}
