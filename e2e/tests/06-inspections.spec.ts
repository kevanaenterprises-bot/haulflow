/**
 * 06-inspections.spec.ts
  *
   * SUITE: DVIR Inspections (Admin View)
    *
     * Tests the admin-facing inspection query API:
      *   1. GET /api/dvir/inspections — lists all inspections for the company
       *   2. GET /api/dvir/inspections?defects_only=true — filters defect inspections only
        *   3. GET /api/dvir/inspections/:id — gets a single inspection by ID
         *   4. Inspection items are returned as parsed JSON array
          *   5. Admin cannot see other company inspections
           *   6. Pagination works with limit and offset params
            */

            import { test, expect } from '@playwright/test';
            import { loadContext } from './helpers';

            test.describe('DVIR Inspections Admin View', () => {

              test('01 - GET /api/dvir/inspections returns list', async ({ request }) => {
                  const ctx = loadContext();
                      const res = await request.get(ctx.baseUrl + '/api/dvir/inspections', {
                            headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                });
                                    expect(res.ok()).toBeTruthy();
                                        const body = await res.json();
                                            expect(Array.isArray(body.inspections)).toBeTruthy();
                                                expect(typeof body.total).toBe('number');
                                                    expect(body.total).toBeGreaterThanOrEqual(2); // from driver portal tests
                                                      });

                                                        test('02 - GET /api/dvir/inspections?defects_only=true filters defects', async ({ request }) => {
                                                            const ctx = loadContext();
                                                                const res = await request.get(ctx.baseUrl + '/api/dvir/inspections?defects_only=true', {
                                                                      headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                          });
                                                                              expect(res.ok()).toBeTruthy();
                                                                                  const body = await res.json();
                                                                                      expect(Array.isArray(body.inspections)).toBeTruthy();
                                                                                          // All returned inspections must have has_defects = true
                                                                                              for (const insp of body.inspections) {
                                                                                                    expect(insp.has_defects).toBeTruthy();
                                                                                                        }
                                                                                                            // At least 1 defect inspection was submitted in test 04/09
                                                                                                                expect(body.total).toBeGreaterThanOrEqual(1);
                                                                                                                  });
                                                                                                                  
                                                                                                                    test('03 - GET /api/dvir/inspections/:id returns single inspection', async ({ request }) => {
                                                                                                                        const ctx = loadContext();
                                                                                                                            // First get list to get an ID
                                                                                                                                const listRes = await request.get(ctx.baseUrl + '/api/dvir/inspections', {
                                                                                                                                      headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                                                                                          });
                                                                                                                                              const list = await listRes.json();
                                                                                                                                                  const first = list.inspections[0];
                                                                                                                                                      expect(first).toBeTruthy();
                                                                                                                                                      
                                                                                                                                                          const res = await request.get(ctx.baseUrl + '/api/dvir/inspections/' + first.id, {
                                                                                                                                                                headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                                                                                                                    });
                                                                                                                                                                        expect(res.ok()).toBeTruthy();
                                                                                                                                                                            const body = await res.json();
                                                                                                                                                                                expect(body.id).toBe(first.id);
                                                                                                                                                                                    expect(body.truck_unit).toBe('T-101');
                                                                                                                                                                                      });
                                                                                                                                                                                      
                                                                                                                                                                                        test('04 - Inspection items are a JSON array', async ({ request }) => {
                                                                                                                                                                                            const ctx = loadContext();
                                                                                                                                                                                                const listRes = await request.get(ctx.baseUrl + '/api/dvir/inspections', {
                                                                                                                                                                                                      headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                                                                                                                                                          });
                                                                                                                                                                                                              const list = await listRes.json();
                                                                                                                                                                                                                  const insp = list.inspections[0];
                                                                                                                                                                                                                  
                                                                                                                                                                                                                      // items should be parseable as an array
                                                                                                                                                                                                                          const items = typeof insp.items === 'string' ? JSON.parse(insp.items) : insp.items;
                                                                                                                                                                                                                              expect(Array.isArray(items)).toBeTruthy();
                                                                                                                                                                                                                                  expect(items.length).toBeGreaterThan(0);
                                                                                                                                                                                                                                      expect(items[0].category || items[0].inspection_point || items[0].name || items[0].status).toBeTruthy();
                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                          test('05 - Pagination limit param works', async ({ request }) => {
                                                                                                                                                                                                                                              const ctx = loadContext();
                                                                                                                                                                                                                                                  const res = await request.get(ctx.baseUrl + '/api/dvir/inspections?limit=1&offset=0', {
                                                                                                                                                                                                                                                        headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                expect(res.ok()).toBeTruthy();
                                                                                                                                                                                                                                                                    const body = await res.json();
                                                                                                                                                                                                                                                                        expect(body.inspections.length).toBeLessThanOrEqual(1);
                                                                                                                                                                                                                                                                            expect(body.limit).toBe(1);
                                                                                                                                                                                                                                                                                expect(body.offset).toBe(0);
                                                                                                                                                                                                                                                                                  });
                                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                                    test('06 - Unauthorized request to inspections is rejected', async ({ request }) => {
                                                                                                                                                                                                                                                                                        const ctx = loadContext();
                                                                                                                                                                                                                                                                                            const res = await request.get(ctx.baseUrl + '/api/dvir/inspections');
                                                                                                                                                                                                                                                                                                expect(res.status()).toBe(401);
                                                                                                                                                                                                                                                                                                  });
                                                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                                                    test('07 - GET /api/dvir/inspections/:id returns 404 for non-existent ID', async ({ request }) => {
                                                                                                                                                                                                                                                                                                        const ctx = loadContext();
                                                                                                                                                                                                                                                                                                            const res = await request.get(ctx.baseUrl + '/api/dvir/inspections/00000000-0000-0000-0000-000000000000', {
                                                                                                                                                                                                                                                                                                                  headers: { Authorization: 'Bearer ' + ctx.adminToken },
                                                                                                                                                                                                                                                                                                                      });
                                                                                                                                                                                                                                                                                                                          expect(res.status()).toBe(404);
                                                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                                                            });
