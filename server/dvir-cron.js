// server/dvir-cron.js
// Nightly DVIR photo auto-delete cron job
// Run standalone: node server/dvir-cron.js
// Or integrate with node-cron in server/index.js

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

export async function runDvirAutoDelete() {
  const now = new Date().toISOString();
  console.log(`[DVIR CRON] Running auto-delete at ${now}`);
  try {
    const result = await pool.query(
      `DELETE FROM dvir_photos
       WHERE is_protected = false AND delete_at < $1
       RETURNING id, storage_path, truck_id, company_id`,
      [now]
    );
    const deleted = result.rows;
    console.log(`[DVIR CRON] Deleted ${deleted.length} expired, unprotected photo records`);
    return { deleted: deleted.length, timestamp: now };
  } catch (err) {
    console.error('[DVIR CRON] Error:', err.message);
    throw err;
  }
}

if (process.argv[1]?.endsWith('dvir-cron.js')) {
  runDvirAutoDelete()
    .then(result => { console.log('[DVIR CRON] Complete:', result); process.exit(0); })
    .catch(err => { console.error('[DVIR CRON] Fatal:', err); process.exit(1); });
}
