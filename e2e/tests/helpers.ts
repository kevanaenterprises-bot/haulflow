/**
 * tests/helpers.ts
   *
   * Shared utilities for all HaulFlow E2E specs:
 *   - loadContext() / saveContext() — read/write the shared test-context JSON
   *   - apiRequest()                 — direct HTTP calls to the API (bypasses UI)
 *   - adminLogin()                 — log in via UI and return page + context
   *   - waitForToast()               — wait for a success/error toast message
 */

import { Page, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
  import path from 'path';
import type { TestContext } from '../global-setup';

export const CONTEXT_FILE = path.join(__dirname, '..', '.test-context.json');

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

export function loadContext(): TestContext {
    return JSON.parse(readFileSync(CONTEXT_FILE, 'utf8'));
}

export function saveContext(updates: Partial<TestContext>) {
    const current = loadContext();
  writeFileSync(CONTEXT_FILE, JSON.stringify({ ...current, ...updates }, null, 2));
}

// ---------------------------------------------------------------------------
// API helper — makes a raw HTTP request to the HaulFlow backend
// ---------------------------------------------------------------------------

export async function apiRequest(
  method: string,
  path: string,
    body?: object,
    token?: string
  ): Promise<any> {
    const ctx = loadContext();
  const url = `${ctx.baseUrl}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
});

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    throw new Error(`API ${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
}
  return data;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Log in to the admin dashboard via the UI.
 * Stores the token in localStorage (mirrors what the real app does).
 */
export async function adminLogin(page: Page, ctx?: TestContext): Promise<TestContext> {
  const context = ctx || loadContext();

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // If already logged in (token in localStorage), skip
  const existingToken = await page.evaluate(() => localStorage.getItem('hf_token'));
  if (existingToken) return context;

  await page.fill('input[type="email"], input[placeholder*="email" i]', context.adminEmail);
  await page.fill('input[type="password"]', context.adminPassword);
  await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');

  // Wait for dashboard to appear
  await expect(page.locator('text=Loads, text=Dispatch, nav')).toBeVisible({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  return context;
}

/**
 * Navigate to a tab in the admin dashboard sidebar.
 */
export async function navigateToTab(page: Page, tabName: string) {
  // Try sidebar nav links
  const navLink = page.locator(`nav >> text=${tabName}`).first();
  const sidebarBtn = page.locator(`button:has-text("${tabName}")`).first();
  const anyLink = page.locator(`a:has-text("${tabName}")`).first();

  if (await navLink.isVisible()) {
    await navLink.click();
} else if (await sidebarBtn.isVisible()) {
    await sidebarBtn.click();
} else {
    await anyLink.click();
}
  await page.waitForTimeout(800);
}

/**
 * Wait for a toast/alert/notification containing the given text.
 */
export async function waitForToast(page: Page, text: string, timeout = 10_000) {
  await expect(
    page.locator(`[role="alert"], .toast, [class*="toast"], [class*="notification"], [class*="snack"]`)
      .filter({ hasText: text })
  ).toBeVisible({ timeout });
}

/**
 * Fill a modal/dialog form field by label text.
   */
export async function fillField(page: Page, label: string, value: string) {
    const input = page.locator(`label:has-text("${label}") + input,
      label:has-text("${label}") ~ input,
      input[placeholder*="${label}" i],
      input[aria-label*="${label}" i]`).first();
  await input.fill(value);
}

/**
 * Click a button anywhere on the page that contains the given text.
   */
export async function clickButton(page: Page, text: string) {
  await page.locator(`button:has-text("${text}")`).first().click();
}

/**
 * Build a simple JWT-style token the same way the server does.
   * Used for direct API calls in tests that don't go through the UI.
   */
  export function buildToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${encoded}.sig`;
}
