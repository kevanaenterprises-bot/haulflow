/**
 * global-setup.ts
 *
 * Runs once before the entire test suite.
 * Stores shared test context (company ID, tokens, created resource IDs)
 * to a temp JSON file so each spec can load it without re-doing setup.
 *
 * SAFETY: Refuses to run if BASE_URL/API_URL point to production.
 * Set TEST_MODE=1 to override (only use in staging environments).
 *
 * CLEANUP: Automatically deletes all test-created data after each run.
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'https://haulflow-production-575a.up.railway.app';
const UI_URL  = process.env.UI_URL  || process.env.BASE_URL || 'https://haulflow.turtlelogisticsllc.com';

const PRODUCTION_URLS = [
  'haulflow.turtlelogisticsllc.com',
  'haulflow-production',
];

function isProductionUrl(url: string): boolean {
  return PRODUCTION_URLS.some(p => url.toLowerCase().includes(p));
}

export const CONTEXT_FILE = path.join(__dirname, '.test-context.json');

export interface TestContext {
    baseUrl: string;   // API URL — used for all /api/* calls
    uiUrl: string;     // UI URL — used for page.goto() browser navigation
    adminEmail: string;
    adminPassword: string;
    companyName: string;
    adminToken: string;
    companyId: string;
    driverPhone: string;
    driverPassword: string;
    driverId?: string;
    customerId?: string;
    shipperId?: string;
    loadId?: string;
    invoiceId?: string;
}

async function cleanupTestData(ctx: Partial<TestContext>) {
  if (!ctx.baseUrl || !ctx.companyId) {
    console.log('[teardown] No companyId to clean up — skipping');
    return;
  }

  const cleanupEndpoints = [
    `/api/invoices?company_id=${ctx.companyId}`,
    `/api/loads?company_id=${ctx.companyId}`,
    `/api/shippers?company_id=${ctx.companyId}`,
    `/api/customers?company_id=${ctx.companyId}`,
    `/api/trucks?company_id=${ctx.companyId}`,
    `/api/drivers?company_id=${ctx.companyId}`,
  ];

  // Login first to get a token for authenticated cleanup
  let token = ctx.adminToken;
  if (!token) {
    try {
      const loginRes = await fetch(ctx.baseUrl + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.adminPassword }),
      });
      const loginData = await loginRes.json();
      token = loginData.token;
    } catch (e) {
      console.log('[teardown] Could not login for cleanup:', (e as Error).message);
      return;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Delete resources in reverse dependency order
  for (const endpoint of cleanupEndpoints) {
    try {
      const listRes = await fetch(ctx.baseUrl + endpoint, { headers });
      if (!listRes.ok) continue;
      const items = await listRes.json();
      const itemsArr = Array.isArray(items) ? items : (items.data || []);
      for (const item of itemsArr) {
        const id = item.id;
        if (!id) continue;
        await fetch(ctx.baseUrl + endpoint.split('?')[0] + '/' + id, {
          method: 'DELETE',
          headers,
        }).catch(() => {});
      }
    } catch (e) {
      // Best-effort cleanup — don't fail on errors
    }
  }

  // Delete the company itself (cascades to users)
  try {
    await fetch(ctx.baseUrl + '/api/company/' + ctx.companyId, {
      method: 'DELETE',
      headers,
    });
    console.log('[teardown] Deleted test company: ' + ctx.companyId);
  } catch (e) {
    console.log('[teardown] Could not delete company:', (e as Error).message);
  }
}

export default async function globalSetup() {
  // SAFETY GUARD: Block running against production unless TEST_MODE=1
  const isProd = isProductionUrl(API_URL) || isProductionUrl(UI_URL);
  if (isProd && process.env.TEST_MODE !== '1') {
    console.error('\n❌ BLOCKED: E2E tests are configured to run against PRODUCTION.');
    console.error('   API: ' + API_URL);
    console.error('   UI:  ' + UI_URL);
    console.error('\n   To run against production anyway (NOT recommended):');
    console.error('   TEST_MODE=1 npm test\n');
    process.exit(1);
  }

  // Clean up data from previous run before starting fresh
  if (existsSync(CONTEXT_FILE)) {
    try {
      const prevCtx = JSON.parse(readFileSync(CONTEXT_FILE, 'utf-8'));
      console.log('[setup] Cleaning up previous run data...');
      await cleanupTestData(prevCtx);
    } catch (e) {
      console.log('[setup] Previous cleanup failed (non-fatal):', (e as Error).message);
    }
  }

  // Generate a unique run suffix so repeated runs never collide
  const suffix = Date.now().toString().slice(-6);

  const ctx: Partial<TestContext> = {
    baseUrl: API_URL,
    uiUrl: UI_URL,
    companyName: `Thunder Ridge Logistics ${suffix}`,
    adminEmail: `admin${suffix}@thunderridge.test`,
    adminPassword: `HaulTest${suffix}!`,
    driverPhone: `555${suffix}`,
    driverPassword: `Driver${suffix}!`,
  };

  // Persist the seed data so specs can read it
  writeFileSync(CONTEXT_FILE, JSON.stringify(ctx, null, 2));
    console.log(`\n[global-setup] Test run suffix: ${suffix}`);
  console.log(`[global-setup] Company: ${ctx.companyName}`);
  console.log(`[global-setup] Admin email: ${ctx.adminEmail}`);
  console.log(`[global-setup] Target: ${API_URL}`);

  // Register cleanup on process exit
  process.on('exit', async () => {
    // Note: cleanup runs synchronously — for async, use beforeExit or a separate script
  });
}

// Teardown: runs when playwright calls globalTeardown
export async function globalTeardown() {
  if (!existsSync(CONTEXT_FILE)) return;
  try {
    const ctx = JSON.parse(readFileSync(CONTEXT_FILE, 'utf-8'));
    console.log('\n[teardown] Cleaning up test data...');
    await cleanupTestData(ctx);
    unlinkSync(CONTEXT_FILE);
    console.log('[teardown] Cleanup complete');
  } catch (e) {
    console.log('[teardown] Cleanup failed (non-fatal):', (e as Error).message);
  }
}
