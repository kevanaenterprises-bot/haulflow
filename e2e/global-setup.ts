/**
 * global-setup.ts
 *
 * Runs once before the entire test suite.
 * Stores shared test context (company ID, tokens, created resource IDs)
 * to a temp JSON file so each spec can load it without re-doing setup.
 *
 * NOTE: This setup does NOT clean up data automatically — HaulFlow uses
 * unique email addresses per run (timestamped) so old test data simply
 * accumulates.  To purge, manually delete rows via Supabase dashboard.
 */

import { writeFileSync } from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://haulflow.vercel.app';

export const CONTEXT_FILE = path.join(__dirname, '.test-context.json');

export interface TestContext {
    baseUrl: string;
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

export default async function globalSetup() {
    // Generate a unique run suffix so repeated runs never collide
  const suffix = Date.now().toString().slice(-6);

  const ctx: Partial<TestContext> = {
        baseUrl: BASE_URL,
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
}
